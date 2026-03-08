import { SNSClient, PublishCommand, CreateTopicCommand, SubscribeCommand } from '@aws-sdk/client-sns';
import dotenv from 'dotenv';

dotenv.config();

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

/**
 * AWS SNS Notification Service
 * Send notifications to users about:
 * - New scheme releases
 * - Application deadline reminders
 * - Eligibility updates
 * - System alerts
 */
class SNSService {
  constructor() {
    this.client = new SNSClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    // Topic ARNs (will be created if not exist)
    this.topics = {
      schemeAlerts: process.env.SNS_TOPIC_SCHEME_ALERTS,
      deadlineReminders: process.env.SNS_TOPIC_DEADLINE_REMINDERS,
      systemAlerts: process.env.SNS_TOPIC_SYSTEM_ALERTS,
    };

    console.log('✅ AWS SNS service initialized');
  }

  /**
   * Create an SNS topic
   * @param {string} topicName - Name for the topic
   * @returns {Promise<string>} Topic ARN
   */
  async createTopic(topicName) {
    try {
      const command = new CreateTopicCommand({
        Name: topicName,
        Tags: [
          { Key: 'Application', Value: 'JanSaathi' },
          { Key: 'Environment', Value: process.env.NODE_ENV || 'development' },
        ],
      });

      const response = await this.client.send(command);
      console.log(`✅ Created SNS topic: ${topicName}`);
      return response.TopicArn;
    } catch (error) {
      console.error('❌ Failed to create topic:', error.message);
      throw error;
    }
  }

  /**
   * Subscribe an email to a topic
   * @param {string} topicArn - Topic ARN
   * @param {string} email - Email address
   * @returns {Promise<string>} Subscription ARN
   */
  async subscribeEmail(topicArn, email) {
    try {
      const command = new SubscribeCommand({
        TopicArn: topicArn,
        Protocol: 'email',
        Endpoint: email,
      });

      const response = await this.client.send(command);
      console.log(`✅ Subscribed ${email} to topic`);
      return response.SubscriptionArn;
    } catch (error) {
      console.error('❌ Failed to subscribe:', error.message);
      throw error;
    }
  }

  /**
   * Subscribe a phone number to a topic for SMS
   * @param {string} topicArn - Topic ARN
   * @param {string} phoneNumber - Phone number in E.164 format
   * @returns {Promise<string>} Subscription ARN
   */
  async subscribeSMS(topicArn, phoneNumber) {
    try {
      const command = new SubscribeCommand({
        TopicArn: topicArn,
        Protocol: 'sms',
        Endpoint: phoneNumber,
      });

      const response = await this.client.send(command);
      console.log(`✅ Subscribed ${phoneNumber} to topic`);
      return response.SubscriptionArn;
    } catch (error) {
      console.error('❌ Failed to subscribe SMS:', error.message);
      throw error;
    }
  }

  /**
   * Publish a message to a topic
   * @param {string} topicArn - Topic ARN
   * @param {string} message - Message text
   * @param {string} subject - Optional subject for email
   * @returns {Promise<string>} Message ID
   */
  async publishToTopic(topicArn, message, subject = 'JanSaathi Alert') {
    try {
      const command = new PublishCommand({
        TopicArn: topicArn,
        Message: message,
        Subject: subject,
      });

      const response = await this.client.send(command);
      console.log(`✅ Published message to topic: ${response.MessageId}`);
      return response.MessageId;
    } catch (error) {
      console.error('❌ Failed to publish message:', error.message);
      throw error;
    }
  }

  /**
   * Send SMS directly to a phone number
   * @param {string} phoneNumber - Phone number in E.164 format (+91...)
   * @param {string} message - SMS message (max 160 chars for transactional)
   * @returns {Promise<string>} Message ID
   */
  async sendSMS(phoneNumber, message) {
    try {
      const command = new PublishCommand({
        PhoneNumber: phoneNumber,
        Message: message.substring(0, 160), // SMS limit
        MessageAttributes: {
          'AWS.SNS.SMS.SenderID': {
            DataType: 'String',
            StringValue: 'JanSaathi',
          },
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional', // High priority
          },
        },
      });

      const response = await this.client.send(command);
      console.log(`✅ SMS sent to ${phoneNumber}: ${response.MessageId}`);
      return response.MessageId;
    } catch (error) {
      console.error('❌ Failed to send SMS:', error.message);
      throw error;
    }
  }

  /**
   * Send scheme alert notification
   * @param {Object} scheme - Scheme information
   * @param {string} targetState - Target state for notification
   */
  async sendSchemeAlert(scheme, targetState = 'all') {
    const message = `🏛️ New Scheme Alert!

${scheme.name}
${scheme.nameHindi || ''}

${scheme.description}

💰 Benefit: ${scheme.benefitAmount > 0 ? `₹${scheme.benefitAmount.toLocaleString('en-IN')}/year` : 'Various benefits'}

📋 Eligibility: ${scheme.category}

🔗 Apply: ${scheme.officialWebsite}

Reply STOP to unsubscribe.`;

    if (this.topics.schemeAlerts) {
      await this.publishToTopic(this.topics.schemeAlerts, message, `New Scheme: ${scheme.name}`);
    }
  }

  /**
   * Send deadline reminder
   * @param {Object} scheme - Scheme with deadline
   * @param {string} deadline - Deadline date string
   */
  async sendDeadlineReminder(scheme, deadline) {
    const message = `⏰ Deadline Reminder!

${scheme.name} application deadline is approaching.

📅 Last Date: ${deadline}

🔗 Apply Now: ${scheme.officialWebsite}

Don't miss out on ₹${scheme.benefitAmount?.toLocaleString('en-IN') || 'NA'}/year benefit!`;

    if (this.topics.deadlineReminders) {
      await this.publishToTopic(this.topics.deadlineReminders, message, `Deadline: ${scheme.name}`);
    }
  }

  /**
   * Send system alert (for admins)
   * @param {string} alertType - Type of alert
   * @param {string} details - Alert details
   */
  async sendSystemAlert(alertType, details) {
    const message = `🚨 JanSaathi System Alert

Type: ${alertType}
Time: ${new Date().toISOString()}

Details:
${details}`;

    if (this.topics.systemAlerts) {
      await this.publishToTopic(this.topics.systemAlerts, message, `System Alert: ${alertType}`);
    }
  }
}

export default new SNSService();
