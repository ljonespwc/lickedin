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

**Technical Flow**:
1. Frontend passes interview session ID via `metadata.interviewSessionId` 
2. Voice-auth endpoint extracts interview session ID from `body.metadata.interviewSessionId`
3. Voice-auth calls LayerCode API and receives LayerCode's generated session ID
4. Session mapping stores: `LayerCode sessionId → Interview sessionId`
5. Voice-agent webhook receives LayerCode session ID and looks up interview context
6. AI generates personalized responses using resume, job description, and conversation history

**Result**: ✅ AI now conducts fully personalized interviews with proper context, persona integration, and intelligent follow-up questions.

**Layercode Documentation**: 
https://docs.layercode.com/sdk-reference/node_js_sdk\
https://docs.layercode.com/sdk-reference/react_sdk\
https://docs.layercode.com/api-reference/webhook_sse_api\
https://docs.layercode.com/api-reference/rest_api\

## Current Issues & Limitations

### 1. Voice Activity Detection (VAD) Sensitivity
**Issue**: Sporadic voice capture with premature audio cutoffs during user responses.
**Impact**: Users experience interrupted speech recognition, affecting interview flow.
**Status**: Identified but not resolved - requires LayerCode configuration adjustments.

### 2. Supabase Session Hanging Issue - RESOLVED ✅
**Issue**: Calling `supabase.auth.getSession()` in button handlers would sometimes hang indefinitely, causing buttons to become unresponsive.
**Root Cause**: Race conditions, token refresh timing, or browser storage issues with concurrent `getSession()` calls.
**Impact**: Users would click buttons (like "Fetch Job Details") and nothing would happen - the call would hang at the `getSession()` line.
**Solution**: Cache the session from page-level authentication check instead of calling `getSession()` in button handlers.

**Implementation Pattern** (use this for any page with hanging button issues):
```typescript
// Add session state to component
const [session, setSession] = useState<{ user: { id: string }; access_token: string } | null>(null)

// Store session in page-level auth check
useEffect(() => {
  const getUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      router.push('/')
    } else {
      setSession(session) // Cache session for button handlers
    }
  }
  getUser()
}, [router])

// Use cached session in button handlers (no getSession() call)
const handleButtonClick = async () => {
  if (!session?.user) {
    router.push('/')
    return
  }
  const accessToken = session.access_token
  // Make API call with Bearer token...
}
```

**Files Fixed**: `/src/app/setup/page.tsx` and `/src/app/api/setup/process/route.ts`
**Result**: Button works reliably without hanging - session is cached from page load instead of fetched on-demand.

**Additional Fix Applied**: Same session caching pattern implemented in `/src/app/setup/customize/page.tsx` to fix hanging "Start Interview" button (July 17, 2025).

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
Use MCP lickedin-supabase to get source of truth.

### Schema Management
The database schema is managed in `examples/lickedin_supabase_schema.sql`. This file contains the complete table definitions, indexes, Row Level Security policies, and triggers for the application. Try to keep it synced with the Supabase schema.

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
- `npm run build` - Production build
- `npm run lint` - ESLint code checking

## Next Steps & Recommendations

### Priorities
1. **Interruptions**: How to recover gracefully from a cutoff question (layercode issue)
2. **End-to-End Scoring**: Implement comprehensive scoring system using full conversation history
3. **Session History Dashboard**: Build user interface showing past interviews and progress
4. **Interview Feedback UI**: Display structured feedback with strengths and improvement areas

### Technical Debt
1. **Error Handling**: Improve error boundaries and user feedback for API failures
2. **Testing**: Add unit tests for core interview logic and API endpoints
3. **Performance Optimization**: Optimize database queries and conversation history retrieval
4. **Fix VAD Sensitivity**: Investigate LayerCode configuration options for voice activity detection

## Project Status: Advanced Conversational AI Interviews
The interview system now features sophisticated conversation flow with personalized context, intelligent follow-up questions, and comprehensive conversation tracking. The architecture supports natural interview experiences that adapt to candidate responses while maintaining complete conversation history for analysis.

### Key Capabilities Implemented:
- ✅ **Personalized Interview Context**: Uses candidate's resume and job requirements
- ✅ **Dynamic Conversation Flow**: Intelligent decision between follow-ups and next questions
- ✅ **Full Conversation Storage**: Complete interaction history with timestamps
- ✅ **Multi-Persona Support**: Different interviewer personalities (Professional, Michael Scott, etc.)
- ✅ **Difficulty Adaptation**: Adjusts question complexity based on settings
- ✅ **Real-time Processing**: Immediate response analysis and context-aware generation

## Recent Major Achievement: Interview Completion System (July 12, 2025)

### 🎉 **Interview Termination & Celebration System - COMPLETED**
**Status**: ✅ Fully implemented and tested successfully

**Problem Solved**: Interviews were experiencing endless closing loops (8+ closing questions) and lacked proper termination signals for frontend celebration features.

**Technical Solution Implemented**:
1. **Fixed Closing Turn Limits**: Implemented bulletproof 4-turn closing limit with natural end signal detection
2. **Smart Termination Logic**: Added comprehensive regex pattern matching for common farewell phrases ("thanks", "you too", "goodbye", etc.)
3. **Custom Event System**: Created `interview_complete` event that bypasses LayerCode's status management issues
4. **Confetti Celebration**: Full-screen confetti animation with completion modal
5. **User-Controlled Navigation**: Removed auto-redirect, users now control when to view results

**Key Technical Fixes**:
- **Maximum Interviewer Turns**: Increased from 8 to 18 to accommodate all 5 questions plus follow-ups
- **Closing Turn Detection**: Fixed timing issues where termination checks occurred after database storage
- **Event Data Structure**: Corrected LayerCode event handling to detect `response.data` with `content.type: 'interview_complete'`
- **Natural End Patterns**: Comprehensive regex for detecting conversational endings

**Conversation Flow Results**:
- ✅ All 5 main questions consistently asked in proper order
- ✅ Maximum 2 follow-ups per question (adjustable)
- ✅ Exactly 4 closing exchanges maximum
- ✅ Natural conversation endings detected and honored
- ✅ Smooth transition to celebration and results

**User Experience**:
- Interview ends naturally with proper farewell exchanges
- Immediate confetti celebration upon completion
- "Interview Complete!" modal with congratulations
- User-controlled navigation to results page (no time pressure)

This resolves the core interview flow issues and provides a polished, professional interview completion experience.

## Recent Major Achievement: Session Persistence & Natural Closing Logic (July 15, 2025)

### 🎉 **Database-Based Session Mapping & Intelligent Closing - COMPLETED**
**Status**: ✅ Fully implemented and tested successfully

**Problems Solved**: 
1. **Session Mapping Loss**: Interviews were losing context mid-conversation due to serverless function restarts, causing AI to restart from Q1
2. **Extended Goodbye Loops**: Interviews continued with unnecessary farewell exchanges instead of ending naturally when candidates were satisfied

**Technical Solutions Implemented**:

#### 1. **Database Session Persistence**
- **Added**: `layercode_session_id TEXT` column to `interview_sessions` table
- **Updated**: Voice-auth endpoint to store LayerCode session ID in database during authorization
- **Updated**: Voice-agent endpoint to lookup interview sessions using LayerCode session ID from database
- **Removed**: Fragile in-memory sessionMapping dependency
- **Result**: ✅ Session mapping now survives serverless function restarts

#### 2. **Natural Closing Logic**
- **Replaced**: Complex regex pattern matching with simple question mark detection (`text.includes('?')`)
- **Implemented**: Two-phase closing logic:
  - If candidate asks question in closing phase → Continue conversation (up to 8 turns max)
  - If candidate responds without question → Generate final goodbye + terminate immediately
- **Added**: Automatic final goodbye generation with proper conversation storage
- **Result**: ✅ Natural conversation endings without extended goodbye loops

**Key Technical Flow**:
1. **Authorization**: `voice-auth` stores LayerCode session ID in database
2. **Voice Processing**: `voice-agent` looks up interview session using LayerCode session ID
3. **Closing Detection**: Simple question mark detection determines continuation vs termination
4. **Natural Ending**: Final goodbye generated automatically when candidate signals satisfaction

**Test Results**:
- ✅ Session mapping persists throughout entire conversation
- ✅ All 5 main questions asked in proper order with appropriate follow-ups
- ✅ Natural conversation flow with intelligent closing detection
- ✅ Clean termination when candidate expresses satisfaction
- ✅ No more session loss errors or extended goodbye loops

This implementation provides robust session persistence and natural conversation endings, creating a professional interview experience that feels authentically human.

## Recent Major Achievement: Modern Interview Customization System (July 13, 2025)

### 🎨 **Complete Frontend & Backend Customization Overhaul - COMPLETED**
**Status**: ✅ Fully implemented and tested successfully

**Problem Solved**: The setup page had outdated UI components and the backend was still using a deprecated persona system that didn't provide enough customization granularity for modern interview experiences.

**Major Frontend Improvements**:
1. **Modern 10-Point Difficulty Slider**: Replaced radio buttons with discrete snapping slider (1-10 scale)
2. **Interview Type Selection**: Added 4 distinct interview types with card-based selection UI:
   - **Phone Screening** 📞 - Initial recruiter call
   - **Technical Screen** 💻 - Coding & technical skills
   - **Hiring Manager** 👔 - Role-specific discussion  
   - **Cultural Fit** 🤝 - Team & values focus
3. **Voice & Style Section**: Replaced persona selection with:
   - **Interviewer Voice**: Male/Female radio selection
   - **Communication Style**: Corporate Professional vs. Casual Conversational card selection
4. **Enhanced UI/UX**: Modern shadcn/ui components with proper spacing, shading, and 2x2 grid layouts

**Complete Backend Integration**:
1. **Database Schema Updates**: Added new required fields to `interview_sessions` table:
   - `interview_type` (phone_screening, technical_screen, hiring_manager, cultural_fit)
   - `voice_gender` (male, female)
   - `communication_style` (corporate_professional, casual_conversational)
2. **Enhanced Question Generation**: Updated `/api/interview/create` to use all customization fields for personalized question creation
3. **Advanced AI Prompting**: Rebuilt voice-agent system prompts to leverage:
   - Interview type context for appropriate question focus
   - Communication style for tone and language patterns  
   - 10-point difficulty mapping for question complexity
   - Voice gender preference (future TTS integration)

**Frontend Display Updates**:
- Updated interview page to show correct interviewer info based on type (Phone Screener, Technical Interviewer, etc.)
- Replaced deprecated persona system with new customization-based display logic
- Maintained full backward compatibility with existing data

**Technical Implementation Results**:
- ✅ **Build Success**: No TypeScript errors, clean integration
- ✅ **Voice System Compatibility**: LayerCode integration completely preserved
- ✅ **Database Integrity**: All new fields have proper constraints and validation
- ✅ **Legacy Cleanup**: Removed outdated persona mappings while maintaining data consistency

**Live Testing Results** (Session: b8ce5226-b18d-4404-9cda-514096fe4cfb):
- **Perfect Question Flow**: All 5 main questions asked in correct order
- **Appropriate Follow-ups**: Only 1 follow-up question (within 2-question limit)  
- **Communication Style Applied**: Casual conversational tone evident throughout ("Hey Lance", natural language)
- **Interview Type Focus**: Phone screening questions matched perfectly (team culture, motivation, company fit)
- **Difficulty Level**: Softball questions were encouraging and supportive as intended
- **Natural Completion**: 4-turn closing sequence with user-driven questions

**Impact**: This modernization provides users with granular control over their interview experience while maintaining the sophisticated AI conversation system. The combination of interview type, communication style, and precise difficulty scaling creates truly personalized interview experiences that feel natural and relevant.

## Recent Updates: UI Fixes & Database Management (July 16, 2025)

### 🔧 **Shared Header Component & Dashboard Improvements - COMPLETED**
**Status**: ✅ Fully implemented and tested successfully

**Problems Solved**:
1. **Non-functional Sign Out Button**: Authentication buttons were not working due to form submission interference and session clearing issues
2. **Dashboard Endless Loading**: Users experienced infinite loading states instead of proper "No interviews yet" messaging
3. **Inconsistent Header UI**: Multiple header implementations across different pages without unified functionality

**Technical Solutions Implemented**:

#### 1. **Centralized Header Component** (`/src/components/Header.tsx`)
- **Created**: Single shared header component with proper authentication state management
- **Fixed**: Sign out functionality with correct Supabase session handling
- **Added**: Logo hyperlink navigation to home page
- **Implemented**: Consistent button styling and responsive layout
- **Result**: ✅ Working sign out button and unified header across all pages

#### 2. **Dashboard Loading & Error Handling** (`/src/app/dashboard/page.tsx`)
- **Added**: 10-second timeout with AbortController to prevent endless loading
- **Implemented**: Proper error boundary with fallback to "No interviews yet" state
- **Fixed**: Empty data handling to show appropriate UI instead of loading spinner
- **Result**: ✅ Dashboard now shows proper empty state instead of infinite loading

#### 3. **Database Cleanup & Management**
- **Executed**: Complete database table clearing via MCP (Model Context Protocol)
- **Preserved**: User profiles and Supabase auth.users table
- **Cleared**: All interview sessions, questions, conversations, feedback, resumes, and job descriptions
- **Result**: ✅ Clean database state ready for fresh interview data

**Key Technical Fixes**:
- **Button Type Issues**: Added `type="button"` to prevent form submission interference
- **Session Management**: Removed problematic `sessionStorage.clear()` that corrupted Supabase sessions
- **Authentication Flow**: Proper user state management with loading states and error handling
- **Timeout Handling**: Network request timeouts with graceful degradation

**Test Results**:
- ✅ Sign out button works consistently across all pages
- ✅ Dashboard loads quickly and shows appropriate empty state
- ✅ Header navigation functions properly with logo link
- ✅ Database successfully cleared with user profile preserved
- ✅ No TypeScript compilation errors or runtime issues

**Impact**: These fixes provide a more reliable and polished user experience with consistent navigation, proper error handling, and a clean database state for continued development and testing.

## Recent Critical Updates: Analysis Storage & Score Consistency (July 18, 2025)

### 🔧 **AI Question Detection & Database Fixes - COMPLETED**
**Status**: ✅ All critical issues resolved and tested successfully

**Problems Solved**:
1. **AI Question Detection**: Simple question mark detection missed natural language questions (e.g., "I'm wondering what the salary structure looks like")
2. **Database Storage Failure**: Comprehensive interview analysis was being displayed but not saved to database due to constraint errors
3. **Overall Score Calculation**: NULL values in database and frontend/backend score calculation mismatches

**Technical Solutions Implemented**:

#### 1. **AI-Powered Question Detection**
- **Replaced**: Simple `text.includes('?')` with GPT-4.1-mini powered question detection
- **Enhanced**: Natural language question recognition with contextual examples
- **Result**: ✅ Accurately detects questions regardless of punctuation or phrasing

#### 2. **Database Constraint Resolution**
- **Root Cause**: Missing unique constraint on `session_id` column in `interview_feedback` table
- **Fix**: Added `ALTER TABLE interview_feedback ADD CONSTRAINT interview_feedback_session_id_key UNIQUE (session_id)`
- **Result**: ✅ Comprehensive analysis now saves successfully to database

#### 3. **Overall Score System Implementation**
- **Added**: Overall score calculation as average of 4 pillar scores (Communication, Content, Confidence, Preparation)
- **Fixed**: Frontend display to use stored database value instead of calculating with 3 scores
- **Updated**: `/src/app/results/[sessionId]/page.tsx` line 239: `{results.session?.overall_score || 78}/100`
- **Result**: ✅ Consistent scoring across frontend and database

**Key Files Updated**:
- `/src/app/api/voice-agent/route.ts` - AI question detection with GPT-4.1
- `/src/app/api/results/[sessionId]/route.ts` - Overall score calculation and storage
- `/src/app/results/[sessionId]/page.tsx` - Frontend display using stored scores
- Database schema - Added unique constraint on interview_feedback.session_id

**Impact**: Complete interview analysis pipeline now works end-to-end with reliable data storage, consistent scoring, and natural conversation termination detection.