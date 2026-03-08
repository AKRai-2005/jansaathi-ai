import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { TranslateClient } from '@aws-sdk/client-translate';
import { TranscribeClient } from '@aws-sdk/client-transcribe';
import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

console.log(`🔧 Initializing AWS clients for region: ${AWS_REGION}`);

// DynamoDB Client
const dynamoDBClient = new DynamoDBClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// DynamoDB Document Client (simplified API)
export const docClient = DynamoDBDocumentClient.from(dynamoDBClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

// Bedrock Runtime Client (for Claude Haiku)
export const bedrockClient = new BedrockRuntimeClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// AWS Translate Client
export const translateClient = new TranslateClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// AWS Transcribe Client
export const transcribeClient = new TranscribeClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// S3 Client
export const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Configuration constants
export const AWS_CONFIG = {
  REGION: AWS_REGION,
  S3_BUCKET: process.env.S3_BUCKET_NAME,
  BEDROCK_MODEL_ID: 'anthropic.claude-3-haiku-20240307-v1:0',
  DYNAMODB_TABLES: {
    SCHEMES: 'jansaathi_schemes',
    USERS: 'jansaathi_users',
  },
};

console.log('✅ AWS clients initialized successfully');
