import crypto from 'crypto';
import embeddingService from './embeddingService.js';
import vectorStoreClient from './vectorStoreClient.js';
import schemeService from './schemeService.js';
import dotenv from 'dotenv';

dotenv.config();

const RAG_SIMILARITY_THRESHOLD = parseFloat(process.env.RAG_SIMILARITY_THRESHOLD) || 0.7;
const RAG_MAX_SCHEME_RESULTS = parseInt(process.env.RAG_MAX_SCHEME_RESULTS) || 5;
const RAG_MAX_INTERACTION_RESULTS = parseInt(process.env.RAG_MAX_INTERACTION_RESULTS) || 3;
const RAG_ENABLE_LEARNING = process.env.RAG_ENABLE_LEARNING !== 'false';
const RAG_MAX_INTERACTIONS_PER_USER = 10000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class RAGService {
  constructor() {
    this.interactionPrefix = 'interaction_';
    this.queryCache = new Map();
    this.schemeCacheTime = 60 * 60 * 1000; // 1 hour
    this.schemeVectorCache = new Map();
    
    // Metrics
    this.metrics = {
      totalQueries: 0,
      cacheHits: 0,
      avgSimilarityScore: 0,
      interactionsStored: 0,
      positiveFeedbackRate: 0,
    };
  }

  /**
   * Initialize RAG service
   */
  async initialize() {
    try {
      await vectorStoreClient.initialize();
      console.log('✅ RAGService initialized');
      console.log(`📊 RAG Settings: threshold=${RAG_SIMILARITY_THRESHOLD}, learning=${RAG_ENABLE_LEARNING}`);
    } catch (error) {
      console.warn('⚠️  RAGService initialization failed - falling back to keyword search');
    }
  }

  /**
   * Hash user ID for privacy (anonymization)
   * @param {string} userId - Original user ID
   * @returns {string} Hashed user ID
   */
  hashUserId(userId) {
    return crypto.createHash('sha256').update(userId.toString()).digest('hex').substring(0, 16);
  }

  /**
   * Filter PII from text before vectorization
   * @param {string} text - Input text
   * @returns {string} Sanitized text
   */
  filterPII(text) {
    // Remove potential phone numbers
    let sanitized = text.replace(/\b\d{10,12}\b/g, '[PHONE]');
    // Remove potential Aadhaar numbers
    sanitized = sanitized.replace(/\b\d{4}\s*\d{4}\s*\d{4}\b/g, '[AADHAAR]');
    // Remove email addresses
    sanitized = sanitized.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');
    return sanitized;
  }

  /**
   * Retrieve relevant context for a query using semantic search
   * @param {string} query - User query
   * @param {string} userId - Optional user ID for personalization
   * @returns {Promise<Object>} Context with schemes and interactions
   */
  async retrieveContext(query, userId = null) {
    this.metrics.totalQueries++;
    const startTime = Date.now();

    // Check cache
    const cacheKey = `${query}_${userId || 'anon'}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      this.metrics.cacheHits++;
      console.log('📦 Cache hit for query');
      return cached.context;
    }

    // Fall back to keyword search if vector store not available
    if (!vectorStoreClient.isReady()) {
      console.log('⚠️  VectorStore unavailable - falling back to keyword search');
      return this.fallbackKeywordSearch(query);
    }

    try {
      // Generate query embedding
      const queryEmbedding = await embeddingService.generateEmbedding(query);

      // Search for relevant schemes
      const schemeResults = await this.searchSchemes(queryEmbedding);

      // Search for relevant past interactions
      const interactionResults = await this.searchInteractions(queryEmbedding, userId);

      // Combine results into unified context
      const context = this.buildContextDocument(schemeResults, interactionResults);

      // Update metrics
      const searchTime = Date.now() - startTime;
      console.log(`🔍 RAG context retrieved in ${searchTime}ms`);
      
      if (schemeResults.length > 0) {
        const avgScore = schemeResults.reduce((sum, r) => sum + r.score, 0) / schemeResults.length;
        this.metrics.avgSimilarityScore = 
          (this.metrics.avgSimilarityScore * (this.metrics.totalQueries - 1) + avgScore) / 
          this.metrics.totalQueries;
      }

      // Cache result
      this.queryCache.set(cacheKey, { context, timestamp: Date.now() });

      return context;
    } catch (error) {
      console.error('❌ RAG retrieval failed:', error.message);
      return this.fallbackKeywordSearch(query);
    }
  }

  /**
   * Search for relevant schemes using kNN
   * @param {Array<number>} queryEmbedding - Query vector
   * @returns {Promise<Array>} Scheme results
   */
  async searchSchemes(queryEmbedding) {
    try {
      const results = await vectorStoreClient.knnSearch(queryEmbedding, {
        k: RAG_MAX_SCHEME_RESULTS,
        documentType: 'scheme',
        similarityThreshold: RAG_SIMILARITY_THRESHOLD,
      });

      console.log(`📋 Found ${results.length} relevant schemes`);
      return results;
    } catch (error) {
      console.error('❌ Scheme search failed:', error.message);
      return [];
    }
  }

  /**
   * Search for relevant past interactions using kNN
   * @param {Array<number>} queryEmbedding - Query vector
   * @param {string} userId - Optional user ID
   * @returns {Promise<Array>} Interaction results
   */
  async searchInteractions(queryEmbedding, userId = null) {
    if (!RAG_ENABLE_LEARNING) {
      return [];
    }

    try {
      const results = await vectorStoreClient.knnSearch(queryEmbedding, {
        k: RAG_MAX_INTERACTION_RESULTS,
        documentType: 'interaction',
        similarityThreshold: RAG_SIMILARITY_THRESHOLD,
        boostPositiveFeedback: true, // Boost interactions with positive feedback by 0.1
      });

      console.log(`💬 Found ${results.length} relevant interactions`);
      return results;
    } catch (error) {
      console.error('❌ Interaction search failed:', error.message);
      return [];
    }
  }

  /**
   * Build unified context document from search results
   * @param {Array} schemeResults - Scheme search results
   * @param {Array} interactionResults - Interaction search results
   * @returns {Object} Context document
   */
  buildContextDocument(schemeResults, interactionResults) {
    const schemes = schemeResults.map((result) => ({
      schemeId: result.metadata?.schemeId,
      schemeName: result.metadata?.schemeName,
      content: result.content,
      score: result.score,
      source: 'vector_search',
    }));

    const interactions = interactionResults.map((result) => ({
      content: result.content,
      score: result.score,
      wasHelpful: result.positiveFeedback,
    }));

    const contextText = [
      '=== RELEVANT GOVERNMENT SCHEMES ===',
      ...schemes.map((s, i) => `[${i + 1}] ${s.content}`),
      '',
      interactions.length > 0 ? '=== SIMILAR PAST CONVERSATIONS ===' : '',
      ...interactions.map((i, idx) => `[Past ${idx + 1}] ${i.content}`),
    ]
      .filter(Boolean)
      .join('\n\n');

    return {
      hasContent: schemes.length > 0 || interactions.length > 0,
      schemes,
      interactions,
      contextText,
      schemeCount: schemes.length,
      interactionCount: interactions.length,
      sources: schemes.map((s) => ({
        schemeId: s.schemeId,
        schemeName: s.schemeName,
        relevanceScore: s.score,
      })),
    };
  }

  /**
   * Fallback to keyword-based search when vector store unavailable
   * @param {string} query - User query
   * @returns {Promise<Object>} Context from keyword search
   */
  async fallbackKeywordSearch(query) {
    console.log('🔍 Using fallback keyword search');

    try {
      // Extract basic profile from query for matching
      const basicProfile = this.extractBasicProfile(query);
      const schemes = await schemeService.matchSchemes(basicProfile);

      const schemeResults = schemes.slice(0, RAG_MAX_SCHEME_RESULTS).map((s) => ({
        schemeId: s.schemeId,
        schemeName: s.name,
        content: `Scheme Name: ${s.name}\nDescription: ${s.description}\nBenefits: ${s.benefits?.join('; ')}`,
        score: s.relevanceScore || 0.5,
        source: 'keyword_search',
      }));

      return {
        hasContent: schemeResults.length > 0,
        schemes: schemeResults,
        interactions: [],
        contextText: schemeResults.map((s) => s.content).join('\n\n'),
        schemeCount: schemeResults.length,
        interactionCount: 0,
        sources: schemeResults.map((s) => ({
          schemeId: s.schemeId,
          schemeName: s.schemeName,
          relevanceScore: s.score,
        })),
        isFallback: true,
      };
    } catch (error) {
      console.error('❌ Fallback search failed:', error.message);
      return {
        hasContent: false,
        schemes: [],
        interactions: [],
        contextText: '',
        schemeCount: 0,
        interactionCount: 0,
        sources: [],
        isFallback: true,
      };
    }
  }

  /**
   * Extract basic profile from query text for keyword matching
   * @param {string} query - User query
   * @returns {Object} Basic profile
   */
  extractBasicProfile(query) {
    const lowerQuery = query.toLowerCase();
    const profile = {};

    // Detect occupation
    if (lowerQuery.includes('farmer') || lowerQuery.includes('kisan') || lowerQuery.includes('kheti')) {
      profile.occupation = 'farmer';
    }
    if (lowerQuery.includes('student') || lowerQuery.includes('padhai')) {
      profile.occupation = 'student';
    }

    // Detect BPL
    if (lowerQuery.includes('bpl') || lowerQuery.includes('garib') || lowerQuery.includes('poor')) {
      profile.bpl_card = true;
    }

    // Detect state
    const states = ['uttar pradesh', 'bihar', 'maharashtra', 'rajasthan', 'madhya pradesh', 'tamil nadu'];
    for (const state of states) {
      if (lowerQuery.includes(state)) {
        profile.state = state;
        break;
      }
    }

    return profile;
  }

  /**
   * Store a successful interaction for continuous learning
   * @param {string} userId - User ID
   * @param {string} query - User query
   * @param {string} response - System response
   * @param {Array} matchedSchemes - Schemes that were matched
   * @returns {Promise<boolean>} Success status
   */
  async storeInteraction(userId, query, response, matchedSchemes = []) {
    if (!RAG_ENABLE_LEARNING || !vectorStoreClient.isReady()) {
      return false;
    }

    try {
      // Check interaction limit for user
      const hashedUserId = this.hashUserId(userId);
      const userInteractionCount = await this.getUserInteractionCount(hashedUserId);

      if (userInteractionCount >= RAG_MAX_INTERACTIONS_PER_USER) {
        await this.removeOldestInteraction(hashedUserId);
      }

      // Combine query and response, filter PII
      const combinedText = this.filterPII(`Query: ${query}\n\nResponse: ${response}`);
      const embedding = await embeddingService.generateEmbedding(combinedText);

      const documentId = `${this.interactionPrefix}${hashedUserId}_${Date.now()}`;

      await vectorStoreClient.insertVector({
        documentId,
        documentType: 'interaction',
        embedding,
        content: combinedText,
        metadata: {
          originalUserId: hashedUserId,
          schemeIds: matchedSchemes.map((s) => s.schemeId || s.scheme_id),
          queryLength: query.length,
          responseLength: response.length,
        },
        userId: hashedUserId,
        positiveFeedback: false, // Will be updated if user provides positive feedback
      });

      this.metrics.interactionsStored++;
      console.log(`✅ Interaction stored for user ${hashedUserId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to store interaction:', error.message);
      return false;
    }
  }

  /**
   * Mark an interaction as helpful (positive feedback)
   * @param {string} userId - User ID
   * @param {string} interactionId - Interaction document ID
   * @returns {Promise<boolean>} Success status
   */
  async markInteractionHelpful(userId, interactionId) {
    if (!vectorStoreClient.isReady()) {
      return false;
    }

    try {
      await vectorStoreClient.updateDocument(interactionId, {
        positive_feedback: true,
      });

      console.log(`✅ Interaction marked as helpful: ${interactionId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to mark interaction helpful:', error.message);
      return false;
    }
  }

  /**
   * Get interaction count for a user
   * @param {string} hashedUserId - Hashed user ID
   * @returns {Promise<number>} Interaction count
   */
  async getUserInteractionCount(hashedUserId) {
    // This would require a count query - simplified for now
    return 0;
  }

  /**
   * Remove oldest interaction for a user
   * @param {string} hashedUserId - Hashed user ID
   */
  async removeOldestInteraction(hashedUserId) {
    // Would query and delete oldest - simplified for now
    console.log(`📝 Would remove oldest interaction for user ${hashedUserId}`);
  }

  /**
   * Delete all interactions for a user (privacy compliance)
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of deleted interactions
   */
  async deleteUserInteractions(userId) {
    if (!vectorStoreClient.isReady()) {
      return 0;
    }

    const hashedUserId = this.hashUserId(userId);

    try {
      const count = await vectorStoreClient.deleteByFilter({
        documentType: 'interaction',
        userId: hashedUserId,
      });

      console.log(`✅ Deleted ${count} interactions for user ${hashedUserId}`);
      return count;
    } catch (error) {
      console.error('❌ Failed to delete user interactions:', error.message);
      return 0;
    }
  }

  /**
   * Get RAG service metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    const cacheHitRate = this.metrics.totalQueries > 0
      ? this.metrics.cacheHits / this.metrics.totalQueries
      : 0;

    return {
      ...this.metrics,
      cacheHitRate,
      vectorStoreReady: vectorStoreClient.isReady(),
      learningEnabled: RAG_ENABLE_LEARNING,
      similarityThreshold: RAG_SIMILARITY_THRESHOLD,
    };
  }

  /**
   * Clear query cache
   */
  clearCache() {
    this.queryCache.clear();
    this.schemeVectorCache.clear();
    console.log('🗑️  RAG cache cleared');
  }

  /**
   * Check if RAG service is available
   * @returns {boolean} Availability status
   */
  isAvailable() {
    return vectorStoreClient.isReady();
  }
}

// Export singleton instance
export default new RAGService();
