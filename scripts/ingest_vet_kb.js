const path = require('path');
const fs = require('fs');

// Load environment variables
// Try loading from root, then try from current directory or relative paths
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const supabaseJs = require('@supabase/supabase-js');
const googleGenAi = require('@google/generative-ai');
const ws = require('ws');

const createClient = supabaseJs.createClient;
const GoogleGenerativeAI = googleGenAi.GoogleGenerativeAI;

// Validate environment variables first
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'GEMINI_API_KEY'
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

// Initialize Gemini Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generates vector embeddings for a given text query using Google Gemini models/gemini-embedding-001.
 * 
 * @param {string} text The text to embed.
 * @returns {Promise<number[]>} The vector embedding array.
 */
async function getEmbedding(text) {
  const model = genAI.getGenerativeModel({ model: 'models/gemini-embedding-001' });
  const result = await model.embedContent(text);
  const embedding = result.embedding;
  return embedding.values;
}

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
      
      // Log exactly what is requested: console.log("Embedding dimensions:", embedding.length);
      console.log("Embedding dimensions:", embedding.length);
      
      // Slicing to 768 dimensions if the model returned 3072 dimensions
      if (embedding.length > 768) {
        embedding = embedding.slice(0, 768);
      }
    } catch (embError) {
      console.error(`Gemini embedding error for entry "${entry.title}":`, embError.message || embError);
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
