# JanSaathi - Quick Start Guide

## Prerequisites Check

Before starting, ensure you have:
- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] AWS account with credentials
- [ ] AWS CLI configured (optional, for infrastructure setup)

## Step-by-Step Setup (15 minutes)

### Step 1: Install Dependencies (5 min)

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

### Step 2: Configure Backend Environment (2 min)

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your credentials:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_actual_key_here
AWS_SECRET_ACCESS_KEY=your_actual_secret_here
S3_BUCKET_NAME=jansaathi-audio-test

# Optional: For Telegram bot
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather

PORT=3001
NODE_ENV=development
```

### Step 3: Configure Frontend Environment (1 min)

```bash
cd ../frontend
cp .env.example .env
```

The default should work:
```env
VITE_API_URL=http://localhost:3001
```

### Step 4: Setup AWS Infrastructure (3 min)

**Option A: Using AWS CLI (Recommended)**
```bash
cd ../scripts
bash setup-aws.sh
```

**Option B: Manual Setup via AWS Console**
1. Create DynamoDB table `jansaathi_schemes` with partition key `schemeId` (String)
2. Create DynamoDB table `jansaathi_users` with partition key `telegramId` (String)
3. Create S3 bucket `jansaathi-audio-yourname`
4. Set lifecycle policy on S3 bucket to delete objects after 1 day

### Step 5: Seed Database (1 min)

```bash
cd ../backend
npm run seed
```

You should see:
```
🌱 JanSaathi Database Seeding Script
=====================================

📊 Seeding 20 welfare schemes into DynamoDB...

✅ Loaded: PM-KISAN (pm-kisan)
✅ Loaded: PM Awas Yojana Gramin (pm-awas-yojana)
...
✅ All schemes loaded successfully!
```

### Step 6: Start the Application (2 min)

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

You should see:
```
🏛️  JanSaathi Backend Server
============================

🔧 Initializing AWS clients for region: us-east-1
✅ AWS clients initialized successfully
✅ Server running on port 3001
📍 Health check: http://localhost:3001/health
📍 API endpoint: http://localhost:3001/api/check-eligibility

🚀 Ready to serve citizens!
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

You should see:
```
  VITE v5.0.8  ready in 500 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

### Step 7: Test the Application

Open your browser and visit:

1. **Chat Interface**: http://localhost:3000/chat
   - Click on demo personas to test
   - Try typing your own message

2. **Dashboard**: http://localhost:3000/dashboard
   - View statistics and charts
   - See recent queries

3. **Health Check**: http://localhost:3001/health
   - Verify backend is running

## 🧪 Testing Demo Personas

### Persona 1: Ramesh (Farmer, Hindi)
Click "Ramesh (Farmer, UP)" button or type:
```
Main UP ka kisan hoon, 2 acre zameen hai, meri umar 45 saal hai, BPL card bhi hai
```

**Expected Result**: PM-KISAN, PM Fasal Bima Yojana, Kisan Credit Card, PM Awas Yojana

### Persona 2: Lakshmi (SHG Member, Tamil)
Click "Lakshmi (SHG, Tamil Nadu)" button or type:
```
Naan Tamil Nadu-la irukken, en veettula 3 pillaikal irukku, BPL card irukku
```

**Expected Result**: Ujjwala, PM Awas Yojana, Ayushman Bharat, Anganwadi Services

### Persona 3: Arjun (Student, English)
Click "Arjun (Student, Karnataka)" button or type:
```
I am a SC category student from Karnataka, studying in class 11, family income is 1 lakh per year
```

**Expected Result**: NSP Post-Matric Scholarship SC, Ayushman Bharat, PM Suraksha Bima Yojana

## 🔍 Troubleshooting

### Backend won't start
```bash
# Check if port 3001 is already in use
netstat -ano | findstr :3001  # Windows
lsof -i :3001                 # Mac/Linux

# Check AWS credentials
aws sts get-caller-identity
```

### Frontend won't start
```bash
# Check if port 3000 is already in use
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Mac/Linux

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### AWS Connection Errors
- Verify AWS credentials in `.env`
- Check IAM permissions for Bedrock, DynamoDB, S3, Translate
- Ensure region is set to `us-east-1`
- Test with: `aws dynamodb list-tables --region us-east-1`

### No schemes returned
- Verify database seeding completed successfully
- Check DynamoDB table has data:
  ```bash
  aws dynamodb scan --table-name jansaathi_schemes --region us-east-1 --max-items 5
  ```

### Bedrock errors
- Ensure you have access to Claude Haiku model in us-east-1
- Check model ID: `anthropic.claude-haiku-20240307-v1:0`
- Request access via AWS Console if needed

## 📊 What You Should See

### Chat Interface Features:
✅ Three demo persona buttons at the top
✅ Chat messages appear in bubbles (orange for user, gray for bot)
✅ Scheme cards with details, benefits, and "Apply Now" links
✅ Loading animation while processing
✅ Responsive design

### Dashboard Features:
✅ Three stat cards (Total Users, Total Queries, Penetration Rate)
✅ Bar chart showing top queried schemes
✅ Recent queries table with timestamps
✅ Auto-refresh every 30 seconds

## 🎯 Next Steps

Once the prototype is running:

1. **Test Multi-Language**: Try messages in Hindi, Tamil, or English
2. **Check Scheme Matching**: Verify correct schemes are returned
3. **View Dashboard**: Check statistics and visualizations
4. **Test API Directly**: 
   ```bash
   curl -X POST http://localhost:3001/api/check-eligibility \
     -H "Content-Type: application/json" \
     -d '{"message": "I am a farmer from UP", "userId": "test-123"}'
   ```

## 🚀 Optional: Add Telegram Bot

To enable Telegram bot functionality:

1. Get bot token from @BotFather on Telegram
2. Add token to `backend/.env`
3. Create `backend/src/bot/telegramBot.js` (template available in design doc)
4. Initialize bot in `backend/src/index.js`
5. Test by messaging your bot on Telegram

## 📝 Demo Script for Presentation

1. **Show Chat Interface**: "This is where citizens interact with JanSaathi"
2. **Click Ramesh Persona**: "Let's test with a farmer from Uttar Pradesh"
3. **Show Results**: "The AI extracted his profile and matched 4 relevant schemes"
4. **Click Scheme Card**: "Each scheme shows benefits and application links"
5. **Switch to Dashboard**: "Panchayat officials can monitor scheme awareness"
6. **Show Chart**: "This shows which schemes are most queried"
7. **Highlight Stats**: "42.5% penetration rate - our goal is to increase this"

## 🎉 Success Criteria

Your prototype is working correctly if:
- ✅ Demo personas return relevant schemes
- ✅ Scheme cards display with correct information
- ✅ Dashboard shows statistics and charts
- ✅ Multi-language detection works
- ✅ No console errors in browser or terminal
- ✅ Response time is under 10 seconds

---

**Need Help?** Check the main README.md or IMPLEMENTATION_STATUS.md for more details.
