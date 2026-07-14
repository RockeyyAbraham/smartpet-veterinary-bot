const path = require('path');
const { pipeline } = require('@huggingface/transformers');

// ---------------------------------------------------------------------------
// Local fine-tuned model — dorrito-dev/all-MiniLM-L6-v2-dog-breed-retriever
//
// The model was exported to ONNX using the legacy TorchScript exporter
// (export_onnx.py in the model directory). The onnx/model.onnx file lives at:
//   services/all-MiniLM-L6-v2-dog-breed-retriever/onnx/model.onnx
//
// @huggingface/transformers loads the model from this local path, applies
// mean-pooling + L2 normalisation in JS, and returns 384-dimensional vectors.
//
// No internet access, no API token required after the ONNX file is present.
// ---------------------------------------------------------------------------
const MODEL_PATH = path.resolve(
  __dirname,
  'all-MiniLM-L6-v2-dog-breed-retriever'
);

/** @type {import('@huggingface/transformers').FeatureExtractionPipeline | null} */
let pipelineInstance = null;

/**
 * Returns (and lazily initialises) the singleton feature-extraction pipeline.
 *
 * Creating the pipeline loads tokenizer + ONNX weights into memory once per
 * process. All subsequent calls reuse the cached instance.
 *
 * @returns {Promise<import('@huggingface/transformers').FeatureExtractionPipeline>}
 */
async function getPipeline() {
  if (!pipelineInstance) {
    console.log('[embeddingService] Loading local ONNX model from:', MODEL_PATH);
    pipelineInstance = await pipeline('feature-extraction', MODEL_PATH, {
      pooling: 'mean',
      normalize: true,
      local_files_only: true,   // never try to download — use local ONNX only
    });
    console.log('[embeddingService] Model loaded successfully.');
  }
  return pipelineInstance;
}

/**
 * Generates a 384-dimensional embedding vector for the given text using the
 * fine-tuned all-MiniLM-L6-v2 model.
 *
 * Output properties:
 *  - Dimension : 384
 *  - Pooling   : mean-pooling over token embeddings
 *  - Normalised: L2-normalised (cosine similarity == dot product)
 *
 * @param {string} text - The text to embed.
 * @returns {Promise<number[]>} A 384-dimensional float array.
 */
async function getEmbedding(text) {
  try {
    const extractor = await getPipeline();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    // output.data is a Float32Array; convert to plain number[] for Supabase
    return Array.from(output.data);
  } catch (error) {
    console.error('[embeddingService] Embedding generation failed:', error.message || error);
    throw new Error('Failed to generate embedding: ' + (error.message || error));
  }
}

module.exports = {
  getEmbedding: getEmbedding
};
