import { ScanCommand, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, AWS_CONFIG } from '../config/aws.js';

class SchemeService {
  constructor() {
    this.schemesTable = AWS_CONFIG.DYNAMODB_TABLES.SCHEMES;
    this.usersTable = AWS_CONFIG.DYNAMODB_TABLES.USERS;
  }

  /**
   * Get all schemes from DynamoDB
   * @returns {Promise<Array>} All schemes
   */
  async getAllSchemes() {
    console.log('📊 Fetching all schemes from DynamoDB...');

    try {
      const command = new ScanCommand({
        TableName: this.schemesTable,
      });

      const response = await docClient.send(command);
      console.log(`✅ Retrieved ${response.Items.length} schemes`);
      return response.Items || [];
    } catch (error) {
      console.error('❌ Failed to fetch schemes:', error.message);
      throw error;
    }
  }

  /**
   * Match schemes against user profile and return ranked results
   * @param {Object} userProfile - Extracted user profile
   * @returns {Promise<Array>} Top matching schemes
   */
  async matchSchemes(userProfile) {
    console.log('🎯 Matching schemes for profile:', userProfile);

    const allSchemes = await this.getAllSchemes();
    const scoredSchemes = [];

    for (const scheme of allSchemes) {
      const score = this.calculateRelevanceScore(scheme, userProfile);
      
      if (score > 0) {
        scoredSchemes.push({
          ...scheme,
          relevanceScore: score,
        });
      }
    }

    // Sort by relevance score (descending), then by benefit amount (descending)
    scoredSchemes.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return (b.benefitAmount || 0) - (a.benefitAmount || 0);
    });

    // Return top 5 schemes
    const topSchemes = scoredSchemes.slice(0, 5);
    console.log(`✅ Found ${topSchemes.length} matching schemes`);
    
    return topSchemes;
  }

  /**
   * Calculate relevance score for a scheme based on user profile
   * @param {Object} scheme - Scheme data
   * @param {Object} profile - User profile
   * @returns {number} Relevance score
   */
  calculateRelevanceScore(scheme, profile) {
    let score = 0;
    const eligibility = scheme.eligibility || {};

    // Age match (+2 points)
    if (profile.age && eligibility.ageMin !== undefined && eligibility.ageMax !== undefined) {
      if (profile.age >= eligibility.ageMin && profile.age <= eligibility.ageMax) {
        score += 2;
      } else {
        return 0; // Hard requirement - age must match if specified
      }
    }

    // Occupation match (+5 points)
    if (profile.occupation && eligibility.occupations && eligibility.occupations.length > 0) {
      if (eligibility.occupations.includes(profile.occupation)) {
        score += 5;
      }
    } else if (!eligibility.occupations || eligibility.occupations.length === 0) {
      score += 1; // General schemes get some score
    }

    // State match (+3 points)
    if (profile.state && eligibility.states && eligibility.states.length > 0) {
      const normalizedState = profile.state.toLowerCase();
      const stateMatch = eligibility.states.some(
        (s) => s.toLowerCase() === normalizedState
      );
      if (stateMatch) {
        score += 3;
      } else {
        return 0; // Hard requirement - state must match if specified
      }
    } else if (!eligibility.states || eligibility.states.length === 0) {
      score += 1; // All-India schemes get some score
    }

    // Income eligibility (+3 points)
    if (profile.annual_income && eligibility.incomeMax) {
      if (profile.annual_income <= eligibility.incomeMax) {
        score += 3;
      } else {
        return 0; // Hard requirement - income must be below threshold
      }
    }

    // Caste match (+3 points)
    if (profile.caste && eligibility.caste && eligibility.caste.length > 0) {
      if (eligibility.caste.includes(profile.caste)) {
        score += 3;
      }
    } else if (!eligibility.caste || eligibility.caste.length === 0) {
      score += 1; // General category schemes
    }

    // BPL match (+4 points)
    if (eligibility.bplRequired === true) {
      if (profile.bpl_card === true) {
        score += 4;
      } else {
        return 0; // Hard requirement - BPL card required
      }
    } else {
      score += 1; // Non-BPL schemes accessible to all
    }

    // Gender match (+1 point)
    if (profile.gender && eligibility.target_gender) {
      if (eligibility.target_gender === 'all' || eligibility.target_gender === profile.gender) {
        score += 1;
      } else {
        return 0; // Hard requirement - gender must match if specified
      }
    }

    return score;
  }

  /**
   * Save user profile to DynamoDB
   * @param {string} telegramId - Telegram user ID
   * @param {Object} profile - User profile
   * @param {string} language - Preferred language
   * @param {string} query - Original query text
   * @param {Array} matchedSchemes - Matched scheme IDs
   */
  async saveUserProfile(telegramId, profile, language, query, matchedSchemes) {
    console.log(`💾 Saving profile for user: ${telegramId}`);

    try {
      // Check if user exists
      const existingUser = await this.getUserProfile(telegramId);

      const timestamp = new Date().toISOString();
      const queryEntry = {
        timestamp,
        query,
        matchedSchemes: matchedSchemes.map((s) => s.schemeId),
      };

      if (existingUser) {
        // Update existing user
        const command = new UpdateCommand({
          TableName: this.usersTable,
          Key: { telegramId },
          UpdateExpression:
            'SET profile = :profile, preferredLanguage = :lang, queryHistory = list_append(if_not_exists(queryHistory, :empty_list), :query), matchedSchemes = :schemes, lastUpdated = :updated',
          ExpressionAttributeValues: {
            ':profile': profile,
            ':lang': language,
            ':query': [queryEntry],
            ':schemes': Array.from(
              new Set([
                ...(existingUser.matchedSchemes || []),
                ...matchedSchemes.map((s) => s.schemeId),
              ])
            ),
            ':updated': timestamp,
            ':empty_list': [],
          },
        });

        await docClient.send(command);
        console.log('✅ User profile updated');
      } else {
        // Create new user
        const command = new PutCommand({
          TableName: this.usersTable,
          Item: {
            telegramId,
            profile,
            preferredLanguage: language,
            queryHistory: [queryEntry],
            matchedSchemes: matchedSchemes.map((s) => s.schemeId),
            createdAt: timestamp,
            lastUpdated: timestamp,
          },
        });

        await docClient.send(command);
        console.log('✅ New user profile created');
      }
    } catch (error) {
      console.error('❌ Failed to save user profile:', error.message);
      // Don't throw - profile saving is not critical
    }
  }

  /**
   * Get user profile from DynamoDB
   * @param {string} telegramId - Telegram user ID
   * @returns {Promise<Object|null>} User profile or null
   */
  async getUserProfile(telegramId) {
    try {
      const command = new GetCommand({
        TableName: this.usersTable,
        Key: { telegramId },
      });

      const response = await docClient.send(command);
      return response.Item || null;
    } catch (error) {
      console.error('❌ Failed to get user profile:', error.message);
      return null;
    }
  }

  /**
   * Get user's previously matched schemes
   * @param {string} telegramId - Telegram user ID
   * @returns {Promise<Array>} Matched schemes
   */
  async getUserSchemes(telegramId) {
    console.log(`📋 Fetching schemes for user: ${telegramId}`);

    try {
      const user = await this.getUserProfile(telegramId);
      
      if (!user || !user.matchedSchemes || user.matchedSchemes.length === 0) {
        return [];
      }

      const allSchemes = await this.getAllSchemes();
      const userSchemes = allSchemes.filter((scheme) =>
        user.matchedSchemes.includes(scheme.schemeId)
      );

      console.log(`✅ Found ${userSchemes.length} schemes for user`);
      return userSchemes;
    } catch (error) {
      console.error('❌ Failed to get user schemes:', error.message);
      return [];
    }
  }
}

export default new SchemeService();
