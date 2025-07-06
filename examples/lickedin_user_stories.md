# LickedIn Interviews - MVP User Stories

## Authentication & Profile Setup

**US-001: Account Creation**
As a job seeker, I want to create an account using my email or LinkedIn, so that I can save my interview sessions and track my progress.

**US-002: Profile Management** 
As a user, I want to complete my profile with my name and LinkedIn URL, so that the AI can better understand my professional background.

## Content Upload & Setup

**US-003: Resume Upload**
As a job seeker, I want to upload my resume (PDF/text), so that the AI can understand my background and ask relevant questions.

**US-004: Job Description Input**
As a job seeker, I want to paste a job description URL, so that the AI can tailor interview questions to the specific role I'm applying for.

**US-005: AI Processing**
As a user, I want the AI to analyze my resume and job description, so that I get personalized interview questions that match the role.

## Interview Customization

**US-006: Difficulty Selection**
As a job seeker, I want to choose the difficulty level of my interview (from "Softball" to "Hard as F*ck"), so that I can practice at the appropriate challenge level.

**US-007: Persona Selection**
As a user, I want to choose an interviewer persona (like Michael Scott), so that my practice session is engaging and memorable.

**US-008: Question Count Configuration**
As a user, I want the system to generate the appropriate number of questions for my session, so that I can complete a focused practice interview.

## Voice Interview Experience

**US-009: Real-Time Voice Interview**
As a job seeker, I want to have a natural voice conversation with my AI interviewer, so that I can practice speaking confidently and clearly.

**US-010: Interview Controls**
As a user, I want to pause and resume my interview, so that I can take breaks if needed without losing my progress.

**US-011: Full-Screen Interview Interface**
As a job seeker, I want a distraction-free interview environment, so that I can focus entirely on my responses and performance.

**US-012: Natural Conversation Flow**
As a user, I want the AI interviewer to respond naturally to my answers and ask appropriate follow-up questions, so that it feels like a real interview.

## Post-Interview Analysis

**US-013: Performance Scoring**
As a job seeker, I want to receive an overall score for my interview performance, so that I can track my improvement over time.

**US-014: Detailed Feedback**
As a user, I want specific feedback on each of my responses, so that I know exactly what to improve.

**US-015: Improvement Suggestions**
As a job seeker, I want actionable suggestions for how to improve my answers, so that I can perform better in real interviews.

**US-016: Results Page**
As a user, I want to view my complete interview results on a dedicated page, so that I can review my performance in detail.

## Session Management

**US-017: Session Persistence**
As a user, I want my interview sessions to be saved, so that I can review past performances and track my progress.

**US-018: Session Status Tracking**
As a user, I want the system to track whether I completed, paused, or abandoned an interview, so that I can resume or restart as needed.

## Admin/Creator Features

**US-019: Question Count Control**
As Lance (the creator), I want to control how many questions are asked in each interview session, so that I can optimize the demo experience and manage costs.

**US-020: System Monitoring**
As Lance, I want to track completion rates and user engagement metrics, so that I can improve the product based on real usage data.

## Acceptance Criteria Notes

- All voice interactions must be real-time using Layercode integration
- Interview sessions must be pausable/resumable without data loss
- Feedback must be generated immediately after interview completion
- All user data must be properly secured with RLS policies
- The interface must be optimized for desktop use
- Resume parsing must handle both PDF and text formats
- Job description URLs must be scraped and processed by AI
- Persona voices must be clearly distinguishable
- Interview duration should be reasonable for the question count (5 questions = ~10-15 minutes)