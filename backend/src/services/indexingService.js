import embeddingService from './embeddingService.js';
import vectorStoreClient from './vectorStoreClient.js';
import { schemes as SCHEMES } from '../utils/schemeData.js';
import dotenv from 'dotenv';

dotenv.config();

class IndexingService {
  constructor() {
    this.schemePrefix = 'scheme_';
    this.isInitialized = false;
  }

  /**
   * Initialize the indexing service
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      await vectorStoreClient.initialize();
      this.isInitialized = true;
      console.log('✅ IndexingService initialized');
    } catch (error) {
      console.error('❌ IndexingService initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Create text representation of a scheme for embedding
   * @param {Object} scheme - Scheme object
   * @returns {string} Text representation
   */
  createSchemeText(scheme) {
    const parts = [
      `Scheme Name: ${scheme.name}`,
      scheme.nameHindi ? `Hindi Name: ${scheme.nameHindi}` : null,
      `Description: ${scheme.description}`,
      `Category: ${scheme.category}`,
    ];

    // Add eligibility criteria
    if (scheme.eligibility) {
      const eligibilityParts = [];
      if (scheme.eligibility.ageMin || scheme.eligibility.ageMax) {
        eligibilityParts.push(
          `Age: ${scheme.eligibility.ageMin || 'any'} to ${scheme.eligibility.ageMax || 'any'}`
        );
      }
      if (scheme.eligibility.states && scheme.eligibility.states.length > 0) {
        eligibilityParts.push(`States: ${scheme.eligibility.states.join(', ')}`);
      }
      if (scheme.eligibility.occupations && scheme.eligibility.occupations.length > 0) {
        eligibilityParts.push(`Occupations: ${scheme.eligibility.occupations.join(', ')}`);
      }
      if (scheme.eligibility.incomeMax) {
        eligibilityParts.push(`Maximum Income: ₹${scheme.eligibility.incomeMax}`);
      }
      if (scheme.eligibility.caste && scheme.eligibility.caste.length > 0) {
        eligibilityParts.push(`Caste Categories: ${scheme.eligibility.caste.join(', ')}`);
      }
      if (scheme.eligibility.bplRequired) {
        eligibilityParts.push('BPL Card Required');
      }
      if (scheme.eligibility.landMax) {
        eligibilityParts.push(`Maximum Land: ${scheme.eligibility.landMax} acres`);
      }

      if (eligibilityParts.length > 0) {
        parts.push(`Eligibility: ${eligibilityParts.join('; ')}`);
      }
    }

    // Add benefits
    if (scheme.benefits && scheme.benefits.length > 0) {
      parts.push(`Benefits: ${scheme.benefits.join('; ')}`);
    }

    // Add benefit amount
    if (scheme.benefitAmount) {
      parts.push(`Benefit Amount: ₹${scheme.benefitAmount} per year`);
    }

    // Add application process
    if (scheme.applicationProcess) {
      parts.push(`Application Process: ${scheme.applicationProcess}`);
    }

    // Add required documents
    if (scheme.requiredDocuments && scheme.requiredDocuments.length > 0) {
      parts.push(`Required Documents: ${scheme.requiredDocuments.join(', ')}`);
    }

    return parts.filter(Boolean).join('\n');
  }

  /**
   * Index a single scheme
   * @param {Object} scheme - Scheme object
   * @returns {Promise<boolean>} Success status
   */
  async indexScheme(scheme) {
    if (!vectorStoreClient.isReady()) {
      console.warn('⚠️  VectorStore not ready, skipping indexing');
      return false;
    }

    try {
      const documentId = `${this.schemePrefix}${scheme.schemeId}`;
      const text = this.createSchemeText(scheme);
      
      console.log(`📝 Indexing scheme: ${scheme.name}`);
      const embedding = await embeddingService.generateEmbedding(text);

      await vectorStoreClient.insertVector({
        documentId,
        documentType: 'scheme',
        embedding,
        content: text,
        metadata: {
          schemeId: scheme.schemeId,
          schemeName: scheme.name,
          category: scheme.category,
          benefitAmount: scheme.benefitAmount,
          officialWebsite: scheme.officialWebsite,
        },
      });

      return true;
    } catch (error) {
      console.error(`❌ Failed to index scheme ${scheme.name}:`, error.message);
      return false;
    }
  }

  /**
   * Index all schemes from schemeData
   * @returns {Promise<Object>} Indexing results
   */
  async indexAllSchemes() {
    await this.initialize();

    if (!vectorStoreClient.isReady()) {
      console.warn('⚠️  VectorStore not ready, skipping bulk indexing');
      return { total: 0, success: 0, failed: 0 };
    }

    console.log(`📦 Starting bulk indexing of ${SCHEMES.length} schemes...`);
    const startTime = Date.now();

    let success = 0;
    let failed = 0;

    // Generate all scheme texts
    const schemeData = SCHEMES.map((scheme) => ({
      scheme,
      text: this.createSchemeText(scheme),
    }));

    // Generate embeddings in batch
    const texts = schemeData.map((s) => s.text);
    const embeddings = await embeddingService.generateEmbeddingsBatch(texts);

    // Prepare documents for bulk insert
    const documents = [];
    for (let i = 0; i < SCHEMES.length; i++) {
      if (embeddings[i]) {
        documents.push({
          documentId: `${this.schemePrefix}${SCHEMES[i].schemeId}`,
          documentType: 'scheme',
          embedding: embeddings[i],
          content: schemeData[i].text,
          metadata: {
            schemeId: SCHEMES[i].schemeId,
            schemeName: SCHEMES[i].name,
            category: SCHEMES[i].category,
            benefitAmount: SCHEMES[i].benefitAmount,
            officialWebsite: SCHEMES[i].officialWebsite,
          },
        });
      } else {
        failed++;
      }
    }

    // Bulk insert
    if (documents.length > 0) {
      try {
        success = await vectorStoreClient.bulkInsertVectors(documents);
        failed += documents.length - success;
      } catch (error) {
        console.error('❌ Bulk insert failed:', error.message);
        failed = SCHEMES.length;
        success = 0;
      }
    }

    const elapsedTime = Date.now() - startTime;
    console.log(`✅ Indexing complete in ${elapsedTime}ms: ${success} success, ${failed} failed`);

    return {
      total: SCHEMES.length,
      success,
      failed,
      elapsedTime,
    };
  }

  /**
   * Update a specific scheme's vector
   * @param {Object} scheme - Updated scheme object
   * @returns {Promise<boolean>} Success status
   */
  async updateScheme(scheme) {
    return this.indexScheme(scheme); // Re-indexing effectively updates
  }

  /**
   * Delete all scheme vectors
   * @returns {Promise<number>} Number of deleted vectors
   */
  async deleteAllSchemeVectors() {
    if (!vectorStoreClient.isReady()) {
      return 0;
    }

    try {
      const count = await vectorStoreClient.deleteByFilter({ documentType: 'scheme' });
      console.log(`✅ Deleted ${count} scheme vectors`);
      return count;
    } catch (error) {
      console.error('❌ Failed to delete scheme vectors:', error.message);
      return 0;
    }
  }

  /**
   * Rebuild entire index (delete all, then re-index)
   * @returns {Promise<Object>} Rebuild results
   */
  async rebuildIndex() {
    console.log('🔄 Rebuilding scheme vector index...');

    // Delete existing vectors
    await this.deleteAllSchemeVectors();

    // Re-index all schemes
    return this.indexAllSchemes();
  }

  /**
   * Get indexing statistics
   * @returns {Promise<Object>} Index statistics
   */
  async getStats() {
    if (!vectorStoreClient.isReady()) {
      return { ready: false, schemeCount: 0 };
    }

    const schemeCount = await vectorStoreClient.getDocumentCount('scheme');
    const interactionCount = await vectorStoreClient.getDocumentCount('interaction');

    return {
      ready: true,
      schemeCount,
      interactionCount,
      totalSchemes: SCHEMES.length,
      indexCoverage: schemeCount / SCHEMES.length,
    };
  }

  /**
   * Health check for indexing service
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const vectorStoreReady = vectorStoreClient.isReady();
    
    if (!vectorStoreReady) {
      return {
        healthy: false,
        vectorStore: false,
        message: 'VectorStore not connected',
      };
    }

    const stats = await this.getStats();

    return {
      healthy: true,
      vectorStore: true,
      indexedSchemes: stats.schemeCount,
      totalSchemes: stats.totalSchemes,
      message: 'IndexingService healthy',
    };
  }
}

// Export singleton instance
export default new IndexingService();
