import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables FIRST before any other imports
dotenv.config();

import aiService from './services/aiService.js';
import schemeService from './services/schemeService.js';
import translateService from './services/translateService.js';
import ragService from './services/ragService.js';
import indexingService from './services/indexingService.js';
import JanSaathiBot from './bot/telegramBot.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Feature flags
const USE_RAG = process.env.FEATURE_FLAG_USE_RAG !== 'false';

// Initialize services
async function initializeServices() {
  // Initialize Telegram Bot
  const telegramBot = new JanSaathiBot(process.env.TELEGRAM_BOT_TOKEN);
  telegramBot.initialize();

  // Initialize RAG if enabled
  if (USE_RAG && process.env.OPENSEARCH_ENDPOINT) {
    try {
      await ragService.initialize();
      console.log('✅ RAG service initialized');
    } catch (error) {
      console.warn('⚠️  RAG service initialization failed - continuing without RAG');
    }
  } else {
    console.log('ℹ️  RAG service disabled or not configured');
  }
}

initializeServices();

// Middleware
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());

console.log('🏛️  JanSaathi Backend Server');
console.log('============================\n');

// Health check endpoint
app.get('/health', async (req, res) => {
  const ragStatus = ragService.isAvailable();
  const ragMetrics = ragService.getMetrics();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'JanSaathi Backend',
    features: {
      rag: ragStatus,
      bedrock: process.env.FEATURE_FLAG_USE_BEDROCK === 'true',
    },
    ragMetrics: ragStatus ? ragMetrics : null,
  });
});

// Check eligibility endpoint (for web chat and Telegram)
app.post('/api/check-eligibility', async (req, res) => {
  try {
    const { message, language, userId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`\n📨 Processing message from user ${userId || 'anonymous'}`);
    console.log(`Message: ${message.substring(0, 100)}...`);

    // Step 1: Detect language
    const detectedLanguage = language || (await translateService.detectLanguage(message));
    console.log(`🔍 Detected language: ${detectedLanguage}`);

    // Step 2: Translate to English if needed
    const englishText = await translateService.translateToEnglish(message, detectedLanguage);

    // Step 3: Extract profile using AI
    const userProfile = await aiService.extractProfile(englishText);
    userProfile.userId = userId; // Add userId for RAG tracking

    // Step 4: Match schemes
    const matchedSchemes = await schemeService.matchSchemes(userProfile);

    if (matchedSchemes.length === 0) {
      const noMatchMessage =
        detectedLanguage === 'hi'
          ? 'क्षमा करें, आपके लिए कोई योजना नहीं मिली। कृपया अधिक जानकारी प्रदान करें।'
          : 'Sorry, no schemes found matching your profile. Please provide more details.';

      return res.json({
        schemes: [],
        responseMessage: noMatchMessage,
        userProfile,
      });
    }

    // Step 5: Generate response (with RAG support if enabled)
    const responseText = await aiService.generateResponse(
      matchedSchemes,
      userProfile,
      detectedLanguage,
      englishText // Pass original query for RAG context
    );

    // Step 6: Translate response if needed
    const translatedResponse = await translateService.translateFromEnglish(
      responseText,
      detectedLanguage
    );

    // Step 7: Save user profile (if userId provided)
    if (userId) {
      await schemeService.saveUserProfile(
        userId,
        userProfile,
        detectedLanguage,
        message,
        matchedSchemes
      );
    }

    console.log(`✅ Returning ${matchedSchemes.length} schemes\n`);

    res.json({
      schemes: matchedSchemes,
      responseMessage: translatedResponse,
      userProfile,
      ragEnabled: ragService.isAvailable(),
    });
  } catch (error) {
    console.error('❌ Error processing request:', error);
    res.status(500).json({
      error: 'Failed to process request',
      message: error.message,
    });
  }
});

// Get all schemes
app.get('/api/schemes', async (req, res) => {
  try {
    const schemes = await schemeService.getAllSchemes();
    res.json({ schemes });
  } catch (error) {
    console.error('❌ Error fetching schemes:', error);
    res.status(500).json({ error: 'Failed to fetch schemes' });
  }
});

// Dashboard stats endpoint (mock data for MVP)
app.get('/api/dashboard/stats', (req, res) => {
  res.json({
    totalUsers: 1247,
    totalQueries: 3891,
    topSchemes: [
      { name: 'PM-KISAN', queries: 456 },
      { name: 'Ayushman Bharat', queries: 389 },
      { name: 'PM Awas Yojana', queries: 312 },
      { name: 'Ujjwala Yojana', queries: 287 },
      { name: 'MGNREGA', queries: 234 },
    ],
    penetrationRate: 42.5,
  });
});

// Recent queries endpoint (mock data for MVP)
app.get('/api/dashboard/queries', (req, res) => {
  res.json({
    queries: [
      {
        id: 1,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        state: 'Uttar Pradesh',
        schemes: ['PM-KISAN', 'PM Fasal Bima'],
      },
      {
        id: 2,
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        state: 'Tamil Nadu',
        schemes: ['Ujjwala', 'Ayushman Bharat'],
      },
      {
        id: 3,
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        state: 'Maharashtra',
        schemes: ['NSP Scholarship'],
      },
    ],
  });
});

// ======== RAG API Endpoints ========

// Get RAG metrics and status
app.get('/api/rag/status', async (req, res) => {
  try {
    const isAvailable = ragService.isAvailable();
    const metrics = ragService.getMetrics();
    const indexStats = await indexingService.getStats();

    res.json({
      enabled: USE_RAG,
      available: isAvailable,
      metrics,
      indexStats,
      circuitBreaker: aiService.getCircuitBreakerStatus(),
    });
  } catch (error) {
    console.error('❌ Error getting RAG status:', error);
    res.status(500).json({ error: 'Failed to get RAG status' });
  }
});

// Trigger scheme reindexing
app.post('/api/rag/reindex', async (req, res) => {
  try {
    if (!ragService.isAvailable()) {
      return res.status(503).json({ error: 'RAG service not available' });
    }

    console.log('📝 Starting scheme reindexing...');
    const result = await indexingService.rebuildIndex();

    res.json({
      success: result.failed === 0,
      result,
    });
  } catch (error) {
    console.error('❌ Error reindexing schemes:', error);
    res.status(500).json({ error: 'Failed to reindex schemes' });
  }
});

// Clear RAG cache
app.post('/api/rag/clear-cache', (req, res) => {
  try {
    ragService.clearCache();
    res.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Semantic search endpoint (for testing/debugging)
app.post('/api/rag/search', async (req, res) => {
  try {
    const { query, userId } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (!ragService.isAvailable()) {
      return res.status(503).json({ error: 'RAG service not available' });
    }

    const context = await ragService.retrieveContext(query, userId);
    
    res.json({
      query,
      hasContent: context.hasContent,
      schemeCount: context.schemeCount,
      interactionCount: context.interactionCount,
      sources: context.sources,
      isFallback: context.isFallback || false,
    });
  } catch (error) {
    console.error('❌ Error performing RAG search:', error);
    res.status(500).json({ error: 'Failed to perform search' });
  }
});

// Delete user data (privacy compliance)
app.delete('/api/rag/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const deletedCount = await ragService.deleteUserInteractions(userId);
    
    res.json({
      success: true,
      deletedInteractions: deletedCount,
      message: `Deleted ${deletedCount} interactions for user`,
    });
  } catch (error) {
    console.error('❌ Error deleting user data:', error);
    res.status(500).json({ error: 'Failed to delete user data' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📍 API endpoint: http://localhost:${PORT}/api/check-eligibility`);
  console.log(`📍 RAG status: http://localhost:${PORT}/api/rag/status`);
  console.log('\n🚀 Ready to serve citizens!\n');
});
