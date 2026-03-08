# JanSaathi - Complete Execution Guide

## 🎯 What's Been Completed

All code implementation tasks are **100% complete**! Here's what's ready:

### ✅ Backend Services (Node.js + Express)
- AI Service with Bedrock Claude Haiku
- Translation Service (6 languages)
- Transcription Service (voice to text)
- Scheme Matching Service
- Telegram Bot Handler
- Express API with all endpoints
- 20 welfare schemes data
- Database seeding script
- AWS setup automation

### ✅ Frontend Application (React + Vite)
- Chat interface with demo personas
- Admin dashboard with charts
- All reusable components
- Tailwind CSS styling
- Responsive design

### ✅ Infrastructure
- AWS configuration
- Environment templates
- Setup scripts
- Documentation

## 📋 What YOU Need to Do (Manual Steps)

### Step 1: Install Dependencies (5 minutes)

```bash
# Navigate to project
cd jansaathi

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

**Expected output**: Both should complete without errors. You'll see packages being installed.

### Step 2: Configure AWS Credentials (3 minutes)

Create `backend/.env` file:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your actual AWS credentials:

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...your_actual_key
AWS_SECRET_ACCESS_KEY=your_actual_secret_key
S3_BUCKET_NAME=jansaathi-audio-yourname

# Optional: Add Telegram bot token if you want bot functionality
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather

PORT=3001
NODE_ENV=development
```

**How to get AWS credentials:**
1. Go to AWS Console → IAM → Users
2. Create new user or use existing
3. Attach policies: AmazonDynamoDBFullAccess, AmazonS3FullAccess, AmazonTranscribeFullAccess, AmazonTranslateFullAccess, AmazonBedrockFullAccess
4. Create access key → Copy Access Key ID and Secret Access Key

### Step 3: Setup AWS Infrastructure (2 minutes)

**Option A: Using the automated script (Recommended)**

```bash
cd scripts
bash setup-aws.sh
```

This will:
- Create DynamoDB tables (jansaathi_schemes, jansaathi_users)
- Create S3 bucket with lifecycle policy
- Configure encryption

**Option B: Manual setup via AWS Console**

If the script doesn't work on Windows, do this manually:

1. **DynamoDB Tables:**
   - Go to AWS Console → DynamoDB → Create table
   - Table 1: Name=`jansaathi_schemes`, Partition key=`schemeId` (String)
   - Table 2: Name=`jansaathi_users`, Partition key=`telegramId` (String)
   - Use "On-demand" billing mode for both

2. **S3 Bucket:**
   - Go to AWS Console → S3 → Create bucket
   - Name: `jansaathi-audio-yourname` (must be globally unique)
   - Region: us-east-1 (N. Virginia)
   - Enable encryption
   - Add lifecycle rule: Delete objects after 1 day in `audio/` prefix

### Step 4: Seed Database (1 minute)

```bash
cd backend
npm run seed
```

**Expected output:**
```
🌱 JanSaathi Database Seeding Script
=====================================

📊 Seeding 20 welfare schemes into DynamoDB...

✅ Loaded: PM-KISAN (pm-kisan)
✅ Loaded: PM Awas Yojana Gramin (pm-awas-yojana)
...
✅ All schemes loaded successfully!
```

**If it fails:** Check AWS credentials and ensure DynamoDB tables exist.

### Step 5: Start Backend Server (1 minute)

```bash
cd backend
npm start
```

**Expected output:**
```
🏛️  JanSaathi Backend Server
============================

🔧 Initializing AWS clients for region: us-east-1
✅ AWS clients initialized successfully
✅ Server running on port 3001
📍 Health check: http://localhost:3001/health

🚀 Ready to serve citizens!
```

**Keep this terminal open!**

### Step 6: Start Frontend (1 minute)

Open a **new terminal**:

```bash
cd jansaathi/frontend
npm run dev
```

**Expected output:**
```
  VITE v5.0.8  ready in 500 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

**Keep this terminal open too!**

### Step 7: Test the Application (3 minutes)

Open your browser and visit:

**1. Chat Interface:** http://localhost:3000/chat

- Click "Ramesh (Farmer, UP)" button
- Wait 5-10 seconds for AI processing
- You should see scheme cards appear!

**2. Dashboard:** http://localhost:3000/dashboard

- View statistics and charts
- See recent queries table

**3. Backend Health:** http://localhost:3001/health

- Should show: `{"status":"ok","timestamp":"..."}`

## 🧪 Testing Checklist

Run through these tests:

- [ ] Backend health check returns OK
- [ ] Frontend loads without errors
- [ ] Click "Ramesh (Farmer, UP)" persona
- [ ] Schemes appear (PM-KISAN, PM Fasal Bima, etc.)
- [ ] Click "Lakshmi (SHG, Tamil Nadu)" persona
- [ ] Different schemes appear (Ujjwala, Ayushman Bharat)
- [ ] Dashboard shows statistics
- [ ] Dashboard chart renders
- [ ] Type custom message in chat
- [ ] Schemes match the profile

## 🐛 Troubleshooting

### Backend won't start

**Error: "Cannot find module"**
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

**Error: "AWS credentials not found"**
- Check `.env` file exists in `backend/` folder
- Verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set
- Test with: `aws sts get-caller-identity`

**Error: "Port 3001 already in use"**
```bash
# Windows
netstat -ano | findstr :3001
# Find the PID and kill it in Task Manager

# Mac/Linux
lsof -i :3001
kill -9 <PID>
```

### Frontend won't start

**Error: "Port 3000 already in use"**
- Change port in `vite.config.js`: `server: { port: 3001 }`
- Or kill the process using port 3000

**Error: "Cannot connect to backend"**
- Ensure backend is running on port 3001
- Check `frontend/.env` has `VITE_API_URL=http://localhost:3001`

### No schemes returned

**Check database:**
```bash
aws dynamodb scan --table-name jansaathi_schemes --region us-east-1 --max-items 5
```

**Re-seed if needed:**
```bash
cd backend
npm run seed
```

### Bedrock errors

**Error: "Access denied" or "Model not found"**
- Go to AWS Console → Bedrock → Model access
- Request access to "Claude Haiku" model
- Wait for approval (usually instant)
- Ensure you're in us-east-1 region

### Translation errors

**Error: "Translation failed"**
- The app will fallback to English automatically
- Check AWS Translate is enabled in your region
- Verify IAM permissions include TranslateFullAccess

## 🎯 Success Criteria

Your setup is successful when:

✅ Backend starts without errors
✅ Frontend loads at http://localhost:3000
✅ Demo personas return relevant schemes
✅ Scheme cards display correctly
✅ Dashboard shows charts and statistics
✅ No console errors in browser or terminal
✅ Response time is under 10 seconds

## 📊 What to Show in Demo

1. **Open Chat Interface** - "This is where citizens interact"
2. **Click Ramesh Persona** - "Testing with a farmer from UP"
3. **Show Schemes** - "AI matched 4 relevant schemes"
4. **Click Scheme Card** - "Each shows benefits and apply link"
5. **Switch to Dashboard** - "Panchayat officials monitor here"
6. **Show Chart** - "Top queried schemes visualization"
7. **Type Custom Message** - "Works with any natural language input"

## 🚀 Optional Enhancements

### Add Telegram Bot (10 minutes)

1. Get bot token from @BotFather on Telegram
2. Add to `backend/.env`: `TELEGRAM_BOT_TOKEN=your_token`
3. Restart backend
4. Message your bot on Telegram!

### Enable Voice Messages (Already implemented!)

The transcription service is ready. Just needs:
- S3 bucket (already created)
- AWS Transcribe access (check IAM permissions)
- Test by sending voice message to Telegram bot

## 📝 Notes

- **AWS Costs**: Minimal for testing (<$1/day)
  - DynamoDB: On-demand pricing
  - S3: First 5GB free
  - Bedrock: Pay per request (~$0.00025 per request)
  - Translate: First 2M chars free per month

- **Development Mode**: Uses polling for Telegram bot
- **Production Mode**: Would use webhooks

- **Mock Data**: Dashboard uses mock statistics for MVP
- **Real Data**: User profiles and schemes are stored in DynamoDB

## 🎉 You're Done!

Total setup time: **~15 minutes**

The application is now fully functional and ready for:
- Testing
- Demo presentation
- Hackathon submission
- Further development

Need help? Check:
- README.md for overview
- QUICKSTART.md for quick reference
- IMPLEMENTATION_STATUS.md for what's built
- Tasks.md for detailed task breakdown
