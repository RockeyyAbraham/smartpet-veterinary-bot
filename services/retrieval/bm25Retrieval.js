// Load environment variables for local testing and configuration
require('dotenv').config();

const supabaseJs = require('@supabase/supabase-js');
const ws = require('ws');

const createClient = supabaseJs.createClient;

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

/**
 * Performs BM25 (PostgreSQL Full Text Search) retrieval on the vet_kb table.
 *
 * @param {string} query The search query string.
 * @param {number} [limit=5] The top-K most relevant records to retrieve.
 * @returns {Promise<Array<object>>} A list of structured veterinary records with relevance scores.
 */
async function retrieve(query, limit = 5) {
  try {
    if (!query || typeof query !== 'string') {
      return [];
    }

    const { data, error } = await supabase.rpc('match_vet_kb_bm25', {
      query_text: query,
      match_count: limit
    });

    if (error) {
      console.error('BM25 retrieval RPC call failed:', error);
      throw new Error('BM25 retrieval database error: ' + error.message);
    }

    if (!data) {
      return [];
    }

    // Map rows to the structured output expected by future retrieval pipeline components
    return data.map(function(row) {
      return {
        title: row.title || '',
        species: row.species || '',
        breed: row.breed || [],
        symptom_list: row.symptom_list || [],
        condition_tags: row.condition_tags || [],
        body_system: row.body_system || '',
        severity: row.severity || '',
        concise_summary: row.concise_summary || '',
        full_text: row.full_text || '',
        source: row.source || '',
        source_url: row.source_url || '',
        relevance_score: typeof row.relevance_score === 'number' ? row.relevance_score : 0
      };
    });
  } catch (err) {
    console.error('Error executing BM25 retrieval:', err);
    throw err;
  }
}

module.exports = {
  retrieve: retrieve
};
