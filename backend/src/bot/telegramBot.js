import TelegramBot from 'node-telegram-bot-api';
import aiService from '../services/aiService.js';
import schemeService from '../services/schemeService.js';
import translateService from '../services/translateService.js';
import transcribeService from '../services/transcribeService.js';
import comprehendService from '../services/comprehendService.js';
import pollyService from '../services/pollyService.js';

// Feature flag for voice responses
const ENABLE_VOICE_RESPONSES = process.env.ENABLE_VOICE_RESPONSES === 'true';

class JanSaathiBot {
  constructor(token) {
    this.token = token;
    this.bot = null;
    this.enableVoiceResponses = ENABLE_VOICE_RESPONSES;
  }

  /**
   * Initialize the Telegram bot
   */
  initialize() {
    if (!this.token) {
      console.log('⚠️  Telegram bot token not provided - bot disabled');
      return;
    }

    const isDevelopment = process.env.NODE_ENV === 'development';

    this.bot = new TelegramBot(this.token, {
      polling: isDevelopment,
      webHook: !isDevelopment,
    });

    console.log('🤖 Telegram bot initialized');
    this.setupHandlers();
  }

  /**
   * Setup message and command handlers
   */
  setupHandlers() {
    // /start command
    this.bot.onText(/\/start/, (msg) => this.handleStart(msg));

    // /help command
    this.bot.onText(/\/help/, (msg) => this.handleHelp(msg));

    // /myschemes command
    this.bot.onText(/\/myschemes/, (msg) => this.handleMySchemes(msg));

    // Text messages
    this.bot.on('message', (msg) => {
      if (!msg.text || msg.text.startsWith('/')) return;
      this.handleTextMessage(msg);
    });

    // Voice messages
    this.bot.on('voice', (msg) => this.handleVoiceMessage(msg));

    console.log('✅ Bot handlers registered');
  }

  /**
   * Handle /start command
   */
  async handleStart(msg) {
    const chatId = msg.chat.id;
    console.log(`📨 /start command from user ${chatId}`);

    const welcomeMessage = `🏛️ *JanSaathi में आपका स्वागत है!*
_Welcome to JanSaathi!_

मैं आपको सरकारी योजनाओं के बारे में जानकारी देने में मदद करूंगा।
I will help you find relevant government welfare schemes.

*कैसे उपयोग करें / How to use:*
• अपनी स्थिति के बारे में बताएं (हिंदी या अंग्रेजी में)
• Tell me about your situation (in Hindi or English)
• आप वॉइस मैसेज भी भेज सकते हैं
• You can also send voice messages

*उदाहरण / Example:*
"मैं उत्तर प्रदेश का किसान हूं, 2 एकड़ जमीन है"
"I am a farmer from UP with 2 acres of land"

*Commands:*
/help - सहायता / Help
/myschemes - मेरी योजनाएं / My schemes

आइए शुरू करें! 🚀`;

    await this.bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
  }

  /**
   * Handle /help command
   */
  async handleHelp(msg) {
    const chatId = msg.chat.id;
    console.log(`📨 /help command from user ${chatId}`);

    const helpMessage = `📚 *JanSaathi Help*

*मैं क्या कर सकता हूं / What I can do:*
✅ सरकारी योजनाओं की जानकारी / Find government schemes
✅ पात्रता जांच / Check eligibility
✅ आवेदन प्रक्रिया / Application process
✅ बहुभाषी समर्थन / Multi-language support

*कैसे उपयोग करें / How to use:*
1. अपनी उम्र, राज्य, पेशा बताएं
   Tell me your age, state, occupation
2. BPL कार्ड है तो बताएं
   Mention if you have BPL card
3. मैं आपके लिए योजनाएं ढूंढूंगा
   I'll find schemes for you

*समर्थित भाषाएं / Supported languages:*
🇮🇳 हिंदी, தமிழ், తెలుగు, मराठी, বাংলা, English

*Commands:*
/start - शुरू करें / Start
/myschemes - पहले मिली योजनाएं / Previously matched schemes

कोई सवाल? बस मुझे मैसेज करें! 💬`;

    await this.bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
  }

  /**
   * Handle /myschemes command
   */
  async handleMySchemes(msg) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    console.log(`📨 /myschemes command from user ${telegramId}`);

    try {
      const schemes = await schemeService.getUserSchemes(telegramId);

      if (schemes.length === 0) {
        await this.bot.sendMessage(
          chatId,
          '📋 आपके लिए अभी तक कोई योजना नहीं मिली है।\nNo schemes found yet. Send me a message about your situation!'
        );
        return;
      }

      await this.bot.sendMessage(
        chatId,
        `📋 *आपकी योजनाएं / Your Schemes* (${schemes.length})`,
        { parse_mode: 'Markdown' }
      );

      for (const scheme of schemes) {
        await this.sendSchemeCard(chatId, scheme);
      }
    } catch (error) {
      console.error('❌ Error fetching user schemes:', error);
      await this.bot.sendMessage(
        chatId,
        '⚠️ क्षमा करें, योजनाएं लाने में समस्या हुई। कृपया बाद में प्रयास करें।\nSorry, there was an error. Please try again later.'
      );
    }
  }

  /**
   * Handle text messages
   */
  async handleTextMessage(msg) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const text = msg.text;

    console.log(`📨 Text message from user ${telegramId}: ${text.substring(0, 50)}...`);

    // Send processing indicator
    await this.bot.sendChatAction(chatId, 'typing');

    try {
      // Detect language
      const language = await translateService.detectLanguage(text);

      // Translate to English for processing
      const englishText = await translateService.translateToEnglish(text, language);

      // Try sentiment analysis with AWS Comprehend (optional - fails gracefully)
      let sentiment = { sentiment: 'NEUTRAL', isNegative: false, needsAssistance: false };
      try {
        sentiment = await comprehendService.detectSentiment(englishText, language === 'hi' ? 'hi' : 'en');
        console.log(`😊 User sentiment: ${sentiment.sentiment}`);
      } catch (comprehendError) {
        console.log('⚠️ Comprehend unavailable, using neutral sentiment');
      }

      // Extract profile
      const userProfile = await aiService.extractProfile(englishText);
      userProfile.sentiment = sentiment.sentiment; // Add sentiment to profile

      // Match schemes
      const matchedSchemes = await schemeService.matchSchemes(userProfile);

      if (matchedSchemes.length === 0) {
        // Customize message based on sentiment
        let noMatchMsg;
        if (sentiment.isNegative || sentiment.needsAssistance) {
          noMatchMsg = language === 'hi'
            ? '😊 चिंता न करें! मैं आपकी मदद करना चाहता हूं। कृपया थोड़ी और जानकारी दें जैसे आपकी उम्र, राज्य, पेशा और परिवार की आय।'
            : "Don't worry! I'm here to help. Please share more details like your age, state, occupation, and family income.";
        } else {
          noMatchMsg = language === 'hi'
            ? '😔 क्षमा करें, आपके लिए कोई योजना नहीं मिली। कृपया अधिक जानकारी दें जैसे उम्र, राज्य, पेशा।'
            : 'Sorry, no schemes found. Please provide more details like age, state, occupation.';
        }
        await this.bot.sendMessage(chatId, noMatchMsg);
        return;
      }

      // Generate response (with extra empathy if user is frustrated)
      const responseText = await aiService.generateResponse(
        matchedSchemes, 
        userProfile, 
        language,
        englishText,
        sentiment.needsAssistance // Pass flag for empathetic response
      );

      // Translate response
      const translatedResponse = await translateService.translateFromEnglish(responseText, language);

      // Send text response
      await this.bot.sendMessage(chatId, translatedResponse);

      // Send scheme cards
      for (const scheme of matchedSchemes) {
        await this.sendSchemeCard(chatId, scheme);
      }

      // Save user profile with sentiment
      await schemeService.saveUserProfile(telegramId, userProfile, language, text, matchedSchemes);
    } catch (error) {
      console.error('❌ Error processing message:', error);
      await this.bot.sendMessage(
        chatId,
        '⚠️ क्षमा करें, कुछ गलत हो गया। कृपया फिर से प्रयास करें।\nSorry, something went wrong. Please try again.'
      );
    }
  }

  /**
   * Handle voice messages
   */
  async handleVoiceMessage(msg) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const voice = msg.voice;

    console.log(`🎤 Voice message from user ${telegramId}`);

    await this.bot.sendChatAction(chatId, 'typing');
    await this.bot.sendMessage(chatId, '🎤 आपका वॉइस मैसेज प्रोसेस हो रहा है...\nProcessing your voice message...');

    try {
      // Download audio file
      const fileLink = await this.bot.getFileLink(voice.file_id);
      const response = await fetch(fileLink);
      const audioBuffer = Buffer.from(await response.arrayBuffer());

      // Transcribe audio - returns both transcript and detected language
      const { transcript, language } = await transcribeService.transcribeVoiceMessage(audioBuffer, voice.file_id);

      console.log(`📝 Transcript: ${transcript}`);
      console.log(`🌐 Detected language: ${language}`);

      // Process with the detected language (skip re-detection)
      await this.processVoiceTranscript(msg, transcript, language);
    } catch (error) {
      console.error('❌ Error processing voice message:', error);
      await this.bot.sendMessage(
        chatId,
        '⚠️ वॉइस मैसेज प्रोसेस नहीं हो सका। कृपया टेक्स्ट मैसेज भेजें।\nCould not process voice message. Please send a text message.'
      );
    }
  }

  /**
   * Process voice transcript with pre-detected language
   * @param {Object} msg - Original message object
   * @param {string} transcript - Transcribed text
   * @param {string} language - Detected language code
   */
  async processVoiceTranscript(msg, transcript, language) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();

    console.log(`📨 Processing voice transcript for user ${telegramId} in ${language}`);

    await this.bot.sendChatAction(chatId, 'typing');

    try {
      // Translate to English (use the detected language from transcription)
      const englishText = await translateService.translateToEnglish(transcript, language);

      // Extract profile
      const userProfile = await aiService.extractProfile(englishText);

      // Match schemes
      const matchedSchemes = await schemeService.matchSchemes(userProfile);

      if (matchedSchemes.length === 0) {
        const noMatchMsg =
          language === 'hi'
            ? '😔 क्षमा करें, आपके लिए कोई योजना नहीं मिली। कृपया अधिक जानकारी दें जैसे उम्र, राज्य, पेशा।'
            : 'Sorry, no schemes found. Please provide more details like age, state, occupation.';
        await this.bot.sendMessage(chatId, noMatchMsg);
        return;
      }

      // Generate response
      const responseText = await aiService.generateResponse(matchedSchemes, userProfile, language);

      // Translate response back to detected language
      const translatedResponse = await translateService.translateFromEnglish(responseText, language);

      // Send text response
      await this.bot.sendMessage(chatId, translatedResponse);

      // Send voice response using AWS Polly (since user sent voice, reply with voice too)
      if (this.enableVoiceResponses) {
        try {
          await this.bot.sendChatAction(chatId, 'record_voice');
          const audioBuffer = await pollyService.synthesizeSpeech(translatedResponse, language);
          await this.bot.sendVoice(chatId, audioBuffer, {
            caption: '🔊 Voice response / वॉइस रिस्पॉन्स',
          });
        } catch (voiceError) {
          console.error('⚠️ Voice response failed, text sent:', voiceError.message);
        }
      }

      // Send scheme cards
      for (const scheme of matchedSchemes) {
        await this.sendSchemeCard(chatId, scheme);
      }

      // Save user profile
      await schemeService.saveUserProfile(telegramId, userProfile, language, transcript, matchedSchemes);
    } catch (error) {
      console.error('❌ Error processing voice transcript:', error);
      await this.bot.sendMessage(
        chatId,
        '⚠️ क्षमा करें, कुछ गलत हो गया। कृपया फिर से प्रयास करें।\nSorry, something went wrong. Please try again.'
      );
    }
  }

  /**
   * Send voice message using AWS Polly
   * @param {number} chatId - Chat ID
   * @param {string} text - Text to convert to speech
   * @param {string} language - Language code
   */
  async sendVoiceResponse(chatId, text, language) {
    try {
      await this.bot.sendChatAction(chatId, 'record_voice');
      const audioBuffer = await pollyService.synthesizeSpeech(text, language);
      await this.bot.sendVoice(chatId, audioBuffer);
    } catch (error) {
      console.error('❌ Failed to send voice response:', error.message);
    }
  }

  /**
   * Send formatted scheme card
   */
  async sendSchemeCard(chatId, scheme) {
    const benefits = scheme.benefits ? scheme.benefits.map((b) => `  • ${b}`).join('\n') : '';

    const message = `🏛️ *${scheme.name}*
${scheme.nameHindi || ''}

💰 *लाभ / Benefit:* ${scheme.description}

${benefits ? `*मुख्य लाभ / Key Benefits:*\n${benefits}\n` : ''}
${scheme.benefitAmount > 0 ? `💵 *राशि / Amount:* ₹${scheme.benefitAmount.toLocaleString('en-IN')}/year\n` : ''}
🔗 *आवेदन करें / Apply:* ${scheme.officialWebsite}

📋 *Category:* ${scheme.category}`;

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  }

  /**
   * Set webhook for production
   */
  async setWebhook(webhookUrl) {
    if (!this.bot) return;

    try {
      await this.bot.setWebHook(webhookUrl);
      console.log(`✅ Webhook set: ${webhookUrl}`);
    } catch (error) {
      console.error('❌ Failed to set webhook:', error);
    }
  }

  /**
   * Process webhook update
   */
  async processUpdate(update) {
    if (!this.bot) return;

    try {
      await this.bot.processUpdate(update);
    } catch (error) {
      console.error('❌ Error processing webhook update:', error);
    }
  }
}

export default JanSaathiBot;
