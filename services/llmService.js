const Groq = require('groq-sdk');

// Initialize Groq Client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Queries Groq using llama-3.3-70b-versatile with the compiled prompt.
 * 
 * @param {string} promptText The fully formatted prompt.
 * @returns {Promise<string>} The generated message response.
 */
async function generateResponse(promptText) {
  try {
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
  } catch (error) {
    console.error('Groq generateResponse API call failed:', error);
    throw new Error('Failed to generate LLM response');
  }
}

module.exports = {
  generateResponse: generateResponse
};
