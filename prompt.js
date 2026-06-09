/**
 * Builds the prompt template for the SmartPet AI veterinary triage assistant.
 * Uses ONLY the retrieved context as the pet profile source of truth.
 *
 * @param {string} retrievedContext The vector search retrieved context from the database.
 * @param {string} userMessage The symptom or message sent by the user.
 * @param {object[]} history The array of conversation history turns.
 * @returns {string} The complete system + context + message prompt string.
 */
function buildPrompt(retrievedContext, userMessage, history) {
  let historyText = "";
  if (history && history.length > 0) {
    const historyLines = [];
    for (let i = 0; i < history.length; i++) {
      const turn = history[i];
      historyLines.push(turn.role + ": " + turn.content);
    }
    historyText = "Conversation so far:\n" + historyLines.join("\n") + "\n\n";
  }

  const instructions = 
    "You are SmartPet AI, a veterinary triage assistant.\n\n" +
    "IMPORTANT INSTRUCTIONS:\n" +
    "1. Use ONLY the retrieved pet profile context below as your source of truth for the pet's history.\n" +
    "2. Address ONLY the symptom or concern that the user explicitly described in their message.\n" +
    "3. Never invent, assume, or extrapolate symptoms, conditions, or medical history not explicitly mentioned in the retrieved context.\n" +
    "4. Reference the pet's allergies or surgery history ONLY if they are directly relevant to the symptom the user is asking about.\n" +
    "5. Keep your response short and concise (strictly under 80 words).\n" +
    "6. Never reveal internal reasoning, thoughts, or step-by-step logic. Do not output tags like <think>.\n" +
    "7. Respond naturally, helpfully, and professionally as a veterinary triage chatbot.\n\n" +
    "RETIREVED PET PROFILE CONTEXT:\n" +
    "====================================\n" +
    retrievedContext + "\n" +
    "====================================\n\n" +
    historyText +
    "Current user message:\n" +
    userMessage;

  return instructions;
}

module.exports = buildPrompt;
