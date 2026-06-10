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
const ws = require('ws'); // Keep WebSocket fix for compatibility
const buildPrompt = require('./prompt');

// Import services without destructuring
const supabaseService = require('./services/supabaseService');
const llmService = require('./services/llmService');
const memoryService = require('./services/memoryService');
const ingestionService = require('./services/ingestionService');

// Initialize server
const app = express();
app.use(express.json());

/**
 * Custom error handler to catch SyntaxError on invalid JSON payloads.
 */
function jsonErrorHandler(err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('SyntaxError: Invalid JSON payload received');
    res.status(400).json({ error: 'Invalid JSON payload' });
    return;
  }
  next(err);
}
app.use(jsonErrorHandler);

const port = process.env.PORT || 5000;

/**
 * POST /api/chat route handler.
 */
async function handleChatRequest(req, res) {
  try {
    const message = req.body.message;
    const sessionId = req.body.sessionId;
    const petId = req.body.petId;

    // Validate individually that required fields are present
    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }
    if (!petId) {
      res.status(400).json({ error: 'petId is required' });
      return;
    }

    // 1. Load conversation history
    const history = memoryService.getHistory(sessionId);
    console.log('Conversation history loaded for session ' + sessionId);

    // 2. Retrieve pet context from Supabase using petId
    const retrievedContext = await supabaseService.retrievePetContext(message, petId);

    // 3. If context is empty, return early with message
    if (retrievedContext === '') {
      res.json({ response: 'No pet profile found for the provided petId. Please check your pet ID.' });
      return;
    }

    // 4. Build prompt passing retrieved context, user message, and history
    const finalPrompt = buildPrompt(retrievedContext, message, history);

    // 5. Call Groq with built prompt
    const responseText = await llmService.generateResponse(finalPrompt);

    // 6. Save user message to memory
    memoryService.saveMessage(sessionId, 'user', message);

    // 7. Save assistant response to memory
    memoryService.saveMessage(sessionId, 'assistant', responseText);

    // 8. Return response
    res.json({ response: responseText });

  } catch (error) {
    console.error('Error in /api/chat endpoint:', error);
    res.status(500).json({
      error: 'Internal Server Error'
    });
  }
}

/**
 * POST /api/ingest route handler.
 */
async function handleIngestRequest(req, res) {
  try {
    const petData = req.body;
    
    if (!petData) {
      res.status(400).json({ error: 'Pet profile data is required in the request body.' });
      return;
    }
    if (!petData.name) {
      res.status(400).json({ error: 'Required field: "name" is missing.' });
      return;
    }
    if (!petData.petId) {
      res.status(400).json({ error: 'Required field: "petId" is missing.' });
      return;
    }

    // Call ingestion service
    await ingestionService.ingestPetProfile(petData);
    
    res.json({ success: true });

  } catch (error) {
    console.error('Error in /api/ingest endpoint:', error);
    res.status(500).json({
      error: 'Internal Server Error'
    });
  }
}

/**
 * Global Express error handling middleware.
 */
function globalErrorHandler(err, req, res, next) {
  console.error('Unhandled global application error:', err);
  res.status(500).json({
    error: 'Internal Server Error'
  });
}

// Define routes
app.post('/api/chat', handleChatRequest);
app.post('/api/ingest', handleIngestRequest);

// Mount global error handler
app.use(globalErrorHandler);

// Start server
app.listen(port, function() {
  console.log('Express server listening on port ' + port);
});
