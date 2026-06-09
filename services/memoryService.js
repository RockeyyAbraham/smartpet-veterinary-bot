// In-memory store to hold conversation histories by sessionId
const memoryStore = {};

/**
 * Returns the chat history array for a given session.
 * If the session does not exist, returns an empty array.
 * 
 * @param {string} sessionId The session identifier.
 * @returns {object[]} The array of chat history messages.
 */
function getHistory(sessionId) {
  try {
    if (!sessionId) {
      return [];
    }
    const history = memoryStore[sessionId];
    if (!history) {
      return [];
    }
    return history;
  } catch (error) {
    console.error('Error in getHistory memory operation:', error);
    return [];
  }
}

/**
 * Appends a message to the conversation history of a given session.
 * 
 * @param {string} sessionId The session identifier.
 * @param {'user'|'assistant'} role The sender's role.
 * @param {string} content The message text.
 */
function saveMessage(sessionId, role, content) {
  try {
    if (!sessionId) {
      return;
    }
    if (!memoryStore[sessionId]) {
      memoryStore[sessionId] = [];
    }
    const message = {
      role: role,
      content: content
    };
    memoryStore[sessionId].push(message);
  } catch (error) {
    console.error('Error in saveMessage memory operation:', error);
  }
}

/**
 * Clears the conversation history for a given session.
 * 
 * @param {string} sessionId The session identifier.
 */
function clearHistory(sessionId) {
  try {
    if (!sessionId) {
      return;
    }
    memoryStore[sessionId] = [];
  } catch (error) {
    console.error('Error in clearHistory memory operation:', error);
  }
}

module.exports = {
  getHistory: getHistory,
  saveMessage: saveMessage,
  clearHistory: clearHistory
};
