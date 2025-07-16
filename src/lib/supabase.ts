import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  // Add timeout and retry safeguards
  global: {
    headers: {
      'x-client-info': 'lickedin-interviews'
    }
  }
})

// Type definitions for our database
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          linkedin_profile_url: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          linkedin_profile_url?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          linkedin_profile_url?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      resumes: {
        Row: {
          id: string
          user_id: string
          filename: string
          file_url: string
          parsed_content: string | null
          file_size_bytes: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          filename: string
          file_url: string
          parsed_content?: string | null
          file_size_bytes?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          filename?: string
          file_url?: string
          parsed_content?: string | null
          file_size_bytes?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      job_descriptions: {
        Row: {
          id: string
          user_id: string
          url: string
          job_content: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          url: string
          job_content?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          url?: string
          job_content?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      interview_sessions: {
        Row: {
          id: string
          user_id: string
          resume_id: string
          job_description_id: string
          difficulty_level: string
          interview_type: string
          voice_gender: string
          communication_style: string
          question_count: number
          status: string
          overall_score: number | null
          started_at: string | null
          completed_at: string | null
          total_duration_seconds: number | null
          layercode_session_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          resume_id: string
          job_description_id: string
          difficulty_level?: string
          interview_type: string
          voice_gender: string
          communication_style: string
          question_count?: number
          status?: string
          overall_score?: number | null
          started_at?: string | null
          completed_at?: string | null
          total_duration_seconds?: number | null
          layercode_session_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          resume_id?: string
          job_description_id?: string
          difficulty_level?: string
          interview_type?: string
          voice_gender?: string
          communication_style?: string
          question_count?: number
          status?: string
          overall_score?: number | null
          started_at?: string | null
          completed_at?: string | null
          total_duration_seconds?: number | null
          layercode_session_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      interview_questions: {
        Row: {
          id: string
          session_id: string
          question_text: string
          question_order: number
          question_type: string | null
          expected_answer_points: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          question_text: string
          question_order: number
          question_type?: string | null
          expected_answer_points?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          question_text?: string
          question_order?: number
          question_type?: string | null
          expected_answer_points?: string[] | null
          created_at?: string
        }
      }
      interview_conversation: {
        Row: {
          id: string
          session_id: string
          turn_number: number
          speaker: 'interviewer' | 'candidate'
          message_text: string
          message_type: 'main_question' | 'follow_up' | 'response' | 'transition' | 'closing'
          related_main_question_id: string | null
          word_count: number | null
          response_time_seconds: number | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          turn_number: number
          speaker: 'interviewer' | 'candidate'
          message_text: string
          message_type: 'main_question' | 'follow_up' | 'response' | 'transition' | 'closing'
          related_main_question_id?: string | null
          word_count?: number | null
          response_time_seconds?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          turn_number?: number
          speaker?: 'interviewer' | 'candidate'
          message_text?: string
          message_type?: 'main_question' | 'follow_up' | 'response' | 'transition' | 'closing'
          related_main_question_id?: string | null
          word_count?: number | null
          response_time_seconds?: number | null
          created_at?: string
        }
      }
      interview_responses: {
        Row: {
          id: string
          session_id: string
          question_id: string
          response_text: string
          response_audio_url: string | null
          score: number | null
          feedback: string | null
          response_time_seconds: number | null
          word_count: number | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          question_id: string
          response_text: string
          response_audio_url?: string | null
          score?: number | null
          feedback?: string | null
          response_time_seconds?: number | null
          word_count?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          question_id?: string
          response_text?: string
          response_audio_url?: string | null
          score?: number | null
          feedback?: string | null
          response_time_seconds?: number | null
          word_count?: number | null
          created_at?: string
        }
      }
      interview_feedback: {
        Row: {
          id: string
          session_id: string
          overall_feedback: string
          strengths: string[] | null
          areas_for_improvement: string[] | null
          suggested_next_steps: string[] | null
          confidence_score: number | null
          communication_score: number | null
          content_score: number | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          overall_feedback: string
          strengths?: string[] | null
          areas_for_improvement?: string[] | null
          suggested_next_steps?: string[] | null
          confidence_score?: number | null
          communication_score?: number | null
          content_score?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          overall_feedback?: string
          strengths?: string[] | null
          areas_for_improvement?: string[] | null
          suggested_next_steps?: string[] | null
          confidence_score?: number | null
          communication_score?: number | null
          content_score?: number | null
          created_at?: string
        }
      }
    }
  }
}
