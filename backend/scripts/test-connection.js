import { docClient, AWS_CONFIG } from '../src/config/aws.js';
import { ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

console.log('Testing AWS Connection...');
console.log('Region:', AWS_CONFIG.REGION);
console.log('');

const client = new DynamoDBClient({
  region: AWS_CONFIG.REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  requestHandler: {
    requestTimeout: 5000
  }
});

async function testConnection() {
  try {
    console.log('Attempting to list DynamoDB tables...');
    const command = new ListTablesCommand({});
    const response = await client.send(command);
    
    console.log('SUCCESS! Connected to AWS DynamoDB');
    console.log('Tables found:', response.TableNames);
    
    if (response.TableNames.includes('jansaathi_schemes')) {
      console.log('✓ jansaathi_schemes table exists');
    } else {
      console.log('✗ jansaathi_schemes table NOT found');
    }
    
    if (response.TableNames.includes('jansaathi_users')) {
      console.log('✓ jansaathi_users table exists');
    } else {
      console.log('✗ jansaathi_users table NOT found');
    }
  } catch (error) {
    console.error('FAILED to connect to AWS DynamoDB');
    console.error('Error:', error.name);
    console.error('Message:', error.message);
    process.exit(1);
  }
}

testConnection();
