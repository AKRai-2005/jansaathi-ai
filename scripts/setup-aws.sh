#!/bin/bash

# JanSaathi AWS Infrastructure Setup Script
# This script creates DynamoDB tables and S3 bucket for the JanSaathi application

set -e

REGION="us-east-1"
S3_BUCKET_NAME="${S3_BUCKET_NAME:-jansaathi-audio-$(date +%s)}"

echo "🏛️  JanSaathi AWS Infrastructure Setup"
echo "========================================"
echo "Region: $REGION"
echo "S3 Bucket: $S3_BUCKET_NAME"
echo ""

# Create DynamoDB table for schemes
echo "📊 Creating DynamoDB table: jansaathi_schemes..."
aws dynamodb create-table \
    --table-name jansaathi_schemes \
    --attribute-definitions \
        AttributeName=schemeId,AttributeType=S \
    --key-schema \
        AttributeName=schemeId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region $REGION \
    --tags Key=Project,Value=JanSaathi Key=Environment,Value=Development \
    2>/dev/null || echo "Table jansaathi_schemes already exists"

# Create DynamoDB table for users
echo "📊 Creating DynamoDB table: jansaathi_users..."
aws dynamodb create-table \
    --table-name jansaathi_users \
    --attribute-definitions \
        AttributeName=telegramId,AttributeType=S \
    --key-schema \
        AttributeName=telegramId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region $REGION \
    --tags Key=Project,Value=JanSaathi Key=Environment,Value=Development \
    2>/dev/null || echo "Table jansaathi_users already exists"

# Wait for tables to be active
echo "⏳ Waiting for tables to be active..."
aws dynamodb wait table-exists --table-name jansaathi_schemes --region $REGION
aws dynamodb wait table-exists --table-name jansaathi_users --region $REGION

# Create S3 bucket for audio files
echo "🪣 Creating S3 bucket: $S3_BUCKET_NAME..."
aws s3 mb s3://$S3_BUCKET_NAME --region $REGION 2>/dev/null || echo "Bucket $S3_BUCKET_NAME already exists"

# Configure S3 bucket lifecycle policy (delete after 24 hours)
echo "⏰ Configuring S3 lifecycle policy (24-hour deletion)..."
cat > /tmp/lifecycle-policy.json <<EOF
{
  "Rules": [
    {
      "Id": "DeleteAudioAfter24Hours",
      "Status": "Enabled",
      "Prefix": "audio/",
      "Expiration": {
        "Days": 1
      }
    }
  ]
}
EOF

aws s3api put-bucket-lifecycle-configuration \
    --bucket $S3_BUCKET_NAME \
    --lifecycle-configuration file:///tmp/lifecycle-policy.json \
    --region $REGION

rm /tmp/lifecycle-policy.json

# Enable encryption for S3 bucket
echo "🔒 Enabling S3 bucket encryption..."
aws s3api put-bucket-encryption \
    --bucket $S3_BUCKET_NAME \
    --server-side-encryption-configuration '{
        "Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            }
        }]
    }' \
    --region $REGION

echo ""
echo "✅ AWS Infrastructure Setup Complete!"
echo ""
echo "📝 Next Steps:"
echo "1. Update backend/.env with S3_BUCKET_NAME=$S3_BUCKET_NAME"
echo "2. Run 'npm run seed' from backend directory to load schemes"
echo "3. Start the backend server with 'npm start'"
echo ""
echo "🔍 Verify setup:"
echo "   aws dynamodb list-tables --region $REGION"
echo "   aws s3 ls"
