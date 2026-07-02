// Load environment variables for local testing and configuration
require('dotenv').config();

const faissRetrieval = require('./faissRetrieval');
const bm25Retrieval  = require('./bm25Retrieval');

// RRF constant — standard value is 60, balances rank weighting
const RRF_K = 60;

/**
 * Preloads FAISS dense vectors into memory.
 * Must be called before the first retrieve() call if using FAISS cold-start.
 *
 * @returns {Promise<void>}
 */
async function initialize() {
  try {
    await faissRetrieval.initialize();
  } catch (err) {
    console.error('[hybridRetrieval] initialize() failed:', err.message);
    throw err;
  }
}

/**
 * Applies Reciprocal Rank Fusion across a list of ranked result arrays.
 *
 * For each document in each list:
 *   RRF score contribution = 1 / (k + rank)   where rank is 1-based
 *
 * Documents appearing in multiple lists have their per-list RRF scores summed,
 * which naturally boosts them above documents found by only one method.
 *
 * @param {Array<Array<object>>} rankedLists  Array of ranked result arrays.
 * @param {string}               keyField     Field to use as dedup key (e.g. 'title').
 * @returns {Array<object>}  Merged, deduplicated, RRF-scored results.
 */
function applyRRF(rankedLists, keyField) {
  // Map from normalised key → { record, rrfScore }
  const scoreMap = {};

  for (let listIdx = 0; listIdx < rankedLists.length; listIdx++) {
    const list = rankedLists[listIdx];

    for (let rank = 0; rank < list.length; rank++) {
      const record   = list[rank];
      const key      = record[keyField].toLowerCase().trim();
      const rrfScore = 1 / (RRF_K + (rank + 1)); // rank is 0-based; +1 makes it 1-based

      if (scoreMap[key]) {
        scoreMap[key].rrfScore += rrfScore;
      } else {
        scoreMap[key] = {
          record:   record,
          rrfScore: rrfScore
        };
      }
    }
  }

  return Object.values(scoreMap);
}

/**
 * Combines FAISS dense retrieval and BM25 keyword retrieval using RRF.
 *
 * @param {string} query     The user query string.
 * @param {number} [limit=5] Number of top results to return.
 * @returns {Promise<Array<object>>} Merged veterinary records with combined_score.
 */
async function retrieve(query, limit = 5) {
  if (!query || typeof query !== 'string') {
    return [];
  }

  // Run both retrievers in parallel for efficiency
  let faissResults = [];
  let bm25Results  = [];

  try {
    faissResults = await faissRetrieval.retrieve(query, 10);
  } catch (err) {
    console.error('[hybridRetrieval] FAISS retrieval failed:', err.message);
    // Continue — BM25 alone can still produce results
  }

  try {
    bm25Results = await bm25Retrieval.retrieve(query, 10);
  } catch (err) {
    console.error('[hybridRetrieval] BM25 retrieval failed:', err.message);
    // Continue — FAISS alone can still produce results
  }

  if (faissResults.length === 0 && bm25Results.length === 0) {
    console.error('[hybridRetrieval] Both retrieval methods returned no results.');
    return [];
  }

  // Apply RRF across both ranked lists, deduplicating by title
  const merged = applyRRF([faissResults, bm25Results], 'title');

  // Sort descending by combined RRF score
  merged.sort(function(a, b) {
    return b.rrfScore - a.rrfScore;
  });

  // Slice to requested limit and shape output
  return merged.slice(0, limit).map(function(item) {
    return {
      title:           item.record.title,
      species:         item.record.species,
      breed:           item.record.breed,
      symptom_list:    item.record.symptom_list,
      condition_tags:  item.record.condition_tags,
      body_system:     item.record.body_system,
      severity:        item.record.severity,
      concise_summary: item.record.concise_summary,
      full_text:       item.record.full_text,
      source:          item.record.source,
      source_url:      item.record.source_url,
      relevance_score: item.record.relevance_score,
      combined_score:  item.rrfScore
    };
  });
}

module.exports = {
  initialize: initialize,
  retrieve:   retrieve
};

// ---------------------------------------------------------------------------
// Self-test block — only runs when executed directly: node hybridRetrieval.js
// ---------------------------------------------------------------------------
if (require.main === module) {
  console.log('[hybridRetrieval] Running standalone test...\n');

  initialize()
    .then(function() {
      return retrieve('dog limping and difficulty walking', 3);
    })
    .then(function(results) {
      console.log('[hybridRetrieval] Top results for "dog limping and difficulty walking":\n');
      results.forEach(function(r, i) {
        console.log(
          (i + 1) + '. ' + r.title +
          ' (' + r.species + ')' +
          ' | combined_score: ' + r.combined_score.toFixed(6) +
          ' | relevance_score: ' + r.relevance_score.toFixed(6)
        );
        console.log('   Summary : ' + r.concise_summary);
        console.log('   Symptoms: ' + r.symptom_list.join(', '));
        console.log('');
      });
    })
    .catch(function(err) {
      console.error('[hybridRetrieval] Test failed:', err.message);
      process.exit(1);
    });
}
