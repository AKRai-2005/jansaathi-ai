import { PollyClient, SynthesizeSpeechCommand, DescribeVoicesCommand } from '@aws-sdk/client-polly';
import dotenv from 'dotenv';

dotenv.config();

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

/**
 * AWS Polly Text-to-Speech Service
 * Converts text responses to voice for Telegram voice notes
 * Supports multiple Indian languages
 */
class PollyService {
  constructor() {
    this.client = new PollyClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    // Language to voice mapping for Indian languages
    this.voices = {
      'hi': { voiceId: 'Kajal', engine: 'neural', languageCode: 'hi-IN' },
      'en': { voiceId: 'Kajal', engine: 'neural', languageCode: 'en-IN' },
      'ta': { voiceId: 'Kajal', engine: 'standard', languageCode: 'hi-IN' }, // Fallback to Hindi
      'te': { voiceId: 'Kajal', engine: 'standard', languageCode: 'hi-IN' },
      'mr': { voiceId: 'Kajal', engine: 'standard', languageCode: 'hi-IN' },
      'bn': { voiceId: 'Kajal', engine: 'standard', languageCode: 'hi-IN' },
    };

    this.defaultVoice = { voiceId: 'Kajal', engine: 'neural', languageCode: 'hi-IN' };

    console.log('✅ AWS Polly service initialized');
  }

  /**
   * Synthesize speech from text
   * @param {string} text - Text to convert to speech
   * @param {string} language - Language code (hi, en, ta, etc.)
   * @returns {Promise<Buffer>} Audio buffer in OGG format
   */
  async synthesizeSpeech(text, language = 'hi') {
    console.log(`🔊 Synthesizing speech in ${language} (${text.length} chars)`);

    try {
      const voiceConfig = this.voices[language] || this.defaultVoice;
      const cleanedText = this.cleanText(text);

      // Check text length (Polly limit is 3000 characters for standard)
      const truncatedText = cleanedText.substring(0, 2500);

      const command = new SynthesizeSpeechCommand({
        Engine: voiceConfig.engine,
        LanguageCode: voiceConfig.languageCode,
        OutputFormat: 'ogg_vorbis', // Best for Telegram
        SampleRate: '24000',
        Text: truncatedText,
        TextType: 'text',
        VoiceId: voiceConfig.voiceId,
      });

      const response = await this.client.send(command);
      const audioBuffer = await this.streamToBuffer(response.AudioStream);

      console.log(`✅ Generated ${audioBuffer.length} bytes of audio`);
      return audioBuffer;
    } catch (error) {
      console.error('❌ Speech synthesis failed:', error.message);
      throw error;
    }
  }

  /**
   * Clean text for better speech output
   * @param {string} text - Raw text
   * @returns {string} Cleaned text
   */
  cleanText(text) {
    return text
      // Remove markdown
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/_/g, '')
      .replace(/`/g, '')
      // Remove URLs
      .replace(/https?:\/\/[^\s]+/g, 'link available')
      // Remove emojis
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      // Clean whitespace
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Convert stream to buffer
   * @param {ReadableStream} stream - Audio stream
   * @returns {Promise<Buffer>} Buffer
   */
  async streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  /**
   * List available voices
   * @param {string} languageCode - Language code (e.g., hi-IN)
   * @returns {Promise<Array>} Available voices
   */
  async listVoices(languageCode = 'hi-IN') {
    try {
      const command = new DescribeVoicesCommand({
        LanguageCode: languageCode,
      });

      const response = await this.client.send(command);
      return response.Voices || [];
    } catch (error) {
      console.error('❌ Failed to list voices:', error.message);
      return [];
    }
  }

  /**
   * Get supported languages
   * @returns {Object} Language to voice mapping
   */
  getSupportedLanguages() {
    return this.voices;
  }
}

export default new PollyService();
