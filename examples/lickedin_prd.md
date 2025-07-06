# Product Requirements Document: LickedIn Interviews MVP

## Product Vision
A real-time AI-powered mock interview platform that helps job seekers practice and improve their interview skills using voice conversations with customizable AI interviewers.

## Target Users
- **Primary**: Job seekers in tech, marketing, and development roles
- **Secondary**: Any professional seeking interview practice regardless of role/level

## Core Value Proposition
Transform interview preparation from static Q&A practice into dynamic, personalized conversations that simulate real interview experiences with immediate feedback.

## MVP Feature Requirements

### Core Functionality

#### 1. Content Upload System
- Resume upload (PDF/text)
- Job description URL input
- AI processing of both documents to generate context-aware questions

#### 2. Interview Customization
- Difficulty level selection (e.g., "Softball" → "Hard as F*ck")
- Interviewer persona selection (Michael Scott, etc.)
- Question count configuration (creator-controlled, demo default: 5 questions)

#### 3. Real-Time Voice Interview
- Layercode integration for real-time voice synthesis
- Pause/resume functionality
- Natural conversation flow with AI interviewer

#### 4. Post-Interview Analysis
- Performance scoring
- Detailed feedback on responses
- Suggested improvements

## Technical Specifications
- **Frontend**: Next.js + React
- **Backend**: Supabase
- **AI**: OpenAI models for question generation and response analysis
- **Voice**: Layercode real-time text-to-speech
- **Hosting**: Vercel
- **Repository**: GitHub

## User Flow
1. User uploads resume + job description URL
2. AI analyzes content and generates personalized question set
3. User selects difficulty and interviewer persona
4. Real-time voice interview begins
5. User receives scoring and feedback upon completion

## Success Metrics (MVP)
- Interview completion rate
- User session duration
- Repeat usage within first week

## Future Considerations
- Real-time scoring during interview
- Company Q&A section where interviewer answers user questions
- Gamification/leaderboards
- B2B training packages
- Mobile optimization

## MVP Scope Priorities
- **Must-Have**: Upload system, voice interview, basic feedback
- **Should-Have**: Persona selection, difficulty levels
- **Could-Have**: Advanced scoring algorithms
- **Won't-Have**: Real-time scoring, mobile optimization, B2B features