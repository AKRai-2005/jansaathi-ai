import Groq from 'groq-sdk';
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient } from '../config/aws.js';
import ragService from './ragService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Feature flag and configuration
const USE_BEDROCK = process.env.FEATURE_FLAG_USE_BEDROCK === 'true';
const USE_RAG = process.env.FEATURE_FLAG_USE_RAG !== 'false';
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';
const BEDROCK_MAX_TOKENS = parseInt(process.env.BEDROCK_MAX_TOKENS) || 1024;
const BEDROCK_TEMPERATURE = parseFloat(process.env.BEDROCK_TEMPERATURE) || 0.7;

// Circuit breaker configuration
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 60000; // 60 seconds

class AIService {
  constructor() {
    // Groq client (legacy)
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
    this.groqModel = 'llama-3.1-8b-instant';
    
    // Bedrock configuration
    this.bedrockModelId = BEDROCK_MODEL_ID;
    this.bedrockMaxTokens = BEDROCK_MAX_TOKENS;
    this.bedrockTemperature = BEDROCK_TEMPERATURE;
    
    // Feature flags
    this.useBedrock = USE_BEDROCK;
    this.useRAG = USE_RAG;
    
    // Common settings
    this.maxRetries = 3;
    this.timeout = 10000; // 10 seconds
    
    // Circuit breaker state
    this.circuitBreaker = {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
    };

    // Fallback responses cache
    this.fallbackResponses = {
      profileExtraction: { query_intent: 'find_schemes' },
      responseGeneration: 'I apologize, but I am temporarily unable to process your request. Please try again in a moment.',
    };

    console.log(`🤖 AI Service initialized: ${this.useBedrock ? 'Bedrock' : 'Groq'}, RAG: ${this.useRAG ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check circuit breaker status
   * @returns {boolean} True if circuit is open (failing)
   */
  isCircuitOpen() {
    if (!this.circuitBreaker.isOpen) return false;
    
    // Check if reset timeout has passed
    if (Date.now() - this.circuitBreaker.lastFailure > CIRCUIT_BREAKER_RESET_MS) {
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.failures = 0;
      console.log('🔌 Circuit breaker reset');
      return false;
    }
    
    return true;
  }

  /**
   * Record a failure for circuit breaker
   */
  recordFailure() {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();
    
    if (this.circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.isOpen = true;
      console.log('🔴 Circuit breaker opened - too many failures');
    }
  }

  /**
   * Record a success, reset failure count
   */
  recordSuccess() {
    this.circuitBreaker.failures = 0;
  }

  /**
   * Get circuit breaker status
   * @returns {Object} Circuit breaker state
   */
  getCircuitBreakerStatus() {
    return {
      isOpen: this.circuitBreaker.isOpen,
      failures: this.circuitBreaker.failures,
      threshold: CIRCUIT_BREAKER_THRESHOLD,
      resetMs: CIRCUIT_BREAKER_RESET_MS,
      timeSinceLastFailure: this.circuitBreaker.lastFailure 
        ? Date.now() - this.circuitBreaker.lastFailure 
        : null,
    };
  }

  /**
   * Extract user profile from natural language text
   * Uses Bedrock or Groq based on feature flag
   * @param {string} text - User's message
   * @returns {Promise<Object>} Extracted profile
   */
  async extractProfile(text) {
    console.log('🤖 Extracting profile from text...');

    // Check circuit breaker
    if (this.isCircuitOpen()) {
      console.log('⚠️  Circuit breaker open - returning fallback profile');
      return this.fallbackResponses.profileExtraction;
    }

    const prompt = `You are JanSaathi, an AI assistant helping Indian citizens find government welfare schemes. Extract structured information from the user's message.

Return ONLY valid JSON with no extra text or markdown. If a field cannot be determined, use null.

Be generous in interpretation:
- If someone says "garib hoon" (I am poor) or "BPL card hai", set bpl_card to true
- If they say "2 acre zameen" (2 acres land) or "kheti karta hoon", set occupation to "farmer"
- If they mention "padhai" or "student", set occupation to "student"
- Extract age from phrases like "45 saal", "meri umar 30 hai"
- Extract state from Indian state names in any language
- Extract caste from SC/ST/OBC/General mentions

User message: "${text}"

Return JSON with these exact fields:
{
  "age": number or null,
  "gender": "male" or "female" or null,
  "state": string or null,
  "occupation": "farmer" or "student" or "daily_wage" or "small_business" or "unemployed" or "homemaker" or "self_employed" or "artisan" or "entrepreneur" or null,
  "land_acres": number or null,
  "annual_income": number or null,
  "caste": "General" or "OBC" or "SC" or "ST" or null,
  "bpl_card": boolean or null,
  "disability": boolean or null,
  "num_children": number or null,
  "query_intent": "find_schemes" or "apply_help" or "document_help" or "status_check"
}`;

    try {
      const response = this.useBedrock 
        ? await this.invokeBedrock(prompt) 
        : await this.invokeGroq(prompt);
      
      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const profile = JSON.parse(jsonMatch[0]);
      this.recordSuccess();
      console.log('✅ Profile extracted:', profile);
      return profile;
    } catch (error) {
      this.recordFailure();
      console.error('❌ Profile extraction failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate natural language response in user's language
   * Optionally uses RAG for context enhancement
   * @param {Array} schemes - Matched schemes
   * @param {Object} userProfile - User's profile
   * @param {string} language - Target language code
   * @param {string} originalQuery - Original user query (for RAG)
   * @returns {Promise<string>} Generated response
   */
  async generateResponse(schemes, userProfile, language, originalQuery = null) {
    // Use RAG-enhanced generation if enabled and query is provided
    if (this.useRAG && originalQuery) {
      return this.generateResponseWithRAG(schemes, userProfile, language, originalQuery);
    }

    return this.generateBasicResponse(schemes, userProfile, language);
  }

  /**
   * Generate basic response without RAG
   * @param {Array} schemes - Matched schemes
   * @param {Object} userProfile - User's profile
   * @param {string} language - Target language code
   * @returns {Promise<string>} Generated response
   */
  async generateBasicResponse(schemes, userProfile, language) {
    console.log(`🤖 Generating basic response in language: ${language}`);

    // Check circuit breaker
    if (this.isCircuitOpen()) {
      console.log('⚠️  Circuit breaker open - returning fallback response');
      return this.fallbackResponses.responseGeneration;
    }

    const languageNames = {
      hi: 'Hindi',
      ta: 'Tamil',
      te: 'Telugu',
      mr: 'Marathi',
      bn: 'Bengali',
      en: 'English',
    };

    const detectedLanguage = languageNames[language] || 'English';

    const schemesText = schemes
      .map((s, i) => `${i + 1}. ${s.name}: ${s.description}`)
      .join('\n');

    const prompt = `You are JanSaathi, a warm and friendly assistant helping Indian citizens find government welfare schemes.

Respond in ${detectedLanguage}. Use simple words that a villager can understand. Do NOT use government jargon. Be encouraging. Keep response under 200 words.

Address the user respectfully:
- Hindi: use "aap"
- Tamil: use "neenga"
- Other languages: use respectful forms

User profile: Age ${userProfile.age || 'unknown'}, ${userProfile.occupation || 'citizen'} from ${userProfile.state || 'India'}

Matched schemes:
${schemesText}

Generate a warm, encouraging message telling them about these schemes. Focus on benefits and how to apply.`;

    try {
      const response = this.useBedrock 
        ? await this.invokeBedrock(prompt) 
        : await this.invokeGroq(prompt);
      this.recordSuccess();
      console.log('✅ Response generated');
      return response;
    } catch (error) {
      this.recordFailure();
      console.error('❌ Response generation failed:', error.message);
      return `Found ${schemes.length} schemes for you. Check the details below.`;
    }
  }

  /**
   * Generate RAG-enhanced response with context from vector search
   * @param {Array} schemes - Matched schemes
   * @param {Object} userProfile - User's profile
   * @param {string} language - Target language code
   * @param {string} query - User query
   * @returns {Promise<string>} Generated response with source attribution
   */
  async generateResponseWithRAG(schemes, userProfile, language, query) {
    console.log(`🤖 Generating RAG-enhanced response in language: ${language}`);

    try {
      // Retrieve relevant context
      const context = await ragService.retrieveContext(query);

      const languageNames = {
        hi: 'Hindi',
        ta: 'Tamil',
        te: 'Telugu',
        mr: 'Marathi',
        bn: 'Bengali',
        en: 'English',
      };

      const detectedLanguage = languageNames[language] || 'English';

      // Build context-enhanced prompt
      const contextSection = context.hasContent
        ? `\n\nRELEVANT CONTEXT:\n${context.contextText}\n\nUse the above context to provide accurate information.`
        : '';

      const schemesText = schemes
        .map((s, i) => `${i + 1}. ${s.name}: ${s.description}`)
        .join('\n');

      const prompt = `You are JanSaathi, a warm and friendly assistant helping Indian citizens find government welfare schemes.

INSTRUCTIONS:
- Respond in ${detectedLanguage}
- Use simple words that a villager can understand
- Do NOT use government jargon
- Be encouraging and helpful
- Keep response under 200 words
- When referencing schemes, mention them by name${contextSection}

User profile: Age ${userProfile.age || 'unknown'}, ${userProfile.occupation || 'citizen'} from ${userProfile.state || 'India'}

Matched schemes for this user:
${schemesText}

Generate a warm, encouraging message telling them about these schemes. Focus on:
1. Which schemes they qualify for
2. Key benefits they can receive
3. How to apply (if known from context)`;

      // Check circuit breaker before calling LLM
      if (this.isCircuitOpen()) {
        console.log('⚠️  Circuit breaker open - returning basic response');
        return this.generateBasicResponse(schemes, userProfile, language);
      }

      const response = this.useBedrock 
        ? await this.invokeBedrock(prompt) 
        : await this.invokeGroq(prompt);
      
      this.recordSuccess();

      // Store successful interaction for learning (don't await)
      if (context.hasContent) {
        ragService.storeInteraction(
          userProfile.userId || 'anonymous',
          query,
          response,
          schemes
        ).catch((err) => console.error('Failed to store interaction:', err.message));
      }

      // Add source attribution if context was used
      let finalResponse = response;
      if (context.sources && context.sources.length > 0) {
        const sourceNames = [...new Set(context.sources.map((s) => s.schemeName))].slice(0, 3);
        console.log(`📚 Sources used: ${sourceNames.join(', ')}`);
      }

      console.log('✅ RAG-enhanced response generated');
      return finalResponse;
    } catch (error) {
      console.error('❌ RAG response generation failed, falling back:', error.message);
      return this.generateBasicResponse(schemes, userProfile, language);
    }
  }

  /**
   * Invoke AWS Bedrock Claude model with retry logic
   * @param {string} prompt - The prompt to send
   * @param {string} systemPrompt - Optional system prompt
   * @returns {Promise<string>} Model response
   */
  async invokeBedrock(prompt, systemPrompt = null) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Bedrock API call (attempt ${attempt}/${this.maxRetries})...`);
        const startTime = Date.now();

        const messages = [{ role: 'user', content: prompt }];
        
        const body = {
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: this.bedrockMaxTokens,
          temperature: this.bedrockTemperature,
          messages,
        };

        if (systemPrompt) {
          body.system = systemPrompt;
        }

        const command = new InvokeModelCommand({
          modelId: this.bedrockModelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify(body),
        });

        const response = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const text = responseBody.content?.[0]?.text || '';

        const elapsedTime = Date.now() - startTime;
        console.log(`✅ Bedrock response received in ${elapsedTime}ms (${text.length} chars)`);
        
        return text;
      } catch (error) {
        console.error(`❌ Bedrock attempt ${attempt} failed:`, error.message);

        if (attempt === this.maxRetries) {
          // Bedrock exhausted — automatically fall back to Groq
          console.warn('⚠️  Bedrock unavailable, falling back to Groq...');
          return this.invokeGroq(prompt);
        }

        // Exponential backoff before next Bedrock retry
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Invoke Groq Llama model with retry logic
   * @param {string} prompt - The prompt to send
   * @returns {Promise<string>} Model response
   */
  async invokeGroq(prompt) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Groq API call (attempt ${attempt}/${this.maxRetries})...`);

        const completion = await this.groq.chat.completions.create({
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          model: this.groqModel,
          temperature: 0.7,
          max_tokens: 1024,
        });

        const text = completion.choices[0]?.message?.content || '';

        console.log(`✅ Groq response received (${text.length} chars)`);
        return text;
      } catch (error) {
        console.error(`❌ Groq attempt ${attempt} failed:`, error.message);

        if (attempt === this.maxRetries) {
          throw new Error(`Groq failed after ${this.maxRetries} attempts: ${error.message}`);
        }

        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}

export default new AIService();
