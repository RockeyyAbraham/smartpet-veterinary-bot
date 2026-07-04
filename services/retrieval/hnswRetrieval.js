// Load environment variables for local testing and configuration
require('dotenv').config();

const supabaseJs = require('@supabase/supabase-js');
const googleGenAi = require('@google/generative-ai');
const ws = require('ws');

const createClient = supabaseJs.createClient;
const GoogleGenerativeAI = googleGenAi.GoogleGenerativeAI;

// ---------------------------------------------------------------------------
// NOTE: Unlike faissRetrieval.js, this module does NOT build an in-memory
// index. All vector search is delegated to Supabase pgvector, which uses the
// HNSW graph index created with:
//
//   CREATE INDEX ON vet_kb USING hnsw (embedding vector_cosine_ops);
//
// The HNSW index is invoked automatically by pgvector whenever the
// embedding <=> query_embedding cosine distance operator appears in a query.
// No explicit index hints are required.
//
// Advantage over faissRetrieval.js:
//   - No O(n) in-memory scan — HNSW search is O(log n) approximate.
//   - Scales to millions of records without increasing memory usage in Node.
//   - No initialize() step — the database is always ready.
//
// Trade-off:
//   - Approximate (not exact) nearest neighbor results.
//   - Requires a live Supabase connection for every query.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Supabase client — ws transport required for compatibility with Node 20
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Gemini embedding client (same model and dimensions used by ingestion pipeline)
// ---------------------------------------------------------------------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generates a 768-dimensional embedding vector for the given text using the
 * same Gemini model used during vet_kb ingestion.
 *
 * @param {string} text  The text to embed.
 * @returns {Promise<number[]>}  A 768-dimensional float array.
 */
async function getEmbedding(text) {
  try {
    const model = genAI.getGenerativeModel({ model: 'models/gemini-embedding-001' });
    const result = await model.embedContent(text);
    let values = result.embedding.values;
    // Slice to 768 dims to match the stored embeddings (ingestion pipeline does the same)
    if (values.length > 768) {
      values = values.slice(0, 768);
    }
    return values;
  } catch (err) {
    throw new Error('[hnswRetrieval] Failed to generate embedding: ' + err.message);
  }
}

/**
 * Performs HNSW approximate nearest neighbor retrieval via Supabase pgvector.
 *
 * Workflow:
 *   User query → Gemini embedding → Supabase RPC (HNSW index scan) → top-K results
 *
 * The match_vet_kb RPC function uses the cosine distance operator
 * (embedding <=> query_embedding) which automatically leverages the HNSW
 * index created on the vet_kb table.
 *
 * @param {string} query     The user query string.
 * @param {number} [limit=5] Number of top results to return.
 * @returns {Promise<Array<object>>} Veterinary records with relevance_score.
 */
async function retrieve(query, limit = 5) {
  if (!query || typeof query !== 'string') {
    return [];
  }

  try {
    // Generate query embedding using the same Gemini model as ingestion
    let queryEmbedding;
    try {
      queryEmbedding = await getEmbedding(query);
    } catch (embErr) {
      console.error('[hnswRetrieval] Embedding generation failed:', embErr.message);
      throw new Error('[hnswRetrieval] Failed to embed query: ' + embErr.message);
    }

    // Delegate vector search to pgvector's HNSW index via Supabase RPC
    const rpcResponse = await supabase.rpc('match_vet_kb', {
      query_embedding: queryEmbedding,
      match_count:     limit
    });

    const data  = rpcResponse.data;
    const error = rpcResponse.error;

    if (error) {
      console.error('[hnswRetrieval] Supabase RPC match_vet_kb failed:', error);
      throw new Error('[hnswRetrieval] Database retrieval error: ' + error.message);
    }

    if (!data) {
      return [];
    }

    // Map rows to the standard schema shared by faissRetrieval.js and bm25Retrieval.js
    return data.map(function(row) {
      return {
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
        source_url:      row.source_url      || '',
        relevance_score: typeof row.similarity === 'number'
          ? row.similarity
          : (typeof row.relevance_score === 'number' ? row.relevance_score : 0)
      };
    });
  } catch (err) {
    console.error('[hnswRetrieval] retrieve() failed:', err.message);
    throw err;
  }
}

module.exports = {
  retrieve: retrieve
};

