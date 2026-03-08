import { TranslateTextCommand } from '@aws-sdk/client-translate';
import { translateClient } from '../config/aws.js';

class TranslationService {
  constructor() {
    this.supportedLanguages = ['hi', 'ta', 'te', 'mr', 'bn', 'en'];
    this.maxRetries = 3;
  }

  /**
   * Detect language of input text
   * @param {string} text - Input text
   * @returns {Promise<string>} Language code
   */
  async detectLanguage(text) {
    console.log('🔍 Detecting language...');

    // Simple heuristic - check for Devanagari, Tamil, Telugu scripts
    if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Hindi
    if (/[\u0B80-\u0BFF]/.test(text)) return 'ta'; // Tamil
    if (/[\u0C00-\u0C7F]/.test(text)) return 'te'; // Telugu
    if (/[\u0980-\u09FF]/.test(text)) return 'bn'; // Bengali

    // Default to English
    return 'en';
  }

  /**
   * Translate text to English
   * @param {string} text - Input text
   * @param {string} sourceLanguage - Source language code
   * @returns {Promise<string>} Translated text
   */
  async translateToEnglish(text, sourceLanguage) {
    if (sourceLanguage === 'en') {
      return text;
    }

    console.log(`🌐 Translating from ${sourceLanguage} to English...`);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const command = new TranslateTextCommand({
          Text: text,
          SourceLanguageCode: sourceLanguage,
          TargetLanguageCode: 'en',
        });

        const response = await translateClient.send(command);
        console.log('✅ Translation completed');
        return response.TranslatedText;
      } catch (error) {
        console.error(`❌ Translation attempt ${attempt} failed:`, error.message);
        
        if (attempt === this.maxRetries) {
          console.log('⚠️  Using original text as fallback');
          return text;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    return text;
  }

  /**
   * Translate text from English to target language
   * @param {string} text - English text
   * @param {string} targetLanguage - Target language code
   * @returns {Promise<string>} Translated text
   */
  async translateFromEnglish(text, targetLanguage) {
    if (targetLanguage === 'en') {
      return text;
    }

    console.log(`🌐 Translating from English to ${targetLanguage}...`);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const command = new TranslateTextCommand({
          Text: text,
          SourceLanguageCode: 'en',
          TargetLanguageCode: targetLanguage,
        });

        const response = await translateClient.send(command);
        console.log('✅ Translation completed');
        return response.TranslatedText;
      } catch (error) {
        console.error(`❌ Translation attempt ${attempt} failed:`, error.message);
        
        if (attempt === this.maxRetries) {
          console.log('⚠️  Using original text as fallback');
          return text;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    return text;
  }
}

export default new TranslationService();
