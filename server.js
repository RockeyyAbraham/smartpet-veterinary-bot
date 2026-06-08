// Validate environment variables first
require('dotenv').config();

const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'GEMINI_API_KEY',
  'GROQ_API_KEY'
];

for (let i = 0; i < requiredEnvVars.length; i++) {
  const envVar = requiredEnvVars[i];
  if (!process.env[envVar]) {
    console.error('CRITICAL ERROR: Missing required environment variable ' + envVar);
    process.exit(1);
  }
}

const express = require('express');
const supabaseJs = require('@supabase/supabase-js');
const googleGenAi = require('@google/generative-ai');
const Groq = require('groq-sdk');
const ws = require('ws');
const buildPrompt = require('./prompt');

const createClient = supabaseJs.createClient;
const GoogleGenerativeAI = googleGenAi.GoogleGenerativeAI;

// Initialize clients
const app = express();
app.use(express.json());

const supabaseOptions = {
  realtime: {
    transport: ws
  }
};
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, supabaseOptions);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const port = process.env.PORT || 5000;

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
 * Queries the Supabase vector store function 'match_pet_profiles' with the query embedding.
 * Retrieves top matching rows.
 * 
 * @param {number[]} embedding The 3072-dimensional vector embedding.
 * @returns {Promise<object[]>} The array of matching database records.
 */
async function queryVectorStore(embedding) {
  // We fetch up to 10 candidates to ensure that after filtering by petId in JS,
  // we still have a good chance of finding the top 3 matching chunks for that pet.
  const rpcResponse = await supabase.rpc('match_pet_profiles', {
    match_count: 10,
    query_embedding: embedding
  });

  if (rpcResponse.error) {
    throw new Error('Supabase RPC Error: ' + rpcResponse.error.message);
  }

  return rpcResponse.data;
}

/**
 * Filters chunks to keep only those belonging to the given petId, and limits results to top 3.
 * 
 * @param {object[]} chunks The array of chunk records retrieved from the database.
 * @param {string} petId The pet identifier to filter by (optional).
 * @returns {object[]} The filtered and limited chunks.
 */
function filterAndLimitChunks(chunks, petId) {
  const filtered = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    if (petId) {
      const chunkId = String(chunk.id);
      let metadataPetId = '';
      
      if (chunk.metadata && chunk.metadata.pet_id) {
        metadataPetId = String(chunk.metadata.pet_id);
      } else if (chunk.metadata && chunk.metadata.petId) {
        metadataPetId = String(chunk.metadata.petId);
      }
      
      // Keep chunk if it matches the petId by row id or metadata pet_id
      if (chunkId === String(petId) || metadataPetId === String(petId)) {
        filtered.push(chunk);
      }
    } else {
      // If no petId filter is requested, include all chunks
      filtered.push(chunk);
    }
    
    if (filtered.length === 3) {
      break;
    }
  }
  
  return filtered;
}

/**
 * Queries Groq using llama-3.3-70b-versatile with the compiled prompt.
 * 
 * @param {string} promptText The fully formatted prompt.
 * @returns {Promise<string>} The generated message response.
 */
async function queryGroq(promptText) {
  const chatCompletion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'user',
        content: promptText
      }
    ]
  });

  const choices = chatCompletion.choices;
  if (choices && choices.length > 0) {
    const firstChoice = choices[0];
    const choiceMessage = firstChoice.message;
    if (choiceMessage && choiceMessage.content) {
      return choiceMessage.content;
    }
  }

  throw new Error('Empty response returned from Groq SDK.');
}

/**
 * POST /api/chat route handler.
 */
async function handleChatRequest(req, res) {
  try {
    const message = req.body.message;
    const petId = req.body.petId;

    if (!message) {
      res.status(400).json({ error: 'Required field: "message" is missing.' });
      return;
    }

    // 1. Generate text embedding
    const embedding = await getEmbedding(message);

    // 2. Query Supabase vector store RPC function
    const chunks = await queryVectorStore(embedding);

    // 3. Filter by petId and limit to top 3 chunks
    const matchedChunks = filterAndLimitChunks(chunks, petId);

    // 4. Format the retrieved context
    const contextTexts = [];
    for (let i = 0; i < matchedChunks.length; i++) {
      contextTexts.push(matchedChunks[i].content);
    }

    let retrievedContext = '';
    if (contextTexts.length > 0) {
      retrievedContext = contextTexts.join('\n---\n');
    } else {
      retrievedContext = 'No relevant pet profile context found.';
    }

    // 5. Inject retrieved context and message into prompt template
    const finalPrompt = buildPrompt(retrievedContext, message);

    // 6. Send compilation to Groq and retrieve answer
    const responseText = await queryGroq(finalPrompt);

    // 7. Send back the response JSON
    res.json({ response: responseText });

  } catch (error) {
    console.error('Error in /api/chat endpoint:', error);
    res.status(500).json({
      error: error.message || 'Internal Server Error'
    });
  }
}

// Define routes
app.post('/api/chat', handleChatRequest);

// Start server
app.listen(port, function() {
  console.log('Express server listening on port ' + port);
});
