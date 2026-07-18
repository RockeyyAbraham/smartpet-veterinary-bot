// Load environment variables for local testing and configuration
require('dotenv').config();

const neo4j      = require('neo4j-driver');
const supabaseJs = require('@supabase/supabase-js');
const Groq = require('groq-sdk');
const ws          = require('ws');

// ---------------------------------------------------------------------------
// Neo4j driver
// ---------------------------------------------------------------------------
const driver = neo4j.driver(
  process.env.NEO4J_URI || '',
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME || '',
    process.env.NEO4J_PASSWORD || ''
  )
);

// ---------------------------------------------------------------------------
// Supabase client — ws transport required for compatibility with Node 20
// ---------------------------------------------------------------------------
const supabaseOptions = {
  realtime: {
    transport: ws
  }
};

const supabase = supabaseJs.createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || '',
  supabaseOptions
);

// ---------------------------------------------------------------------------
// Groq client — used for entity extraction (LLaMA 3 model).
// Groq free tier: 14,400 requests/day — far more generous than Gemini Flash.
// ---------------------------------------------------------------------------
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

/**
 * Uses Groq (llama-3.3-70b-versatile) to extract symptom and breed names from
 * a natural-language veterinary query.
 *
 * Groq is used instead of Gemini Flash because the Gemini free-tier
 * generate_content daily quota is easily exhausted; Groq's free tier allows
 * 14,400 requests/day for LLaMA models.
 *
 * The model is instructed to return only raw JSON with no markdown wrapping.
 *
 * @param {string} query  The user's natural-language query.
 * @returns {Promise<{ symptoms: string[], breeds: string[] }>}
 */
async function extractEntities(query) {
  try {
    var chatCompletion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'You are a veterinary NLP assistant. Extract symptoms and breed names ' +
            'from the user query. Return ONLY a valid JSON object with no markdown, ' +
            'no backticks, no explanation. Format exactly like this: ' +
            '{"symptoms": ["symptom1", "symptom2"], "breeds": ["breed1"]}'
        },
        {
          role: 'user',
          content: query
        }
      ],
      temperature: 0,
      max_tokens: 256
    });

    var responseText = chatCompletion.choices[0].message.content.trim();

    // Strip any accidental markdown fences if the model adds them
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
    }

    var parsed = JSON.parse(responseText);

    return {
      symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms : [],
      breeds:   Array.isArray(parsed.breeds)   ? parsed.breeds   : []
    };
  } catch (err) {
    console.error('[graphRetrieval] extractEntities() failed:', err.message);
    return { symptoms: [], breeds: [] };
  }
}

/**
 * Queries the Neo4j graph to find Condition nodes that match the extracted
 * entities (symptoms and/or breeds).
 *
 * Scoring strategy:
 *   - Each match against a symptom or breed in the query adds to matchCount.
 *   - score = matchCount / (total symptoms + total breeds queried).
 *   - When both symptoms and breeds are present, only conditions that appear
 *     in BOTH result sets are returned (intersection), ranked by combined
 *     match count. If the intersection is empty, conditions from either set
 *     are included to avoid returning nothing.
 *
 * @param {object}   session   An open Neo4j session.
 * @param {object}   entities  { symptoms: string[], breeds: string[] }
 * @returns {Promise<Array<{ title: string, matchCount: number, score: number }>>}
 */
async function queryGraph(session, entities) {
  var symptoms = entities.symptoms;
  var breeds   = entities.breeds;
  var totalEntities = symptoms.length + breeds.length;

  if (totalEntities === 0) {
    return [];
  }

  var symptomResults = [];
  var breedResults   = [];

  // Query conditions matching symptoms
  if (symptoms.length > 0) {
    var symptomList = symptoms.map(function(s) { return s.toLowerCase().trim(); });

    var symptomQuery =
      'MATCH (s:Symptom)-[:INDICATES]->(c:Condition) ' +
      'WHERE toLower(s.name) IN $symptomList ' +
      'RETURN c.title AS title, count(s) AS matchCount ' +
      'ORDER BY matchCount DESC ' +
      'LIMIT 10';

    var symptomRun = await session.run(symptomQuery, { symptomList: symptomList });
    symptomResults = symptomRun.records.map(function(record) {
      return {
        title:      record.get('title'),
        matchCount: neo4j.integer.toNumber(record.get('matchCount'))
      };
    });
  }

  // Query conditions matching breeds
  if (breeds.length > 0) {
    var breedList = breeds.map(function(b) { return b.toLowerCase().trim(); });

    var breedQuery =
      'MATCH (c:Condition)-[:AFFECTS_BREED]->(b:Breed) ' +
      'WHERE toLower(b.name) IN $breedList ' +
      'RETURN c.title AS title, count(b) AS matchCount ' +
      'ORDER BY matchCount DESC ' +
      'LIMIT 10';

    var breedRun = await session.run(breedQuery, { breedList: breedList });
    breedResults = breedRun.records.map(function(record) {
      return {
        title:      record.get('title'),
        matchCount: neo4j.integer.toNumber(record.get('matchCount'))
      };
    });
  }

  // Merge results and compute combined scores
  var scoreMap = {};

  function addToScoreMap(resultList, weight) {
    for (var i = 0; i < resultList.length; i++) {
      var item = resultList[i];
      if (scoreMap[item.title]) {
        scoreMap[item.title].matchCount += item.matchCount;
        scoreMap[item.title].sourceCount++;
      } else {
        scoreMap[item.title] = {
          title:       item.title,
          matchCount:  item.matchCount,
          sourceCount: 1
        };
      }
    }
  }

  addToScoreMap(symptomResults, 1);
  addToScoreMap(breedResults,   1);

  // When both entity types were queried, prefer conditions found in BOTH
  var merged = Object.values(scoreMap);
  var bothQueried = symptoms.length > 0 && breeds.length > 0;

  if (bothQueried) {
    var intersection = merged.filter(function(item) { return item.sourceCount >= 2; });
    if (intersection.length > 0) {
      merged = intersection;
    }
    // If intersection is empty, fall through and use all matches
  }

  merged.sort(function(a, b) { return b.matchCount - a.matchCount; });

  return merged.map(function(item) {
    return {
      title:      item.title,
      matchCount: item.matchCount,
      score:      item.matchCount / totalEntities
    };
  });
}

/**
 * Fetches full vet_kb documents from Supabase for the given condition titles.
 *
 * @param {string[]} titles  Array of exact condition title strings.
 * @returns {Promise<Array<object>>} Full vet_kb rows.
 */
async function fetchFullDocuments(titles) {
  if (!titles || titles.length === 0) {
    return [];
  }

  var response = await supabase
    .from('vet_kb')
    .select(
      'title, species, breed, symptom_list, condition_tags, ' +
      'body_system, severity, concise_summary, full_text, source, source_url'
    )
    .in('title', titles);

  var data  = response.data;
  var error = response.error;

  if (error) {
    throw new Error('[graphRetrieval] Supabase fetch failed: ' + error.message);
  }

  return data || [];
}

/**
 * Performs GraphRAG retrieval for the given query.
 *
 * Workflow:
 *   User query
 *     → Groq (LLaMA) entity extraction (symptoms + breeds)
 *     → Neo4j Cypher traversal (find matching Conditions)
 *     → Supabase document lookup (fetch full records by title)
 *     → Standard output schema with graph-derived relevance_score
 *
 * @param {string} query      The user query string.
 * @param {number} [limit=5]  Number of top results to return.
 * @returns {Promise<Array<object>>} Matched veterinary records.
 */
async function retrieve(query, limit) {
  if (limit === undefined) {
    limit = 5;
  }

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return [];
  }

  var session = driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });

  try {
    // Stage 1: Extract entities from the query using Groq (LLaMA 3)
    var entities = await extractEntities(query);

    var hasSymptoms = entities.symptoms && entities.symptoms.length > 0;
    var hasBreeds   = entities.breeds   && entities.breeds.length   > 0;

    if (!hasSymptoms && !hasBreeds) {
      console.warn('[graphRetrieval] No entities extracted for query: "' + query + '"');
      return [];
    }

    // Stage 2: Traverse the Neo4j graph to score matching conditions
    var graphMatches = await queryGraph(session, entities);

    if (graphMatches.length === 0) {
      return [];
    }

    // Stage 3: Take top-limit matched titles
    var topMatches = graphMatches.slice(0, limit);
    var titles     = topMatches.map(function(m) { return m.title; });

    // Build a score lookup keyed by title for the final mapping
    var scoreLookup = {};
    for (var i = 0; i < topMatches.length; i++) {
      scoreLookup[topMatches[i].title] = topMatches[i].score;
    }

    // Stage 4: Fetch full documents from Supabase
    var documents = await fetchFullDocuments(titles);

    // Stage 5: Map to the standard retrieval schema, preserving graph rank order
    var docMap = {};
    for (var j = 0; j < documents.length; j++) {
      docMap[documents[j].title] = documents[j];
    }

    var results = [];
    for (var k = 0; k < topMatches.length; k++) {
      var title = topMatches[k].title;
      var doc   = docMap[title];
      if (!doc) {
        continue; // title found in graph but not yet in Supabase — skip
      }
      results.push({
        title:           doc.title           || '',
        species:         doc.species         || '',
        breed:           doc.breed           || [],
        symptom_list:    doc.symptom_list    || [],
        condition_tags:  doc.condition_tags  || [],
        body_system:     doc.body_system     || '',
        severity:        doc.severity        || '',
        concise_summary: doc.concise_summary || '',
        full_text:       doc.full_text       || '',
        source:          doc.source          || '',
        source_url:      doc.source_url      || '',
        relevance_score: scoreLookup[title]  || 0
      });
    }

    return results;

  } catch (err) {
    console.error('[graphRetrieval] retrieve() failed:', err.message);
    throw err;
  } finally {
    await session.close();
  }
}

/**
 * Closes the shared Neo4j driver connection.
 * Call this in evaluation scripts or when the process is shutting down.
 *
 * @returns {Promise<void>}
 */
async function closeDriver() {
  await driver.close();
}

module.exports = {
  retrieve:    retrieve,
  closeDriver: closeDriver
};

// ---------------------------------------------------------------------------
// Self-test block — only runs when executed directly: node graphRetrieval.js
// ---------------------------------------------------------------------------
if (require.main === module) {
  var testQueries = [
    'my German Shepherd is limping after a walk',
    'dog vomiting and not eating',
    'cat has eye discharge'
  ];

  async function runTests() {
    console.log('[graphRetrieval] Running self-test...\n');

    for (var i = 0; i < testQueries.length; i++) {
      var query = testQueries[i];
      console.log('─'.repeat(60));
      console.log('Query: "' + query + '"');

      try {
        var results = await retrieve(query, 3);

        if (results.length === 0) {
          console.log('  (no results returned)');
        } else {
          console.log('Top ' + results.length + ' results:');
          for (var r = 0; r < results.length; r++) {
            console.log(
              '  ' + (r + 1) + '. ' + results[r].title +
              ' | score: ' + results[r].relevance_score.toFixed(4)
            );
          }
        }
      } catch (err) {
        console.error('  Test failed:', err.message);
      }

      console.log('');
    }

    await closeDriver();
    process.exit(0);
  }

  runTests().catch(function(err) {
    console.error('[graphRetrieval] Self-test crashed:', err.message);
    closeDriver().finally(function() {
      process.exit(1);
    });
  });
}
