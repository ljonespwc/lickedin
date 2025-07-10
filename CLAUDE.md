# LickedIn Interviews - Project Status & Progress

## Project Overview
LickedIn Interviews is a Next.js application that provides AI-powered voice interviews using LayerCode's voice SDK and OpenAI's GPT models. The platform allows users to upload resumes, specify job requirements, and conduct personalized mock interviews with real-time voice transcription.

## Current Architecture

### Core Technologies
- **Frontend**: Next.js 15.3.5 with React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes with Server-Side Rendering (SSR)
- **Database**: Supabase (PostgreSQL) with authentication
- **Voice Integration**: LayerCode React SDK & Node.js SDK
- **AI**: OpenAI GPT-4.1-mini for interview questions and responses
- **File Processing**: unpdf for PDF parsing, react-dropzone for file uploads

### Key Features Implemented

#### 1. Authentication & User Management
- Supabase authentication with JWT tokens
- Session management with cookie-based auth
- Protected routes with automatic redirects

#### 2. Resume & Job Description Processing (`/src/app/setup/`)
- File upload (PDF/TXT) with drag-and-drop interface
- Resume text extraction using unpdf
- Job URL scraping and content cleaning
- Data storage in Supabase tables: `resumes`, `job_descriptions`

#### 3. Interview Customization (`/src/app/setup/customize/`)
- Difficulty levels: Softball, Medium, Hard, Hard as F*ck
- Interviewer personas: Michael Scott, Generic Pro, Friendly Mentor, Tech Lead
- Personalized question generation using OpenAI GPT-4

#### 4. Voice Interview System (`/src/app/interview/[sessionId]/`)
- Real-time voice conversation using LayerCode SDK
- Bi-directional audio streaming with amplitude detection
- Live transcription display for both user and agent
- OpenAI-powered conversational AI responses

## Recent Fixes & Technical Solutions

### Critical Bug Fix: Transcription Routing (RESOLVED)
**Problem**: User transcriptions were appearing in the agent transcription box instead of the user box.

**Root Cause**: The VoiceIntegration component was treating all `response.data` events as agent transcriptions, when LayerCode actually sends both user and agent transcriptions through `response.data` but with different `content.type` values.

**Solution**: Updated `VoiceIntegration.tsx:32-46` to check `data.content.type` to properly route transcriptions:
```typescript
if (data.type === 'user_transcription' || 
    (data.type === 'response.data' && content?.type === 'user_transcription')) {
  onVoiceData({ userTranscription: text })
} else if (data.type === 'agent_transcription' || 
           (data.type === 'response.data' && content?.type === 'agent_transcription')) {
  onVoiceData({ agentTranscription: text })
}
```

### Case Sensitivity Fix in Webhook
**Problem**: LayerCode was sending lowercase 'message' but webhook was checking for uppercase 'MESSAGE'.

**Solution**: Updated `voice-agent/route.ts:36` to handle both cases:
```typescript
if ((type === 'MESSAGE' || type === 'message' || !type) && text) {
```

### OpenAI Model Update
- Changed from "gpt-4" to "gpt-4.1-mini" in `voice-agent/route.ts:47`
- Maintained conversation quality while improving response speed

## Current Issues & Limitations

### 1. Voice Activity Detection (VAD) Sensitivity
**Issue**: Sporadic voice capture with premature audio cutoffs during user responses.
**Impact**: Users experience interrupted speech recognition, affecting interview flow.
**Status**: Identified but not resolved - requires LayerCode configuration adjustments.

### 2. Lack of Personalized Interview Context
**Issue**: Live interview conversations use generic prompts instead of user-specific resume/job data.
**Current State**: Question generation during setup works, but live conversation doesn't use stored context.
**Location**: `voice-agent/route.ts:50-61` - system prompt is hardcoded and generic.

### 3. Missing Database Integration for Live Interviews
**Issue**: Interview responses and performance metrics are not being stored.
**Impact**: No session history, feedback, or progress tracking.

## API Flow Documentation

### Setup Flow
1. **File Upload**: `POST /api/setup/process`
   - Accepts resume file + job URL
   - Extracts text from PDF/TXT files
   - Scrapes job description from URL
   - Stores in Supabase `resumes` and `job_descriptions` tables

2. **Interview Creation**: `POST /api/interview/create`
   - Fetches user's latest resume and job description
   - Generates 5 personalized questions using OpenAI GPT-4
   - Creates interview session in `interview_sessions` table
   - Stores questions in `interview_questions` table

### Live Interview Flow
1. **Session Authorization**: `POST /api/voice-auth`
   - LayerCode session authorization endpoint
   - Validates interview session exists

2. **Voice Conversation**: `POST /api/voice-agent`
   - LayerCode webhook for real-time voice processing
   - Receives user speech transcription
   - Streams user transcription to frontend via `stream.data()`
   - Generates AI response using OpenAI GPT-4.1-mini
   - Streams agent transcription to frontend
   - Returns TTS audio to LayerCode for playback

3. **Frontend Voice Integration**:
   - `VoiceIntegration.tsx` handles LayerCode React SDK
   - Processes real-time data streams from voice-agent webhook
   - Routes transcriptions to appropriate UI components
   - Provides audio amplitude feedback

## Database Schema (Supabase)

### Core Tables
- `resumes`: User resume storage with parsed content
- `job_descriptions`: Job posting content and metadata  
- `interview_sessions`: Interview configurations and status
- `interview_questions`: Generated personalized questions
- Additional auth tables managed by Supabase

## Environment Configuration
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
NEXT_PUBLIC_LAYERCODE_PIPELINE_ID=
LAYERCODE_WEBHOOK_SECRET=
```

## Development Commands
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Production build
- `npm run lint` - ESLint code checking

## Next Steps & Recommendations

### High Priority
1. **Fix VAD Sensitivity**: Investigate LayerCode configuration options for voice activity detection
2. **Implement Personalized Interview Context**: Modify `voice-agent/route.ts` to use stored resume/job data in conversation prompts
3. **Add Interview Session Storage**: Store conversation transcripts and responses in database

### Medium Priority  
4. **Performance Metrics**: Implement scoring and feedback system based on responses
5. **Session History**: Build user dashboard showing past interviews and progress
6. **Advanced Question Types**: Support for coding challenges, scenario-based questions

### Technical Debt
7. **Error Handling**: Improve error boundaries and user feedback for API failures
8. **Type Safety**: Strengthen TypeScript interfaces for LayerCode data structures
9. **Testing**: Add unit tests for core interview logic and API endpoints

## Project Status: MVP Functional
The core voice interview functionality is working with successful transcription routing and real-time conversation flow. The main limitation is VAD sensitivity affecting user experience, but the fundamental technical architecture is solid and scalable.