const path = require('path');
const fs = require('fs');

// Load environment variables
// Try loading from root, then try from current directory or relative paths
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const supabaseJs = require('@supabase/supabase-js');
const ws = require('ws');
const embeddingService = require('../services/embeddingService');

const createClient = supabaseJs.createClient;
const getEmbedding = embeddingService.getEmbedding;

// Validate environment variables first
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY'
];

for (let i = 0; i < requiredEnvVars.length; i++) {
  const envVar = requiredEnvVars[i];
  if (!process.env[envVar]) {
    console.error('CRITICAL ERROR: Missing required environment variable ' + envVar);
    process.exit(1);
  }
}

// Initialize Supabase Client
const supabaseOptions = {
  realtime: {
    transport: ws
  }
};
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  supabaseOptions
);

async function run() {
  const dataPath = path.join(__dirname, 'vet_kb_data.json');
  console.log("Loading veterinary knowledge base data from:", dataPath);

  if (!fs.existsSync(dataPath)) {
    console.error("Error: vet_kb_data.json file not found at " + dataPath);
    process.exit(1);
  }

  let kbData;
  try {
    const fileContent = fs.readFileSync(dataPath, 'utf8');
    kbData = JSON.parse(fileContent);
  } catch (error) {
    console.error("Error parsing/loading vet_kb_data.json:", error);
    process.exit(1);
  }

  if (!Array.isArray(kbData)) {
    console.error("Error: vet_kb_data.json does not contain a valid JSON array.");
    process.exit(1);
  }

  console.log(`Successfully loaded ${kbData.length} entries. Starting ingestion...`);

  for (let i = 0; i < kbData.length; i++) {
    const entry = kbData[i];
    console.log(`\nProcessing entry: "${entry.title}"`);

    // Validation of structured fields in entry
    if (!entry.title || !entry.full_text) {
      console.error(`Error: Entry at index ${i} is missing required fields (title or full_text). Skipping.`);
      continue;
    }

    let embedding;
    try {
      console.log(`Generating embedding for "${entry.title}" from full_text...`);
      embedding = await getEmbedding(entry.full_text);

      // Log the dimension produced by the MiniLM model (should be 384)
      console.log('Embedding dimensions:', embedding.length);
    } catch (embError) {
      console.error(`Embedding error for entry "${entry.title}":`, embError.message || embError);
      continue;
    }

    try {
      console.log(`Inserting "${entry.title}" into Supabase...`);
      const { error } = await supabase
        .from("vet_kb")
        .insert({
          title: entry.title,
          species: entry.species,
          breed: entry.breed,
          condition_tags: entry.condition_tags,
          symptom_list: entry.symptom_list,
          body_system: entry.body_system,
          severity: entry.severity,
          concise_summary: entry.concise_summary,
          full_text: entry.full_text,
          source: entry.source,
          source_url: entry.source_url,
          embedding: embedding
        });

      if (error) {
        console.error(`Insertion failure for entry: "${entry.title}". Error: ${error.message}`);
      } else {
        console.log(`Insertion success for entry: "${entry.title}"`);
      }
    } catch (dbError) {
      console.error(`Supabase insertion error for entry "${entry.title}":`, dbError.message || dbError);
    }
  }

  console.log("\nIngestion process completed.");
}

run();
