# LickedIn Interviews - Technical Specification

## Architecture Overview

```
Frontend (Next.js) ←→ Custom Backend ←→ Layercode Voice Pipeline
                              ↓
                         OpenAI GPT-4
                              ↓
                    Supabase Database
```

## Tech Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Voice Integration**: Layercode React SDK
- **State Management**: React Context + useState
- **File Upload**: Native HTML5 + Supabase Storage

### Backend
- **Runtime**: Next.js API Routes (serverless functions)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage
- **Voice Infrastructure**: Layercode Custom Backend
- **LLM**: OpenAI GPT-4 API
- **Voice Synthesis**: Cartesia Sonic (via Layercode)

### External Services
- **Layercode**: Real-time voice pipeline (free tokens provided)
- **OpenAI**: Question generation & response analysis
- **Cartesia**: High-quality voice synthesis (covered by Layercode credits)
- **Supabase**: Database, auth, storage (existing schema)

## Core Components

### 1. Interview Setup System
- **Resume Parser**: Extract text from PDF/TXT uploads
- **Job Scraper**: Fetch job descriptions from URLs
- **Question Generator**: OpenAI integration for personalized questions
- **Session Manager**: Create and configure interview sessions

### 2. Voice Interview Engine
- **Layercode Integration**: Custom backend webhook for conversation flow
- **Persona System**: Different interviewer personalities with unique prompts
- **Conversation State**: Track question progression and context
- **Real-time Processing**: Handle voice input/output through Layercode

### 3. Analysis & Scoring
- **Response Analyzer**: OpenAI-powered evaluation of answers
- **Scoring Algorithm**: Multi-factor scoring (content, confidence, communication)
- **Feedback Generator**: Personalized improvement suggestions
- **Results Dashboard**: Performance visualization and history

## API Architecture

### Frontend Routes
```
/                           # Landing page
/setup                      # File upload & processing
/setup/customize           # Interview configuration
/interview/[sessionId]     # Live voice interview
/results/[sessionId]       # Performance analysis
/dashboard                 # User history
```

### Backend API Routes
```
/api/auth/[...supabase]    # Supabase auth handlers
/api/upload/resume         # Resume upload & parsing
/api/scrape/job           # Job description fetching
/api/interview/create     # Session initialization
/api/interview/questions  # Generate personalized questions
/api/layercode/webhook    # Voice conversation handler
/api/layercode/authorize  # Layercode session auth
/api/analyze/response     # Individual response scoring
/api/analyze/session      # Overall session analysis
```

### Layercode Integration
```
Custom Backend Webhook:
POST /api/layercode/webhook
- Receives voice input transcription
- Manages conversation state
- Generates contextual responses
- Returns text for voice synthesis
```

## Database Integration

Utilizing existing Supabase schema with key workflows:

### Interview Flow
1. Create `interview_sessions` record
2. Generate and store `interview_questions`
3. Process voice responses → `interview_responses`
4. Generate final `interview_feedback`

### Voice Session Management
- Link Layercode session IDs to database sessions
- Store conversation state and progress
- Real-time updates during interview

## OpenAI Integration Points

### 1. Question Generation
```javascript
// Prompt engineering for personalized questions
const prompt = `
Generate ${questionCount} interview questions for:
Role: ${jobTitle}
Company: ${companyName}
Candidate Background: ${resumeContent}
Difficulty: ${difficultyLevel}
Persona: ${interviewerPersona}
`;
```

### 2. Response Analysis
```javascript
// Real-time response evaluation
const analysisPrompt = `
Evaluate this interview response:
Question: ${question}
Answer: ${userResponse}
Criteria: relevance, specificity, confidence, structure
Return: score (0-100), feedback, improvements
`;
```

### 3. Persona Implementation
- **Michael Scott**: Casual, slightly inappropriate, humorous
- **Professional**: Standard corporate interviewer
- **Friendly Mentor**: Encouraging, supportive
- **Tech Lead**: Technical depth, problem-solving focus

## Key Configuration

### Layercode Pipeline Setup
- **Turn Taking**: Automatic (voice activity detection)
- **Voice Provider**: Cartesia Sonic
- **Custom Backend**: Webhook to `/api/layercode/webhook`
- **Session Management**: Custom authorization flow

### OpenAI Configuration
- **Model**: GPT-4 (for quality) or GPT-4-turbo (for speed)
- **Temperature**: 0.7 for questions, 0.3 for analysis
- **Max Tokens**: 500 for questions, 200 for analysis

### Environment Variables
```env
# Layercode
LAYERCODE_API_KEY=
LAYERCODE_PIPELINE_ID=

# OpenAI
OPENAI_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Success Metrics
- Interview completion rate > 80%
- Average session duration: 10-15 minutes
- Voice latency < 500ms end-to-end
- User satisfaction score > 4.0/5.0

## Deployment
- **Hosting**: Vercel (Next.js optimization)
- **Database**: Supabase (managed PostgreSQL)
- **CDN**: Vercel Edge Network
- **Monitoring**: Vercel Analytics + Supabase Monitoring