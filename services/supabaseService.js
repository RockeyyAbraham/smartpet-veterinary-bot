const supabaseJs = require('@supabase/supabase-js');
const ws = require('ws');
const embeddingService = require('./embeddingService');

const createClient = supabaseJs.createClient;
const getEmbedding = embeddingService.getEmbedding;

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
    let embedding;
    try {
      embedding = await getEmbedding(query);
    } catch (embeddingError) {
      console.error('Embedding step failed inside retrievePetContext:', embeddingError);
      throw embeddingError;
    }
    
    let rpcResponse;
    try {
      // We fetch up to 10 candidates to ensure we can find the matching chunks after filtering
      rpcResponse = await supabase.rpc('match_pet_profiles', {
        match_count: 10,
        query_embedding: embedding
      });
    } catch (rpcCallError) {
      console.error('Supabase RPC network call failed:', rpcCallError);
      throw new Error('Failed to retrieve pet context');
    }

    const data = rpcResponse.data;
    const error = rpcResponse.error;

    console.log('Supabase RAG response:', JSON.stringify(data));
    console.log('Supabase RAG error:', error);

    if (error) {
      console.error('Supabase RPC returned database error:', error);
      throw new Error('Failed to retrieve pet context');
    }

    const contextTexts = [];
    if (data && data.length > 0) {
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row) {
          let isMatch = false;
          const targetPetId = String(petId);
          
          if (row.metadata && row.metadata.petId) {
            const rowPetId = String(row.metadata.petId);
            if (rowPetId.toLowerCase() === targetPetId.toLowerCase()) {
              isMatch = true;
            }
          }
          
          if (!isMatch) {
            if (String(row.id) === targetPetId) {
              isMatch = true;
            } else {
              const targetDigits = targetPetId.replace(/\D/g, '');
              if (targetDigits && parseInt(targetDigits, 10) === row.id) {
                isMatch = true;
              }
            }
          }

          if (isMatch) {
            if (row.content) {
              contextTexts.push(row.content);
            }
          }
        }
      }
    }

    if (contextTexts.length > 0) {
      return contextTexts.join('\n---\n');
    }

    return '';
  } catch (error) {
    console.error('retrievePetContext failed:', error);
    throw error;
  }
}

module.exports = {
  retrievePetContext: retrievePetContext
};
