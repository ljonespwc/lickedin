-- LickedIn Interviews Supabase Schema

-- Enable RLS on all tables
-- Supabase auth.users table is built-in

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  linkedin_profile_url TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Resumes table
CREATE TABLE resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL, -- Supabase storage URL
  parsed_content TEXT, -- Extracted text content
  file_size_bytes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job descriptions table
CREATE TABLE job_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  job_content TEXT, -- Scraped/parsed content
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Interview sessions table
CREATE TABLE interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  job_description_id UUID NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  persona TEXT NOT NULL DEFAULT 'professional', -- DEPRECATED: Legacy field, use communication_style instead
  difficulty_level TEXT NOT NULL DEFAULT 'medium', -- 'softball', 'medium', 'hard', 'hard_as_fck'
  interview_type TEXT NOT NULL CHECK (interview_type IN ('phone_screening', 'technical_screen', 'hiring_manager', 'cultural_fit')),
  voice_gender TEXT NOT NULL CHECK (voice_gender IN ('male', 'female')),
  communication_style TEXT NOT NULL CHECK (communication_style IN ('corporate_professional', 'casual_conversational')),
  question_count INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'paused', 'completed', 'abandoned'
  overall_score DECIMAL(5,2), -- 0-100 score
  layercode_session_id TEXT, -- LayerCode session ID for voice integration mapping
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  total_duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Interview questions table
CREATE TABLE interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_order INTEGER NOT NULL,
  question_type TEXT DEFAULT 'behavioral', -- 'behavioral', 'technical', 'situational', etc.
  expected_answer_points TEXT[], -- Array of key points AI expects
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Interview conversation table (replaces interview_responses)
-- Stores the full conversation flow between interviewer and candidate
CREATE TABLE interview_conversation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL, -- Sequential order in conversation (1, 2, 3, ...)
  speaker TEXT NOT NULL CHECK (speaker IN ('interviewer', 'candidate')),
  message_text TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('main_question', 'follow_up', 'response', 'transition', 'closing')),
  related_main_question_id UUID REFERENCES interview_questions(id), -- NULL for follow-ups and transitions
  word_count INTEGER,
  response_time_seconds INTEGER, -- Time taken to respond (for candidate messages)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Interview feedback table (overall session feedback)
CREATE TABLE interview_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  overall_feedback TEXT NOT NULL,
  strengths TEXT[],
  areas_for_improvement TEXT[],
  suggested_next_steps TEXT[],
  confidence_score DECIMAL(5,2), -- How confident the user seemed
  communication_score DECIMAL(5,2), -- How well they communicated
  content_score DECIMAL(5,2), -- Quality of their answers
  -- AI Analysis Caching Fields (Added 2025-07-15)
  response_analyses JSONB, -- Cached AI analysis results for individual Q&A pairs
  resume_analysis JSONB, -- Cached AI analysis of resume utilization
  job_fit_analysis JSONB, -- Cached AI analysis of job requirement alignment
  ai_analysis_completed_at TIMESTAMP WITH TIME ZONE, -- Timestamp when AI analysis was completed and cached
  ai_analysis_version INTEGER DEFAULT 1, -- Version number for AI analysis schema compatibility
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_resumes_user_id ON resumes(user_id);
CREATE INDEX idx_job_descriptions_user_id ON job_descriptions(user_id);
CREATE INDEX idx_interview_sessions_user_id ON interview_sessions(user_id);
CREATE INDEX idx_interview_sessions_status ON interview_sessions(status);
CREATE INDEX idx_interview_questions_session_id ON interview_questions(session_id);
CREATE INDEX idx_interview_conversation_session_id ON interview_conversation(session_id);
CREATE INDEX idx_interview_conversation_turn_number ON interview_conversation(session_id, turn_number);
CREATE INDEX idx_interview_conversation_main_question ON interview_conversation(related_main_question_id);
CREATE INDEX idx_interview_feedback_session_id ON interview_feedback(session_id);
CREATE INDEX idx_interview_feedback_ai_analysis_completed ON interview_feedback(session_id, ai_analysis_completed_at);

-- Row Level Security Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_conversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_feedback ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Resumes policies
CREATE POLICY "Users can view own resumes" ON resumes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resumes" ON resumes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resumes" ON resumes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own resumes" ON resumes
  FOR DELETE USING (auth.uid() = user_id);

-- Job descriptions policies
CREATE POLICY "Users can view own job descriptions" ON job_descriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own job descriptions" ON job_descriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own job descriptions" ON job_descriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own job descriptions" ON job_descriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Interview sessions policies
CREATE POLICY "Users can view own interview sessions" ON interview_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interview sessions" ON interview_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interview sessions" ON interview_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own interview sessions" ON interview_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Interview questions policies
CREATE POLICY "Users can view questions from own sessions" ON interview_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM interview_sessions 
      WHERE interview_sessions.id = interview_questions.session_id 
      AND interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert questions for own sessions" ON interview_questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM interview_sessions 
      WHERE interview_sessions.id = interview_questions.session_id 
      AND interview_sessions.user_id = auth.uid()
    )
  );

-- Interview conversation policies
CREATE POLICY "Users can view conversation from own sessions" ON interview_conversation
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM interview_sessions 
      WHERE interview_sessions.id = interview_conversation.session_id 
      AND interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert conversation for own sessions" ON interview_conversation
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM interview_sessions 
      WHERE interview_sessions.id = interview_conversation.session_id 
      AND interview_sessions.user_id = auth.uid()
    )
  );

-- Interview feedback policies
CREATE POLICY "Users can view feedback from own sessions" ON interview_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM interview_sessions 
      WHERE interview_sessions.id = interview_feedback.session_id 
      AND interview_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert feedback for own sessions" ON interview_feedback
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM interview_sessions 
      WHERE interview_sessions.id = interview_feedback.session_id 
      AND interview_sessions.user_id = auth.uid()
    )
  );

-- Storage buckets (run these in Supabase dashboard or via client)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('audio-recordings', 'audio-recordings', false);

-- Storage policies for resumes bucket
-- CREATE POLICY "Users can upload own resumes" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can view own resumes" ON storage.objects
--   FOR SELECT USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resumes_updated_at BEFORE UPDATE ON resumes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_descriptions_updated_at BEFORE UPDATE ON job_descriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_sessions_updated_at BEFORE UPDATE ON interview_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();