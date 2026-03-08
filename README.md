# JanSaathi 🏛️ - Har Yojana, Har Naagrik

**Friend of the People** - AI-powered Indian government welfare scheme discovery and guidance assistant.

## Problem Statement

700+ central and state government welfare schemes exist in India with ₹15+ lakh crore annual budget, but only 35–40% of eligible citizens receive benefits due to awareness gaps, language barriers, and process complexity. JanSaathi bridges this gap.

## Features

- 🤖 **Telegram Bot Interface** - Primary user interface with text and voice message support
- 🌐 **Multi-Language Support** - Hindi, Tamil, Telugu, Marathi, Bengali, and English
- 🎯 **AI-Powered Matching** - Amazon Bedrock Claude Haiku for intelligent profile extraction
- 📊 **Admin Dashboard** - Panchayat officials can view scheme penetration statistics
- 💬 **Web Chat Interface** - Browser-based alternative to Telegram
- 🔒 **Secure & Private** - Encrypted data storage and TLS communication

## Tech Stack

**Backend:**
- Node.js 18+ with Express.js
- Telegram Bot API (node-telegram-bot-api)
- Amazon Bedrock (Claude Haiku)
- AWS Translate, Transcribe, DynamoDB, S3
- Region: us-east-1 (N. Virginia)

**Frontend:**
- React.js with Vite
- Tailwind CSS
- Recharts for data visualization

## Quick Start in 5 Steps

### Step 1: Prerequisites

Ensure you have installed:
- Node.js 18+ ([Download](https://nodejs.org/))
- AWS CLI configured with credentials ([Setup Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))
- Telegram Bot Token from [@BotFather](https://t.me/botfather)

### Step 2: Clone and Install

```bash
# Navigate to the project
cd jansaathi

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Step 3: Configure Environment

```bash
# Backend configuration
cd backend
cp .env.example .env
# Edit .env with your AWS credentials and Telegram bot token

# Frontend configuration
cd ../frontend
cp .env.example .env
# Edit .env with your backend API URL (default: http://localhost:3001)
```

### Step 4: Setup AWS Infrastructure

```bash
# Run AWS setup script (creates DynamoDB tables and S3 bucket)
cd ../scripts
bash setup-aws.sh

# Seed the database with 20 welfare schemes
cd ../backend
npm run seed
```

### Step 5: Start the Application

```bash
# Terminal 1: Start backend server
cd backend
npm start

# Terminal 2: Start frontend dev server
cd frontend
npm run dev
```

Visit:
- **Web Dashboard**: http://localhost:3000/dashboard
- **Web Chat**: http://localhost:3000/chat
- **Telegram Bot**: Search for your bot on Telegram and send `/start`

## Environment Variables

### Backend (.env)

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_here
S3_BUCKET_NAME=jansaathi-audio-yourname

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_WEBHOOK_URL=https://your-domain.com/api/webhook/telegram

# Server
PORT=3001
NODE_ENV=development
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3001
```

## Project Structure

```
jansaathi/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express server entry point
│   │   ├── bot/
│   │   │   └── telegramBot.js    # Telegram bot handlers
│   │   ├── services/
│   │   │   ├── aiService.js      # Bedrock integration
│   │   │   ├── schemeService.js  # DynamoDB scheme matching
│   │   │   ├── translateService.js # AWS Translate
│   │   │   └── transcribeService.js # AWS Transcribe
│   │   ├── routes/
│   │   │   ├── eligibility.js    # /api/check-eligibility
│   │   │   ├── webhook.js        # Telegram webhook
│   │   │   └── dashboard.js      # Dashboard stats
│   │   ├── utils/
│   │   │   └── schemeData.js     # 20 welfare schemes data
│   │   └── config/
│   │       └── aws.js            # AWS client initialization
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Router setup
│   │   ├── pages/
│   │   │   ├── ChatPage.jsx      # Web chat interface
│   │   │   └── DashboardPage.jsx # Admin dashboard
│   │   └── components/
│   │       ├── MessageBubble.jsx
│   │       ├── SchemeCard.jsx
│   │       └── StatsCard.jsx
│   └── package.json
├── scripts/
│   ├── setup-aws.sh              # AWS infrastructure setup
│   └── seed.js                   # Database seeding
└── README.md
```

## API Endpoints

- `GET /health` - Health check
- `POST /api/check-eligibility` - Process user message and return schemes
- `POST /api/webhook/telegram` - Telegram webhook handler
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/schemes` - List all schemes

## Demo Personas

Test the system with these pre-configured personas:

1. **Ramesh (Farmer, UP, Hindi)**
   - "Main UP ka kisan hoon, 2 acre zameen hai, meri umar 45 saal hai, BPL card bhi hai"
   - Expected: PM-KISAN, PM Fasal Bima Yojana, Kisan Credit Card

2. **Lakshmi (SHG Member, Tamil Nadu, Tamil)**
   - "Naan Tamil Nadu-la irukken, en veettula 3 pillaikal irukku, BPL card irukku"
   - Expected: Ujjwala, PM Awas Yojana, Ayushman Bharat

3. **Arjun (SC Student, Karnataka, English)**
   - "I am a SC category student from Karnataka, studying in class 11"
   - Expected: NSP Post-Matric Scholarship SC, Ayushman Bharat

## Troubleshooting

### Telegram Bot Not Responding
- Verify bot token in `.env`
- Check if bot is running: `curl http://localhost:3001/health`
- For production, set up webhook URL

### AWS Service Errors
- Verify AWS credentials are configured
- Check IAM permissions for Bedrock, DynamoDB, S3, Translate, Transcribe
- Ensure region is set to `us-east-1`

### Frontend Not Loading
- Check if backend is running on port 3001
- Verify `VITE_API_URL` in frontend `.env`
- Check browser console for CORS errors

## What Judges Will Look For

✅ Telegram bot responds to Hindi voice message with scheme recommendations  
✅ Web chat shows scheme cards with apply links  
✅ Panchayat dashboard shows gap analysis chart  
✅ System correctly identifies farmer as eligible for PM-KISAN  
✅ System responds in the same language the user wrote in

## Roadmap (Out of Scope for MVP)

- DigiLocker integration for document verification
- Real government portal form submission
- Aadhaar verification
- IVRS / phone call system
- Multi-tenant panchayat system
- Production CI/CD pipeline

## License

MIT

## Support

For issues and questions, please open an issue on the repository.

---

**Built for hackathon MVP** - Bridging the gap between citizens and welfare schemes 🇮🇳
