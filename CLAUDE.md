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

### Critical Fix: Personalized Context Integration (RESOLVED - July 2025)
**Problem**: AI was giving generic responses instead of personalized ones based on user's resume and job description. Session mapping between LayerCode's generated session IDs and our database interview session IDs was failing.

**Root Cause**: LayerCode's React SDK was not passing `sessionContext` to our voice-auth endpoint as expected. Initial attempts to pass session data through sessionContext parameter failed because LayerCode doesn't forward custom sessionContext to authorization endpoints.

**Solution**: Used LayerCode's `metadata` parameter in the React SDK hook:
```typescript
useLayercodePipeline({
  pipelineId: process.env.NEXT_PUBLIC_LAYERCODE_PIPELINE_ID!,
  authorizeSessionEndpoint: '/api/voice-auth',
  metadata: {
    interviewSessionId: interviewSessionId
  }
})
```

**Technical Flow**:
1. Frontend passes interview session ID via `metadata.interviewSessionId` 
2. Voice-auth endpoint extracts interview session ID from `body.metadata.interviewSessionId`
3. Voice-auth calls LayerCode API and receives LayerCode's generated session ID
4. Session mapping stores: `LayerCode sessionId → Interview sessionId`
5. Voice-agent webhook receives LayerCode session ID and looks up interview context
6. AI generates personalized responses using resume, job description, and conversation history

**Result**: ✅ AI now conducts fully personalized interviews with proper context, persona integration, and intelligent follow-up questions.

## Current Issues & Limitations

### 1. Voice Activity Detection (VAD) Sensitivity
**Issue**: Sporadic voice capture with premature audio cutoffs during user responses.
**Impact**: Users experience interrupted speech recognition, affecting interview flow.
**Status**: Identified but not resolved - requires LayerCode configuration adjustments.

### 2. Results Page Database Schema (MINOR)
**Issue**: Results page may still reference old `interview_responses` table instead of new `interview_conversation` table.
**Impact**: Results page errors when trying to display interview history.
**Status**: Minor fix needed to update results API endpoint.

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

## Dynamic Conversation Architecture (NEW)

### Conversation Flow System
The interview system now uses a dynamic conversation flow that supports natural follow-up questions and comprehensive conversation tracking.

#### Key Features:
1. **Personalized Context**: Each conversation uses the candidate's specific resume and job description
2. **Decision Engine**: GPT-4.1-mini analyzes responses to decide between follow-up questions vs. moving to next main question
3. **Full Conversation Storage**: All interviewer questions and candidate responses are stored with timestamps
4. **Natural Flow**: Supports unlimited follow-up questions based on response quality

#### Database Schema:
- **`interview_conversation` table**: Stores full conversation as sequential turns
- **Fields**: `turn_number`, `speaker` (interviewer/candidate), `message_type` (main_question/follow_up/response), `message_text`
- **Relationships**: Links to `interview_sessions` and optionally to `interview_questions`

#### Decision Logic:
1. **Follow-up**: When response is shallow/incomplete or needs clarification
2. **Next Question**: When response is complete and should move to next main question  
3. **End Interview**: When all main questions have been thoroughly covered

#### Voice Agent Flow:
1. Fetch session context (resume, job description, main questions)
2. Retrieve recent conversation history (last 8 turns)
3. Store candidate response in database
4. Analyze response with decision engine
5. Generate contextual interviewer response
6. Store interviewer response with appropriate message type
7. Stream response to LayerCode for TTS

## Database Schema (Supabase)

### Schema Management
The database schema is managed in `examples/lickedin_supabase_schema.sql`. This file contains the complete table definitions, indexes, Row Level Security policies, and triggers for the application.

### Database Access
**IMPORTANT**: Always use the `supabase-lickedin` MCP server for any database requests. This provides direct access to the Supabase database with proper authentication and security. Use the MCP functions like `mcp__supabase-lickedin__execute_sql` and `mcp__supabase-lickedin__list_tables` instead of making direct API calls.

## Development Workflow Rules
When working on this project, always follow these 7 rules:
1. **Plan First**: Think through the problem, read the codebase for relevant files, and write a plan to `docs/todo.md`
2. **Create Todo List**: The plan should have a list of todo items that you can check off as you complete them
3. **Get Approval**: Before beginning work, check in with the user and get verification of the plan
4. **Execute Incrementally**: Work on todo items one by one, marking them as complete as you go
5. **Communicate Changes**: Give high-level explanations of what changes you made at each step
6. **Keep It Simple**: Make every task and code change as simple as possible. Avoid massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. **Document Results**: Add a review section to the `docs/todo.md` file with a summary of the changes made and any other relevant information

## Development Commands
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Production build
- `npm run lint` - ESLint code checking

## Next Steps & Recommendations

### High Priority
1. **Fix VAD Sensitivity**: Investigate LayerCode configuration options for voice activity detection
2. **End-to-End Scoring**: Implement comprehensive scoring system using full conversation history
3. **Session History Dashboard**: Build user interface showing past interviews and progress

### Medium Priority  
4. **Performance Metrics**: Add detailed analytics for response times, word counts, and conversation flow
5. **Advanced Question Types**: Support for coding challenges, scenario-based questions
6. **Interview Feedback UI**: Display structured feedback with strengths and improvement areas

### Technical Debt
7. **Error Handling**: Improve error boundaries and user feedback for API failures
8. **Testing**: Add unit tests for core interview logic and API endpoints
9. **Performance Optimization**: Optimize database queries and conversation history retrieval

## Project Status: Advanced Conversational AI Interviews
The interview system now features sophisticated conversation flow with personalized context, intelligent follow-up questions, and comprehensive conversation tracking. The architecture supports natural interview experiences that adapt to candidate responses while maintaining complete conversation history for analysis.

### Key Capabilities Implemented:
- ✅ **Personalized Interview Context**: Uses candidate's resume and job requirements
- ✅ **Dynamic Conversation Flow**: Intelligent decision between follow-ups and next questions
- ✅ **Full Conversation Storage**: Complete interaction history with timestamps
- ✅ **Multi-Persona Support**: Different interviewer personalities (Professional, Michael Scott, etc.)
- ✅ **Difficulty Adaptation**: Adjusts question complexity based on settings
- ✅ **Real-time Processing**: Immediate response analysis and context-aware generation