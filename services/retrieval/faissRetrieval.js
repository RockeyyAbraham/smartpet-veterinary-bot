// Load environment variables for local testing and configuration
require('dotenv').config();

const supabaseJs = require('@supabase/supabase-js');
const googleGenAi = require('@google/generative-ai');
const ws = require('ws');

const createClient = supabaseJs.createClient;
const GoogleGenerativeAI = googleGenAi.GoogleGenerativeAI;

// ---------------------------------------------------------------------------
// NOTE: faiss-node is NOT compatible with the current environment.
//
// Root cause: faiss-node requires native C++ bindings compiled against the
// host system. No prebuilt binary exists for node-v115-win32-x64 (Node 20
// on Windows). The package falls back to source compilation, which requires
// Visual Studio Build Tools, OpenBLAS, and LAPACK — all absent from this
// environment.
//
// Confirmed failure:
//   Error: Could not locate the bindings file.
//   → node_modules/faiss-node/lib/binding/node-v115-win32-x64/faiss-node.node
//
// Alternative used: Pure-JS brute-force cosine similarity (flat exhaustive search).
//
// Functional equivalence: The FAISS index type most suited to this use case
// is IndexFlatIP (inner-product / cosine after normalisation), which is a
// flat exhaustive search — mathematically identical to iterating over all
// vectors and computing similarity scores. With only 19 records in vet_kb,
// this approach has the same O(n) cost as FAISS IndexFlatIP and produces
// identical ranked results with zero native dependency overhead.
//
// Migration path: When this project is deployed on Linux (e.g. Docker or
// WSL2), replace this module with faiss-node using IndexFlatIP and the same
// initialize()/retrieve() interface below. No other changes are needed.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------
const supabaseOptions = { realtime: { transport: ws } };

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  supabaseOptions
);

// ---------------------------------------------------------------------------
// Gemini embedding client (same model used by the ingestion pipeline)
// ---------------------------------------------------------------------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generates a 768-dimensional embedding vector for the given text using the
 * same Gemini model used during vet_kb ingestion.
 *
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function getEmbedding(text) {
  const model = genAI.getGenerativeModel({ model: 'models/gemini-embedding-001' });
  const result = await model.embedContent(text);
  let values = result.embedding.values;
  // Slice to 768 dims to match the stored embeddings (ingestion pipeline does the same)
  if (values.length > 768) {
    values = values.slice(0, 768);
  }
  return values;
}

// ---------------------------------------------------------------------------
// In-memory FAISS-equivalent flat index
// ---------------------------------------------------------------------------

/** @type {{ meta: object, vector: Float32Array }[] | null} */
let indexCache = null;

/**
 * Computes cosine similarity between two equal-length float arrays.
 * Equivalent to FAISS IndexFlatIP after L2 normalisation.
 *
 * @param {number[] | Float32Array} a
 * @param {number[] | Float32Array} b
 * @returns {number} similarity in [-1, 1]
 */
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Loads all records from vet_kb, parses their embeddings, and builds the
 * in-memory flat index. Idempotent — calling it twice is a no-op.
 *
 * @returns {Promise<void>}
 */
async function initialize() {
  if (indexCache !== null) {
    return; // Already built — do not rebuild
  }

  console.log('[faissRetrieval] Initializing: loading embeddings from Supabase vet_kb...');

  const { data, error } = await supabase
    .from('vet_kb')
    .select(
      'id, embedding, title, species, breed, symptom_list, condition_tags, ' +
      'body_system, severity, concise_summary, full_text, source, source_url'
    );

  if (error) {
    throw new Error('[faissRetrieval] Failed to load vet_kb records: ' + error.message);
  }

  if (!data || data.length === 0) {
    throw new Error('[faissRetrieval] vet_kb is empty — no records to index.');
  }

  const index = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    if (!row.embedding) {
      console.warn('[faissRetrieval] Skipping record id=' + row.id + ' — embedding is null.');
      continue;
    }

    let vector;
    try {
      const parsed = typeof row.embedding === 'string'
        ? JSON.parse(row.embedding)
        : row.embedding;
      vector = new Float32Array(parsed);
    } catch (parseErr) {
      console.warn('[faissRetrieval] Skipping record id=' + row.id + ' — embedding parse failed:', parseErr.message);
      continue;
    }

    if (vector.length !== 768) {
      console.warn('[faissRetrieval] Skipping record id=' + row.id + ' — unexpected embedding dimension: ' + vector.length);
      continue;
    }

    index.push({
      vector,
      meta: {
        title:           row.title           || '',
        species:         row.species         || '',
        breed:           row.breed           || [],
        symptom_list:    row.symptom_list    || [],
        condition_tags:  row.condition_tags  || [],
        body_system:     row.body_system     || '',
        severity:        row.severity        || '',
        concise_summary: row.concise_summary || '',
        full_text:       row.full_text       || '',
        source:          row.source          || '',
        source_url:      row.source_url      || ''
      }
    });
  }

  if (index.length === 0) {
    throw new Error('[faissRetrieval] No valid embedding vectors found in vet_kb.');
  }

  indexCache = index;
  console.log('[faissRetrieval] Index ready: ' + indexCache.length + ' vectors loaded (dim=768).');
}

/**
 * Performs FAISS-equivalent dense vector retrieval.
 *
 * Workflow:
 *   User query → Gemini embedding → cosine similarity search → top-K results
 *
 * @param {string} query     The user query string.
 * @param {number} [limit=5] Number of top results to return.
 * @returns {Promise<Array<object>>} Veterinary records with relevance_score.
 */
async function retrieve(query, limit = 5) {
  if (!query || typeof query !== 'string') {
    return [];
  }

  // Ensure the index is built before querying
  await initialize();

  // Generate query embedding using the same Gemini model as ingestion
  let queryVector;
  try {
    queryVector = await getEmbedding(query);
  } catch (embErr) {
    console.error('[faissRetrieval] Embedding generation failed:', embErr.message);
    throw new Error('[faissRetrieval] Failed to embed query: ' + embErr.message);
  }

  // Score every indexed vector against the query vector (flat exhaustive search)
  const scored = indexCache.map(function(entry) {
    return {
      meta:            entry.meta,
      relevance_score: cosineSimilarity(queryVector, entry.vector)
    };
  });

  // Sort descending by score, take top-K
  scored.sort(function(a, b) {
    return b.relevance_score - a.relevance_score;
  });

  const topK = scored.slice(0, limit);

  // Return structured results — identical schema to bm25Retrieval.js
  return topK.map(function(item) {
    return {
      title:           item.meta.title,
      species:         item.meta.species,
      breed:           item.meta.breed,
      symptom_list:    item.meta.symptom_list,
      condition_tags:  item.meta.condition_tags,
      body_system:     item.meta.body_system,
      severity:        item.meta.severity,
      concise_summary: item.meta.concise_summary,
      full_text:       item.meta.full_text,
      source:          item.meta.source,
      source_url:      item.meta.source_url,
      relevance_score: item.relevance_score
    };
  });
}

module.exports = {
  initialize: initialize,
  retrieve:   retrieve
};

