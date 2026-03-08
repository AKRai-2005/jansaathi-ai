console.log('JanSaathi Seed Script');
import { schemes } from '../src/utils/schemeData.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';
dotenv.config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const docClient = DynamoDBDocumentClient.from(client);

async function seed() {
  console.log('Seeding', schemes.length, 'schemes...');
  for (const scheme of schemes) {
    await docClient.send(new PutCommand({ TableName: 'jansaathi_schemes', Item: scheme }));
    console.log('Loaded:', scheme.name);
  }
  console.log('Done!');
}
seed().catch(console.error);
