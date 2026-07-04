// Load environment variables for local testing and configuration
require('dotenv').config();

const cohereAi      = require('cohere-ai');
const faissRetrieval = require('./faissRetrieval');

const CohereClient = cohereAi.CohereClient;

// ---------------------------------------------------------------------------
// Validate required environment variables at import time
// ---------------------------------------------------------------------------
if (!process.env.COHERE_API_KEY) {
  throw new Error('[rerankRetrieval] Missing required environment variable: COHERE_API_KEY');
}

// ---------------------------------------------------------------------------
// Cohere client — used solely for cross-encoder reranking
// ---------------------------------------------------------------------------
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY
});

// ---------------------------------------------------------------------------
// Configuration constants
// ---------------------------------------------------------------------------

/**
 * Number of FAISS candidates fetched in Stage 1 before reranking.
 * A larger pool increases recall at the cost of more Cohere API tokens.
 * Rule of thumb: 2–4× the expected final limit.
 * Adjust upward as vet_kb grows beyond a few hundred records.
 */
const CANDIDATE_POOL_SIZE = 10;

/**
 * Preloads FAISS dense vectors into memory.
 * Must be called before the first retrieve() call so that faissRetrieval
 * does not incur cold-start latency during the first query.
 *
 * @returns {Promise<void>}
 */
async function initialize() {
  try {
    await faissRetrieval.initialize();
    console.log('[rerankRetrieval] Reranker ready — FAISS index loaded, Cohere reranker standing by.');
  } catch (err) {
    console.error('[rerankRetrieval] initialize() failed:', err.message);
    throw err;
  }
}

/**
 * Performs two-stage retrieval:
 *   Stage 1 — FAISS dense retrieval (CANDIDATE_POOL_SIZE candidates via cosine similarity)
 *   Stage 2 — Cohere cross-encoder reranking (re-scores and reorders top-N)
 *
 * Why two stages?
 *   FAISS bi-encoder retrieval is fast but uses independent query/document
 *   embeddings. The Cohere cross-encoder sees both query and document together,
 *   producing more accurate relevance scores at the cost of higher latency.
 *   Fetching CANDIDATE_POOL_SIZE candidates before trimming to limit is a
 *   standard heuristic that balances recall and reranker cost.
 *
 * Output schema additions vs. other retrieval modules:
 *   relevance_score — Cohere cross-encoder score in [0, 1] (primary sort key)
 *   faiss_score     — original FAISS cosine similarity score (for evaluation)
 *
 * @param {string} query     The user query string.
 * @param {number} [limit=5] Number of top results to return after reranking.
 * @returns {Promise<Array<object>>} Reranked veterinary records with both scores.
 */
async function retrieve(query, limit = 5) {
  if (!query || typeof query !== 'string') {
    return [];
  }

  try {
    // ------------------------------------------------------------------
    // Stage 1: FAISS bi-encoder retrieval — fetch 2× candidates
    // ------------------------------------------------------------------
    let candidates = [];
    try {
      candidates = await faissRetrieval.retrieve(query, CANDIDATE_POOL_SIZE);
    } catch (faissErr) {
      console.error('[rerankRetrieval] FAISS retrieval failed:', faissErr.message);
      throw new Error('[rerankRetrieval] Stage 1 (FAISS) failed: ' + faissErr.message);
    }

    if (candidates.length === 0) {
      return [];
    }

    // Build the documents array for Cohere — one plain string per candidate.
    // Cohere rerank expects an array of strings or { text: string } objects.
    // We use full_text as the document body (most content-rich field).
    const documents = candidates.map(function(candidate) {
      return candidate.full_text || candidate.concise_summary || candidate.title;
    });

    // ------------------------------------------------------------------
    // Stage 2: Cohere cross-encoder reranking
    // ------------------------------------------------------------------
    let rerankResponse;
    try {
      rerankResponse = await cohere.rerank({
        model:     'rerank-english-v3.0',
        query:     query,
        documents: documents,
        topN:      limit
      });
    } catch (cohereErr) {
      console.error('[rerankRetrieval] Cohere rerank API call failed:', cohereErr.message);
      throw new Error('[rerankRetrieval] Stage 2 (Cohere rerank) failed: ' + cohereErr.message);
    }

    const rerankResults = rerankResponse.results;

    if (!rerankResults || rerankResults.length === 0) {
      return [];
    }

    // ------------------------------------------------------------------
    // Map reranked results back to original candidate objects.
    // Each result item contains:
    //   .index          — the position in the original documents[] array
    //   .relevanceScore — Cohere's cross-encoder score in [0, 1]
    // ------------------------------------------------------------------
    return rerankResults.map(function(item) {
      const original = candidates[item.index];
      return {
        title:           original.title           || '',
        species:         original.species         || '',
        breed:           original.breed           || [],
        symptom_list:    original.symptom_list    || [],
        condition_tags:  original.condition_tags  || [],
        body_system:     original.body_system     || '',
        severity:        original.severity        || '',
        concise_summary: original.concise_summary || '',
        full_text:       original.full_text       || '',
        source:          original.source          || '',
        source_url:      original.source_url      || '',
        relevance_score: item.relevanceScore,
        faiss_score:     original.relevance_score
      };
    });
  } catch (err) {
    console.error('[rerankRetrieval] retrieve() failed:', err.message);
    throw err;
  }
}

module.exports = {
  initialize: initialize,
  retrieve:   retrieve
};

