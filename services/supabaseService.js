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
 * Limits retrieval to the top 3 chunks.
 * 
 * @param {string} query The query string to retrieve context for.
 * @returns {Promise<string>} The concatenated context string.
 */
async function retrievePetContext(query) {
  try {
    const embedding = await getEmbedding(query);
    
    const rpcResponse = await supabase.rpc('match_pet_profiles', {
      match_count: 3,
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
        if (row && row.content) {
          contextTexts.push(row.content);
        }
      }
    }

    if (contextTexts.length > 0) {
      return contextTexts.join('\n---\n');
    }

    return 'No relevant pet profile context found.';
  } catch (error) {
    console.error('Error in retrievePetContext:', error);
    throw error;
  }
}

module.exports = {
  retrievePetContext: retrievePetContext
};
