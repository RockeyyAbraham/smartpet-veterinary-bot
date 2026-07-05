require('dotenv').config();

const neo4j = require('neo4j-driver');
const supabaseJs = require('@supabase/supabase-js');
const ws = require('ws');

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
// Neo4j client
// ---------------------------------------------------------------------------
const driver = neo4j.driver(
  process.env.NEO4J_URI || '',
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME || '',
    process.env.NEO4J_PASSWORD || ''
  )
);

/**
 * Fetches all rows from the vet_kb table in Supabase.
 * Selects only the necessary fields for graph population.
 *
 * @returns {Promise<Array<object>>} Array of veterinary knowledge base records.
 */
async function fetchVetKbEntries() {
  var response = await supabase
    .from('vet_kb')
    .select('id, title, species, breed, condition_tags, symptom_list, body_system, severity, concise_summary, source');

  var data = response.data;
  var error = response.error;

  if (error) {
    throw new Error('[populateGraph] Failed to fetch vet_kb entries: ' + error.message);
  }

  return data || [];
}

/**
 * Populates Neo4j with a single vet_kb entry by creating a Condition node
 * and linking it to related entities (Symptoms, Breeds, BodySystem, etc.).
 *
 * Uses MERGE to ensure idempotency (no duplicates on repeated runs).
 *
 * @param {object} session  An active Neo4j session.
 * @param {object} entry    A single row from vet_kb.
 * @returns {Promise<void>}
 */
async function createGraphForEntry(session, entry) {
  try {
    var title = entry.title || 'Unknown Condition';
    var species = entry.species || 'Unknown';
    var severity = entry.severity || 'Unknown';
    var bodySystem = entry.body_system || 'Unknown';
    var summary = entry.concise_summary || '';
    var source = entry.source || '';

    // 1. Create Condition Node
    var conditionQuery = 
      'MERGE (c:Condition { title: $title }) ' +
      'SET c.species = $species, c.severity = $severity, c.body_system = $bodySystem, c.concise_summary = $summary, c.source = $source';
    
    await session.run(conditionQuery, {
      title: title,
      species: species,
      severity: severity,
      bodySystem: bodySystem,
      summary: summary,
      source: source
    });

    // 2. Create Symptoms and relationships
    if (entry.symptom_list && Array.isArray(entry.symptom_list)) {
      for (var i = 0; i < entry.symptom_list.length; i++) {
        var symptom = entry.symptom_list[i].trim();
        if (symptom) {
          var symptomQuery = 
            'MERGE (c:Condition { title: $title }) ' +
            'MERGE (s:Symptom { name: $symptom }) ' +
            'MERGE (s)-[:INDICATES]->(c)';
          await session.run(symptomQuery, { title: title, symptom: symptom });
        }
      }
    }

    // 3. Create Breeds and relationships
    if (entry.breed && Array.isArray(entry.breed)) {
      for (var j = 0; j < entry.breed.length; j++) {
        var breed = entry.breed[j].trim();
        if (breed) {
          var breedQuery = 
            'MERGE (c:Condition { title: $title }) ' +
            'MERGE (b:Breed { name: $breed }) ' +
            'MERGE (c)-[:AFFECTS_BREED]->(b)';
          await session.run(breedQuery, { title: title, breed: breed });
        }
      }
    }

    // 4. Create BodySystem and relationship
    if (bodySystem && bodySystem !== 'Unknown') {
      var systemQuery = 
        'MERGE (c:Condition { title: $title }) ' +
        'MERGE (bs:BodySystem { name: $bodySystem }) ' +
        'MERGE (c)-[:AFFECTS_SYSTEM]->(bs)';
      await session.run(systemQuery, { title: title, bodySystem: bodySystem });
    }

    // 5. Create Severity and relationship
    if (severity && severity !== 'Unknown') {
      var severityQuery = 
        'MERGE (c:Condition { title: $title }) ' +
        'MERGE (sev:Severity { name: $severity }) ' +
        'MERGE (c)-[:HAS_SEVERITY]->(sev)';
      await session.run(severityQuery, { title: title, severity: severity });
    }

    // 6. Create Species and relationship
    if (species && species !== 'Unknown') {
      var speciesQuery = 
        'MERGE (c:Condition { title: $title }) ' +
        'MERGE (sp:Species { name: $species }) ' +
        'MERGE (c)-[:FOUND_IN]->(sp)';
      await session.run(speciesQuery, { title: title, species: species });
    }

    // 7. Create Tags and relationships
    if (entry.condition_tags && Array.isArray(entry.condition_tags)) {
      for (var k = 0; k < entry.condition_tags.length; k++) {
        var tag = entry.condition_tags[k].trim();
        if (tag) {
          var tagQuery = 
            'MERGE (c:Condition { title: $title }) ' +
            'MERGE (t:Tag { name: $tag }) ' +
            'MERGE (c)-[:TAGGED_AS]->(t)';
          await session.run(tagQuery, { title: title, tag: tag });
        }
      }
    }

  } catch (err) {
    console.error('[populateGraph] Error processing entry "' + entry.title + '":', err.message);
  }
}

/**
 * Opens a Neo4j session, loops through all vet_kb entries, and populates the graph.
 *
 * @param {Array<object>} entries  Array of veterinary knowledge base records.
 * @returns {Promise<number>} Number of successfully processed entries.
 */
async function populateGraph(entries) {
  var session = driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });
  var processedCount = 0;

  try {
    for (var i = 0; i < entries.length; i++) {
      await createGraphForEntry(session, entries[i]);
      processedCount++;

      if (processedCount % 5 === 0) {
        console.log('[populateGraph] Progress: Processed ' + processedCount + ' of ' + entries.length + ' entries.');
      }
    }
  } finally {
    await session.close();
  }

  return processedCount;
}

/**
 * Main execution function.
 * Validates environment, fetches records from Supabase, populates Neo4j,
 * and exits the process appropriately.
 *
 * @returns {Promise<void>}
 */
async function main() {
  // Validate all required env vars are present
  var requiredEnvVars = [
    'NEO4J_URI',
    'NEO4J_USERNAME',
    'NEO4J_PASSWORD',
    'NEO4J_DATABASE',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY'
  ];

  for (var i = 0; i < requiredEnvVars.length; i++) {
    if (!process.env[requiredEnvVars[i]]) {
      console.error('[populateGraph] Missing required environment variable: ' + requiredEnvVars[i]);
      process.exit(1);
    }
  }

  console.log('[populateGraph] Starting graph population...');

  try {
    var entries = await fetchVetKbEntries();
    console.log('[populateGraph] Found ' + entries.length + ' entries in vet_kb.');

    if (entries.length > 0) {
      var processedCount = await populateGraph(entries);
      console.log('[populateGraph] Graph population complete: ' + processedCount + ' entries processed.');
    } else {
      console.log('[populateGraph] No entries found to populate.');
    }

    await driver.close();
    process.exit(0);
  } catch (err) {
    console.error('[populateGraph] Execution failed:', err.message);
    await driver.close();
    process.exit(1);
  }
}

main();
