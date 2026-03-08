import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import dotenv from 'dotenv';

dotenv.config();

const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT;
const OPENSEARCH_REGION = process.env.OPENSEARCH_REGION || process.env.AWS_REGION || 'us-east-1';
const VECTOR_DIMENSION = 1024; // Titan Embeddings v2 dimension
const INDEX_NAME = 'jansaathi-vectors';

class VectorStoreClient {
  constructor() {
    this.client = null;
    this.indexName = INDEX_NAME;
    this.vectorDimension = VECTOR_DIMENSION;
    this.isConnected = false;
  }

  /**
   * Initialize OpenSearch client with AWS IAM authentication
   */
  async initialize() {
    if (this.client && this.isConnected) {
      return;
    }

    if (!OPENSEARCH_ENDPOINT) {
      console.log('⚠️  OpenSearch endpoint not configured - Vector Store disabled');
      return;
    }

    try {
      console.log(`🔧 Initializing OpenSearch client for: ${OPENSEARCH_ENDPOINT}`);

      this.client = new Client({
        ...AwsSigv4Signer({
          region: OPENSEARCH_REGION,
          service: 'aoss', // Amazon OpenSearch Serverless
          getCredentials: () => {
            const credentialsProvider = defaultProvider();
            return credentialsProvider();
          },
        }),
        node: OPENSEARCH_ENDPOINT,
      });

      // Verify connection
      await this.healthCheck();
      
      // Ensure index exists
      await this.ensureIndexExists();
      
      this.isConnected = true;
      console.log('✅ VectorStore client connected successfully');
    } catch (error) {
      console.error('❌ Failed to initialize VectorStore client:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Check OpenSearch connectivity
   * @returns {Promise<boolean>} Connection status
   */
  async healthCheck() {
    if (!this.client) {
      return false;
    }

    try {
      const response = await this.client.cluster.health();
      console.log(`🏥 OpenSearch health: ${response.body.status}`);
      return response.body.status !== 'red';
    } catch (error) {
      console.error('❌ OpenSearch health check failed:', error.message);
      return false;
    }
  }

  /**
   * Create vector index if it doesn't exist
   */
  async ensureIndexExists() {
    if (!this.client) return;

    try {
      const indexExists = await this.client.indices.exists({ index: this.indexName });
      
      if (!indexExists.body) {
        console.log(`📝 Creating vector index: ${this.indexName}`);
        
        await this.client.indices.create({
          index: this.indexName,
          body: {
            settings: {
              'index.knn': true,
              'index.knn.algo_param.ef_search': 100,
            },
            mappings: {
              properties: {
                embedding: {
                  type: 'knn_vector',
                  dimension: this.vectorDimension,
                  method: {
                    name: 'hnsw',
                    space_type: 'cosinesimil',
                    engine: 'nmslib',
                    parameters: {
                      ef_construction: 128,
                      m: 24,
                    },
                  },
                },
                document_id: { type: 'keyword' },
                document_type: { type: 'keyword' }, // 'scheme' or 'interaction'
                content: { type: 'text' },
                metadata: { type: 'object', enabled: true },
                timestamp: { type: 'date' },
                user_id: { type: 'keyword' },
                positive_feedback: { type: 'boolean' },
              },
            },
          },
        });
        
        console.log('✅ Vector index created successfully');
      } else {
        console.log(`✅ Vector index ${this.indexName} already exists`);
      }
    } catch (error) {
      console.error('❌ Failed to create vector index:', error.message);
      throw error;
    }
  }

  /**
   * Insert a vector into the store
   * @param {Object} document - Document with embedding and metadata
   * @returns {Promise<string>} Document ID
   */
  async insertVector(document) {
    if (!this.client || !this.isConnected) {
      throw new Error('VectorStore not connected');
    }

    const {
      documentId,
      documentType,
      embedding,
      content,
      metadata = {},
      userId = null,
      positiveFeedback = false,
    } = document;

    // Validate vector dimensions
    if (embedding.length !== this.vectorDimension) {
      throw new Error(`Invalid vector dimension: expected ${this.vectorDimension}, got ${embedding.length}`);
    }

    try {
      const response = await this.client.index({
        index: this.indexName,
        id: documentId,
        body: {
          embedding,
          document_id: documentId,
          document_type: documentType,
          content,
          metadata,
          timestamp: new Date().toISOString(),
          user_id: userId,
          positive_feedback: positiveFeedback,
        },
        refresh: true,
      });

      console.log(`✅ Vector inserted: ${documentId}`);
      return response.body._id;
    } catch (error) {
      console.error(`❌ Failed to insert vector: ${documentId}`, error.message);
      throw error;
    }
  }

  /**
   * Bulk insert vectors
   * @param {Array<Object>} documents - Array of documents with embeddings
   * @returns {Promise<number>} Number of successfully inserted documents
   */
  async bulkInsertVectors(documents) {
    if (!this.client || !this.isConnected) {
      throw new Error('VectorStore not connected');
    }

    if (!documents.length) return 0;

    const operations = [];
    
    for (const doc of documents) {
      // Validate dimensions
      if (doc.embedding.length !== this.vectorDimension) {
        console.warn(`⚠️  Skipping document ${doc.documentId}: invalid dimensions`);
        continue;
      }

      operations.push({ index: { _index: this.indexName, _id: doc.documentId } });
      operations.push({
        embedding: doc.embedding,
        document_id: doc.documentId,
        document_type: doc.documentType,
        content: doc.content,
        metadata: doc.metadata || {},
        timestamp: new Date().toISOString(),
        user_id: doc.userId || null,
        positive_feedback: doc.positiveFeedback || false,
      });
    }

    try {
      const response = await this.client.bulk({
        body: operations,
        refresh: true,
      });

      const successCount = response.body.items.filter((item) => !item.index.error).length;
      console.log(`✅ Bulk insert: ${successCount}/${documents.length} vectors inserted`);
      
      return successCount;
    } catch (error) {
      console.error('❌ Bulk insert failed:', error.message);
      throw error;
    }
  }

  /**
   * Perform k-nearest neighbor search
   * @param {Array<number>} queryVector - Query embedding
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results with documents and scores
   */
  async knnSearch(queryVector, options = {}) {
    if (!this.client || !this.isConnected) {
      throw new Error('VectorStore not connected');
    }

    const {
      k = 5,
      documentType = null,
      similarityThreshold = 0.7,
      userId = null,
      boostPositiveFeedback = false,
    } = options;

    // Validate query vector
    if (queryVector.length !== this.vectorDimension) {
      throw new Error(`Invalid query vector dimension: expected ${this.vectorDimension}, got ${queryVector.length}`);
    }

    // Build filter
    const filter = [];
    if (documentType) {
      filter.push({ term: { document_type: documentType } });
    }
    if (userId) {
      filter.push({ term: { user_id: userId } });
    }

    const query = {
      size: k * 2, // Fetch more to filter by threshold
      query: {
        bool: {
          must: [
            {
              knn: {
                embedding: {
                  vector: queryVector,
                  k: k * 2,
                },
              },
            },
          ],
          filter: filter.length > 0 ? filter : undefined,
        },
      },
    };

    try {
      const startTime = Date.now();
      const response = await this.client.search({
        index: this.indexName,
        body: query,
      });
      const searchTime = Date.now() - startTime;

      console.log(`🔍 kNN search completed in ${searchTime}ms, found ${response.body.hits.total.value} results`);

      // Process and filter results
      const results = response.body.hits.hits
        .map((hit) => {
          let score = hit._score || 0;
          
          // Boost positive feedback interactions
          if (boostPositiveFeedback && hit._source.positive_feedback) {
            score += 0.1;
          }

          return {
            documentId: hit._source.document_id,
            documentType: hit._source.document_type,
            content: hit._source.content,
            metadata: hit._source.metadata,
            score,
            userId: hit._source.user_id,
            timestamp: hit._source.timestamp,
            positiveFeedback: hit._source.positive_feedback,
          };
        })
        .filter((result) => result.score >= similarityThreshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, k);

      console.log(`✅ Returned ${results.length} results above threshold ${similarityThreshold}`);
      return results;
    } catch (error) {
      console.error('❌ kNN search failed:', error.message);
      throw error;
    }
  }

  /**
   * Update a document's metadata
   * @param {string} documentId - Document ID
   * @param {Object} updates - Fields to update
   */
  async updateDocument(documentId, updates) {
    if (!this.client || !this.isConnected) {
      throw new Error('VectorStore not connected');
    }

    try {
      await this.client.update({
        index: this.indexName,
        id: documentId,
        body: {
          doc: {
            ...updates,
            timestamp: new Date().toISOString(),
          },
        },
        refresh: true,
      });

      console.log(`✅ Document updated: ${documentId}`);
    } catch (error) {
      console.error(`❌ Failed to update document: ${documentId}`, error.message);
      throw error;
    }
  }

  /**
   * Delete a document by ID
   * @param {string} documentId - Document ID
   */
  async deleteDocument(documentId) {
    if (!this.client || !this.isConnected) {
      throw new Error('VectorStore not connected');
    }

    try {
      await this.client.delete({
        index: this.indexName,
        id: documentId,
        refresh: true,
      });

      console.log(`✅ Document deleted: ${documentId}`);
    } catch (error) {
      if (error.statusCode !== 404) {
        console.error(`❌ Failed to delete document: ${documentId}`, error.message);
        throw error;
      }
    }
  }

  /**
   * Delete documents by filter (e.g., all documents of a type or user)
   * @param {Object} filter - Filter criteria
   * @returns {Promise<number>} Number of deleted documents
   */
  async deleteByFilter(filter) {
    if (!this.client || !this.isConnected) {
      throw new Error('VectorStore not connected');
    }

    const { documentType, userId } = filter;
    const must = [];

    if (documentType) {
      must.push({ term: { document_type: documentType } });
    }
    if (userId) {
      must.push({ term: { user_id: userId } });
    }

    if (must.length === 0) {
      throw new Error('At least one filter criterion required');
    }

    try {
      const response = await this.client.deleteByQuery({
        index: this.indexName,
        body: {
          query: {
            bool: { must },
          },
        },
        refresh: true,
      });

      console.log(`✅ Deleted ${response.body.deleted} documents by filter`);
      return response.body.deleted;
    } catch (error) {
      console.error('❌ Delete by filter failed:', error.message);
      throw error;
    }
  }

  /**
   * Get document count by type
   * @param {string} documentType - Document type filter
   * @returns {Promise<number>} Document count
   */
  async getDocumentCount(documentType = null) {
    if (!this.client || !this.isConnected) {
      return 0;
    }

    try {
      const query = documentType
        ? { query: { term: { document_type: documentType } } }
        : { query: { match_all: {} } };

      const response = await this.client.count({
        index: this.indexName,
        body: query,
      });

      return response.body.count;
    } catch (error) {
      console.error('❌ Count query failed:', error.message);
      return 0;
    }
  }

  /**
   * Check if client is connected
   * @returns {boolean} Connection status
   */
  isReady() {
    return this.isConnected && this.client !== null;
  }
}

// Export singleton instance
export default new VectorStoreClient();
