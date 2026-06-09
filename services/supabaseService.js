const supabaseJs = require('@supabase/supabase-js');
const googleGenAi = require('@google/generative-ai');
const ws = require('ws');

const createClient = supabaseJs.createClient;
const GoogleGenerativeAI = googleGenAi.GoogleGenerativeAI;

// Initialize Supabase Client with WebSocket compatibility for older Node versions
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

/**
 * Queries Supabase using match_pet_profiles RPC and returns a single concatenated context string.
 * Filters results to only include rows where metadata.petId matches the provided petId.
 * 
 * @param {string} query The query string to retrieve context for.
 * @param {string} petId The pet identifier to filter context by.
 * @returns {Promise<string>} The concatenated context string, or an empty string if no matches.
 */
async function retrievePetContext(query, petId) {
  try {
    const embedding = await getEmbedding(query);
    
    // We fetch up to 10 candidates to ensure we can find the matching chunks after filtering
    const rpcResponse = await supabase.rpc('match_pet_profiles', {
      match_count: 10,
      query_embedding: embedding
    });

    const data = rpcResponse.data;
    const error = rpcResponse.error;

    console.log('Supabase RAG response:', JSON.stringify(data));
    console.log('Supabase RAG error:', error);

    if (error) {
      throw new Error('Supabase RAG RPC Error: ' + error.message);
    }

    const contextTexts = [];
    if (data && data.length > 0) {
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row && row.metadata && String(row.metadata.petId) === String(petId)) {
          if (row.content) {
            contextTexts.push(row.content);
          }
        }
      }
    }

    if (contextTexts.length > 0) {
      return contextTexts.join('\n---\n');
    }

    return '';
  } catch (error) {
    console.error('Error in retrievePetContext:', error);
    throw error;
  }
}

module.exports = {
  retrievePetContext: retrievePetContext
};
