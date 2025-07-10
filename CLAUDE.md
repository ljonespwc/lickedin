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

## Current Issues & Limitations

### 1. Lack of Personalized Interview Context
**Issue**: Live interview conversations use generic prompts instead of user-specific resume/job data.
**Current State**: Question generation during setup works, but live conversation doesn't use stored context.
**Location**: `voice-agent/route.ts:50-61` - system prompt is hardcoded and generic.

### 2. Missing Database Integration for Live Interviews
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
1. **Implement Personalized Interview Context**: Modify `voice-agent/route.ts` to use stored resume/job data in conversation prompts
2. **Add Interview Session Storage**: Store conversation transcripts and responses in database

### Medium Priority  
3. **Performance Metrics**: Implement scoring and feedback system based on responses
5. **Session History**: Build user dashboard showing past interviews and progress
6. **Advanced Question Types**: Support for coding challenges, scenario-based questions

### Technical Debt
7. **Error Handling**: Improve error boundaries and user feedback for API failures
8. **Type Safety**: Strengthen TypeScript interfaces for LayerCode data structures
9. **Testing**: Add unit tests for core interview logic and API endpoints

## Project Status: MVP Functional
The core voice interview functionality is working with successful transcription routing and real-time conversation flow. The main limitation is VAD sensitivity affecting user experience, but the fundamental technical architecture is solid and scalable.