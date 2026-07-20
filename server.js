// Validate environment variables first
require('dotenv').config();

const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
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
const llmService = require('./services/llmService');
const memoryService = require('./services/memoryService');
const hybridRetrieval = require('./services/retrieval/hybridRetrieval');

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

    // Validate individually that required fields are present
    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }

    // 1. Load conversation history
    const history = memoryService.getHistory(sessionId);
    console.log('Conversation history loaded for session ' + sessionId);

    // 4. Retrieve general veterinary knowledge
    const vetKbResults = await hybridRetrieval.retrieve(message, 3);
    let vetKbContextString = "";
    if (vetKbResults && vetKbResults.length > 0) {
      const formattedKb = [];
      for (let i = 0; i < vetKbResults.length; i++) {
        const item = vetKbResults[i];
        formattedKb.push(`Title: ${item.title || 'Unknown'}\nInformation: ${item.full_text || item.concise_summary || ''}`);
      }
      vetKbContextString = formattedKb.join('\n---\n');
    }

    // 5. Build prompt passing vet KB context, user message, and history
    const finalPrompt = buildPrompt(vetKbContextString, message, history);

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

// Mount global error handler
app.use(globalErrorHandler);

// Initialize retrieval and start server
async function startServer() {
  try {
    await hybridRetrieval.initialize();
    console.log('Hybrid retrieval initialized');
  } catch (err) {
    console.error('Failed to initialize hybrid retrieval:', err);
  }
  
  app.listen(port, function() {
    console.log('Express server listening on port ' + port);
  });
}

startServer();
