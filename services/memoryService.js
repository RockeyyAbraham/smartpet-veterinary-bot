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
  if (!sessionId) {
    return [];
  }
  const history = memoryStore[sessionId];
  if (!history) {
    return [];
  }
  return history;
}

/**
 * Appends a message to the conversation history of a given session.
 * 
 * @param {string} sessionId The session identifier.
 * @param {'user'|'assistant'} role The sender's role.
 * @param {string} content The message text.
 */
function saveMessage(sessionId, role, content) {
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
}

/**
 * Clears the conversation history for a given session.
 * 
 * @param {string} sessionId The session identifier.
 */
function clearHistory(sessionId) {
  if (!sessionId) {
    return;
  }
  memoryStore[sessionId] = [];
}

module.exports = {
  getHistory: getHistory,
  saveMessage: saveMessage,
  clearHistory: clearHistory
};
