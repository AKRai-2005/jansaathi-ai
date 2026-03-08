import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient } from '../config/aws.js';
import dotenv from 'dotenv';

dotenv.config();

const EMBEDDING_MODEL_ID = process.env.BEDROCK_EMBEDDING_MODEL_ID || 'amazon.titan-embed-text-v2:0';
const VECTOR_DIMENSION = 1024;
const MAX_INPUT_LENGTH = 8192; // Token limit for Titan Embeddings v2
const MAX_RETRIES = 3;
const BATCH_THRESHOLD = 5;

class EmbeddingService {
  constructor() {
    this.modelId = EMBEDDING_MODEL_ID;
    this.dimension = VECTOR_DIMENSION;
    this.maxRetries = MAX_RETRIES;
  }

  /**
   * Normalize text input by cleaning whitespace and limiting length
   * @param {string} text - Input text
   * @returns {string} Normalized text
   */
  normalizeText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    // Remove excessive whitespace
    let normalized = text
      .replace(/\s+/g, ' ')
      .replace(/[\r\n]+/g, ' ')
      .trim();

    // Limit to approximate token count (roughly 4 chars per token)
    const maxChars = MAX_INPUT_LENGTH * 4;
    if (normalized.length > maxChars) {
      normalized = normalized.substring(0, maxChars);
      console.log(`⚠️  Text truncated to ${maxChars} characters`);
    }

    return normalized;
  }

  /**
   * Generate embedding for a single text using Bedrock Titan Embeddings v2
   * @param {string} text - Input text
   * @returns {Promise<Array<number>>} 1024-dimension vector
   */
  async generateEmbedding(text) {
    const normalizedText = this.normalizeText(text);
    
    if (!normalizedText) {
      throw new Error('Cannot generate embedding for empty text');
    }

    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔢 Generating embedding (attempt ${attempt}/${this.maxRetries})...`);
        const startTime = Date.now();

        const command = new InvokeModelCommand({
          modelId: this.modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify({
            inputText: normalizedText,
            dimensions: this.dimension,
            normalize: true,
          }),
        });

        const response = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const embedding = responseBody.embedding;

        // Validate dimension
        if (embedding.length !== this.dimension) {
          throw new Error(`Unexpected embedding dimension: ${embedding.length}`);
        }

        const elapsedTime = Date.now() - startTime;
        console.log(`✅ Embedding generated in ${elapsedTime}ms (${this.dimension} dimensions)`);

        return embedding;
      } catch (error) {
        lastError = error;
        console.error(`❌ Embedding attempt ${attempt} failed:`, error.message);

        if (attempt < this.maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 500;
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    console.error('❌ All embedding attempts failed:', lastError?.message);
    throw new Error(`Embedding generation failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Generate embeddings for multiple texts in batch
   * @param {Array<string>} texts - Array of input texts
   * @returns {Promise<Array<Array<number>>>} Array of embeddings
   */
  async generateEmbeddingsBatch(texts) {
    if (!texts || texts.length === 0) {
      return [];
    }

    console.log(`📦 Processing batch of ${texts.length} texts`);
    const startTime = Date.now();

    // If fewer than threshold, process sequentially
    if (texts.length < BATCH_THRESHOLD) {
      const embeddings = [];
      for (const text of texts) {
        const embedding = await this.generateEmbedding(text);
        embeddings.push(embedding);
      }
      return embeddings;
    }

    // For larger batches, process in parallel with concurrency limit
    const concurrencyLimit = 5;
    const embeddings = new Array(texts.length);
    const errors = [];

    for (let i = 0; i < texts.length; i += concurrencyLimit) {
      const batch = texts.slice(i, i + concurrencyLimit);
      const promises = batch.map(async (text, index) => {
        try {
          const embedding = await this.generateEmbedding(text);
          embeddings[i + index] = embedding;
        } catch (error) {
          errors.push({ index: i + index, error: error.message });
          embeddings[i + index] = null;
        }
      });

      await Promise.all(promises);
      console.log(`📊 Processed ${Math.min(i + concurrencyLimit, texts.length)}/${texts.length} texts`);
    }

    const elapsedTime = Date.now() - startTime;
    const successCount = embeddings.filter((e) => e !== null).length;
    console.log(`✅ Batch complete in ${elapsedTime}ms: ${successCount}/${texts.length} successful`);

    if (errors.length > 0) {
      console.warn(`⚠️  ${errors.length} texts failed to generate embeddings`);
    }

    return embeddings;
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {Array<number>} vectorA - First vector
   * @param {Array<number>} vectorB - Second vector
   * @returns {number} Similarity score (0-1)
   */
  cosineSimilarity(vectorA, vectorB) {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Get embedding dimension
   * @returns {number} Vector dimension
   */
  getDimension() {
    return this.dimension;
  }

  /**
   * Get model ID
   * @returns {string} Model identifier
   */
  getModelId() {
    return this.modelId;
  }
}

// Export singleton instance
export default new EmbeddingService();
