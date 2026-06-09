const supabaseJs = require('@supabase/supabase-js');
const googleGenAi = require('@google/generative-ai');
const ws = require('ws');

const createClient = supabaseJs.createClient;
const GoogleGenerativeAI = googleGenAi.GoogleGenerativeAI;

// Initialize Supabase Client
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
 * Formats pet profile data into a single readable string, embeds it, and upserts the result.
 * 
 * @param {object} petData The pet profile fields.
 * @returns {Promise<boolean>} True on success.
 */
async function ingestPetProfile(petData) {
  try {
    const name = petData.name;
    const breed = petData.breed;
    const age = petData.age;
    const weight = petData.weight;
    const allergies = petData.allergies;
    const medicalHistory = petData.medicalHistory;
    const food = petData.food;
    const feedingSchedule = petData.feedingSchedule;
    const hygiene = petData.hygiene;
    const petId = petData.petId;

    // Format fields into a structured text string
    const content = 
      "Name: " + name + "\n" +
      "Breed: " + breed + "\n" +
      "Age: " + age + "\n" +
      "Weight: " + weight + "\n" +
      "Allergies: " + allergies + "\n" +
      "Medical History: " + medicalHistory + "\n" +
      "Food: " + food + "\n" +
      "Feeding Schedule: " + feedingSchedule + "\n" +
      "Hygiene: " + hygiene;

    // Generate embedding
    const embedding = await getEmbedding(content);

    const insertRow = {
      content: content,
      metadata: {
        petId: petId
      },
      embedding: embedding
    };

    // Check if profile with the given petId already exists in the database
    let existingId = null;
    if (petId) {
      const selectResponse = await supabase
        .from('pet_profiles')
        .select('id')
        .eq('metadata->>petId', petId);

      const selectData = selectResponse.data;
      if (selectData && selectData.length > 0) {
        existingId = selectData[0].id;
      }
    }

    if (existingId) {
      // Update existing record
      const updateResponse = await supabase
        .from('pet_profiles')
        .update(insertRow)
        .eq('id', existingId);

      if (updateResponse.error) {
        throw new Error('Supabase Profile Update Error: ' + updateResponse.error.message);
      }
    } else {
      // Insert new record
      const insertResponse = await supabase
        .from('pet_profiles')
        .insert([insertRow]);

      if (insertResponse.error) {
        throw new Error('Supabase Profile Insert Error: ' + insertResponse.error.message);
      }
    }

    return true;
  } catch (error) {
    console.error('ingestPetProfile operation failed:', error);
    throw new Error('Failed to ingest pet profile');
  }
}

module.exports = {
  ingestPetProfile: ingestPetProfile
};
