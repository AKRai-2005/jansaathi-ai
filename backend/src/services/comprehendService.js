import { ComprehendClient, DetectSentimentCommand, DetectEntitiesCommand, DetectKeyPhrasesCommand, DetectDominantLanguageCommand } from '@aws-sdk/client-comprehend';
import dotenv from 'dotenv';

dotenv.config();

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

/**
 * AWS Comprehend Service for advanced NLP
 * - Sentiment Analysis: Understand user mood/frustration
 * - Entity Extraction: Extract dates, locations, organizations
 * - Key Phrase Detection: Identify important topics
 * - Language Detection: Detect input language
 */
class ComprehendService {
  constructor() {
    this.client = new ComprehendClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    console.log('✅ AWS Comprehend service initialized');
  }

  /**
   * Detect sentiment of user message
   * @param {string} text - User message
   * @param {string} languageCode - Language code (en, hi, etc.)
   * @returns {Promise<Object>} Sentiment analysis result
   */
  async detectSentiment(text, languageCode = 'en') {
    // Comprehend supports: en, es, fr, de, it, pt, ar, hi, ja, ko, zh, zh-TW
    const supportedLangs = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ar', 'hi', 'ja', 'ko', 'zh'];
    const lang = supportedLangs.includes(languageCode) ? languageCode : 'en';

    try {
      const command = new DetectSentimentCommand({
        Text: text.substring(0, 5000), // Max 5000 bytes
        LanguageCode: lang,
      });

      const response = await this.client.send(command);

      console.log(`😊 Sentiment: ${response.Sentiment} (${(response.SentimentScore[response.Sentiment] * 100).toFixed(1)}%)`);

      return {
        sentiment: response.Sentiment, // POSITIVE, NEGATIVE, NEUTRAL, MIXED
        scores: response.SentimentScore,
        isNegative: response.Sentiment === 'NEGATIVE' || response.SentimentScore.Negative > 0.5,
        isPositive: response.Sentiment === 'POSITIVE' || response.SentimentScore.Positive > 0.5,
        needsAssistance: response.SentimentScore.Negative > 0.3, // User may be frustrated
      };
    } catch (error) {
      console.error('❌ Sentiment detection failed:', error.message);
      return {
        sentiment: 'NEUTRAL',
        scores: { Positive: 0.25, Negative: 0.25, Neutral: 0.25, Mixed: 0.25 },
        isNegative: false,
        isPositive: false,
        needsAssistance: false,
      };
    }
  }

  /**
   * Extract named entities from text
   * @param {string} text - User message
   * @param {string} languageCode - Language code
   * @returns {Promise<Object>} Extracted entities
   */
  async detectEntities(text, languageCode = 'en') {
    const supportedLangs = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ar', 'hi', 'ja', 'ko', 'zh'];
    const lang = supportedLangs.includes(languageCode) ? languageCode : 'en';

    try {
      const command = new DetectEntitiesCommand({
        Text: text.substring(0, 5000),
        LanguageCode: lang,
      });

      const response = await this.client.send(command);

      // Group entities by type
      const groupedEntities = {
        PERSON: [],
        LOCATION: [],
        ORGANIZATION: [],
        DATE: [],
        QUANTITY: [],
        OTHER: [],
      };

      for (const entity of response.Entities || []) {
        const type = entity.Type || 'OTHER';
        if (groupedEntities[type]) {
          groupedEntities[type].push({
            text: entity.Text,
            score: entity.Score,
          });
        }
      }

      console.log(`🏷️  Entities: ${response.Entities?.length || 0} found`);

      return {
        entities: response.Entities || [],
        grouped: groupedEntities,
        locations: groupedEntities.LOCATION.map(e => e.text),
        dates: groupedEntities.DATE.map(e => e.text),
        organizations: groupedEntities.ORGANIZATION.map(e => e.text),
      };
    } catch (error) {
      console.error('❌ Entity detection failed:', error.message);
      return {
        entities: [],
        grouped: {},
        locations: [],
        dates: [],
        organizations: [],
      };
    }
  }

  /**
   * Extract key phrases from text
   * @param {string} text - User message
   * @param {string} languageCode - Language code
   * @returns {Promise<Array>} Key phrases
   */
  async detectKeyPhrases(text, languageCode = 'en') {
    const supportedLangs = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ar', 'hi', 'ja', 'ko', 'zh'];
    const lang = supportedLangs.includes(languageCode) ? languageCode : 'en';

    try {
      const command = new DetectKeyPhrasesCommand({
        Text: text.substring(0, 5000),
        LanguageCode: lang,
      });

      const response = await this.client.send(command);

      const phrases = (response.KeyPhrases || [])
        .filter(p => p.Score > 0.7)
        .map(p => p.Text);

      console.log(`🔑 Key phrases: ${phrases.slice(0, 5).join(', ')}`);

      return phrases;
    } catch (error) {
      console.error('❌ Key phrase detection failed:', error.message);
      return [];
    }
  }

  /**
   * Detect dominant language of text
   * @param {string} text - User message
   * @returns {Promise<string>} Language code
   */
  async detectLanguage(text) {
    try {
      const command = new DetectDominantLanguageCommand({
        Text: text.substring(0, 5000),
      });

      const response = await this.client.send(command);

      if (response.Languages && response.Languages.length > 0) {
        const topLang = response.Languages[0];
        console.log(`🌐 Detected language: ${topLang.LanguageCode} (${(topLang.Score * 100).toFixed(1)}%)`);
        return topLang.LanguageCode;
      }

      return 'en';
    } catch (error) {
      console.error('❌ Language detection failed:', error.message);
      return 'en';
    }
  }

  /**
   * Comprehensive NLP analysis of user message
   * @param {string} text - User message
   * @param {string} languageCode - Language code
   * @returns {Promise<Object>} Complete NLP analysis
   */
  async analyzeMessage(text, languageCode = 'en') {
    console.log(`🔍 Analyzing message with Comprehend (${languageCode})...`);

    try {
      // Run analyses in parallel
      const [sentiment, entities, keyPhrases] = await Promise.all([
        this.detectSentiment(text, languageCode),
        this.detectEntities(text, languageCode),
        this.detectKeyPhrases(text, languageCode),
      ]);

      return {
        sentiment,
        entities,
        keyPhrases,
        analysis: {
          userMood: sentiment.sentiment,
          needsUrgentHelp: sentiment.needsAssistance,
          mentionedLocations: entities.locations,
          topics: keyPhrases.slice(0, 5),
        },
      };
    } catch (error) {
      console.error('❌ Message analysis failed:', error.message);
      return {
        sentiment: { sentiment: 'NEUTRAL' },
        entities: { entities: [] },
        keyPhrases: [],
        analysis: {
          userMood: 'NEUTRAL',
          needsUrgentHelp: false,
          mentionedLocations: [],
          topics: [],
        },
      };
    }
  }
}

export default new ComprehendService();
