export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      active_workout_plans: {
        Row: {
          active_workout_plan_id: string | null
          deleted: boolean
          id: string
          last_completed_day_id: string | null
          started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_workout_plan_id?: string | null
          deleted?: boolean
          id?: string
          last_completed_day_id?: string | null
          started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_workout_plan_id?: string | null
          deleted?: boolean
          id?: string
          last_completed_day_id?: string | null
          started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_workout_plans_active_workout_plan_id_fkey"
            columns: ["active_workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_workout_plans_last_completed_day_id_fkey"
            columns: ["last_completed_day_id"]
            isOneToOne: false
            referencedRelation: "workout_plan_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_workout_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      active_workout_sessions: {
        Row: {
          created_at: string
          id: string
          started_at: string | null
          user_id: string
          workout_session_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          started_at?: string | null
          user_id: string
          workout_session_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          started_at?: string | null
          user_id?: string
          workout_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "active_workout_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_workout_sessions_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      body_measurements: {
        Row: {
          created_at: string
          id: string
          measured_at: string
          measurement_type: Database["public"]["Enums"]["body_measurement_type"]
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          measured_at?: string
          measurement_type: Database["public"]["Enums"]["body_measurement_type"]
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          measured_at?: string
          measurement_type?: Database["public"]["Enums"]["body_measurement_type"]
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "body_measurements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          created_at: string
          deleted: boolean
          description: string | null
          id: string
          image_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted?: boolean
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted?: boolean
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      exercise_equipment_requirements: {
        Row: {
          created_at: string
          deleted: boolean
          equipment_id: string | null
          exercise_id: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted?: boolean
          equipment_id?: string | null
          exercise_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted?: boolean
          equipment_id?: string | null
          exercise_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_equipment_requirements_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_equipment_requirements_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_muscles: {
        Row: {
          created_at: string | null
          exercise_id: string
          exercise_muscle_weight: number | null
          id: string
          muscle_id: string
          muscle_intensity: Database["public"]["Enums"]["muscle_intensity"]
        }
        Insert: {
          created_at?: string | null
          exercise_id: string
          exercise_muscle_weight?: number | null
          id?: string
          muscle_id: string
          muscle_intensity: Database["public"]["Enums"]["muscle_intensity"]
        }
        Update: {
          created_at?: string | null
          exercise_id?: string
          exercise_muscle_weight?: number | null
          id?: string
          muscle_id?: string
          muscle_intensity?: Database["public"]["Enums"]["muscle_intensity"]
        }
        Relationships: [
          {
            foreignKeyName: "exercise_muscles_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_muscles_muscle_id_fkey"
            columns: ["muscle_id"]
            isOneToOne: false
            referencedRelation: "muscles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_rank_benchmarks: {
        Row: {
          created_at: string | null
          exercise_id: string
          gender: Database["public"]["Enums"]["gender"]
          id: string
          min_threshold: number
          rank_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          exercise_id: string
          gender: Database["public"]["Enums"]["gender"]
          id?: string
          min_threshold: number
          rank_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          exercise_id?: string
          gender?: Database["public"]["Enums"]["gender"]
          id?: string
          min_threshold?: number
          rank_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_swr_benchmarks_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_rank_id"
            columns: ["rank_id"]
            isOneToOne: false
            referencedRelation: "ranks"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          bodyweight_percentage: number | null
          created_at: string
          created_by_user_id: string | null
          deleted: boolean
          description: string | null
          difficulty: string | null
          exercise_type: Database["public"]["Enums"]["exercise_type"] | null
          id: string
          instructions: string | null
          is_bilateral: boolean | null
          is_public: boolean | null
          name: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          bodyweight_percentage?: number | null
          created_at?: string
          created_by_user_id?: string | null
          deleted?: boolean
          description?: string | null
          difficulty?: string | null
          exercise_type?: Database["public"]["Enums"]["exercise_type"] | null
          id?: string
          instructions?: string | null
          is_bilateral?: boolean | null
          is_public?: boolean | null
          name: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          bodyweight_percentage?: number | null
          created_at?: string
          created_by_user_id?: string | null
          deleted?: boolean
          description?: string | null
          difficulty?: string | null
          exercise_type?: Database["public"]["Enums"]["exercise_type"] | null
          id?: string
          instructions?: string | null
          is_bilateral?: boolean | null
          is_public?: boolean | null
          name?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inspirational_quotes: {
        Row: {
          created_at: string
          id: string
          quote_author: string | null
          quote_day: string
          quote_text: string
        }
        Insert: {
          created_at?: string
          id?: string
          quote_author?: string | null
          quote_day: string
          quote_text: string
        }
        Update: {
          created_at?: string
          id?: string
          quote_author?: string | null
          quote_day?: string
          quote_text?: string
        }
        Relationships: []
      }
      level_definitions: {
        Row: {
          created_at: string
          id: string
          level_number: number
          title: string | null
          xp_required: number
        }
        Insert: {
          created_at?: string
          id?: string
          level_number: number
          title?: string | null
          xp_required: number
        }
        Update: {
          created_at?: string
          id?: string
          level_number?: number
          title?: string | null
          xp_required?: number
        }
        Relationships: []
      }
      muscle_group_rank_benchmarks: {
        Row: {
          created_at: string
          gender: Database["public"]["Enums"]["gender"]
          id: string
          min_threshold: number
          muscle_group_id: string
          rank_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          gender: Database["public"]["Enums"]["gender"]
          id?: string
          min_threshold: number
          muscle_group_id: string
          rank_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          gender?: Database["public"]["Enums"]["gender"]
          id?: string
          min_threshold?: number
          muscle_group_id?: string
          rank_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_muscle_group"
            columns: ["muscle_group_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_rank"
            columns: ["rank_id"]
            isOneToOne: false
            referencedRelation: "ranks"
            referencedColumns: ["id"]
          },
        ]
      }
      muscle_group_rank_history: {
        Row: {
          achieved_at: string
          id: string
          muscle_group_id: string
          rank_id: number
          strength_score: number | null
          user_id: string
        }
        Insert: {
          achieved_at: string
          id?: string
          muscle_group_id: string
          rank_id: number
          strength_score?: number | null
          user_id: string
        }
        Update: {
          achieved_at?: string
          id?: string
          muscle_group_id?: string
          rank_id?: number
          strength_score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "muscle_group_rank_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "muscle_group_rank_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      muscle_group_ranks: {
        Row: {
          created_at: string
          id: string
          last_calculated_at: string | null
          muscle_group_id: string
          rank_id: number | null
          strength_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_calculated_at?: string | null
          muscle_group_id: string
          rank_id?: number | null
          strength_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_calculated_at?: string | null
          muscle_group_id?: string
          rank_id?: number | null
          strength_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_muscle_group"
            columns: ["muscle_group_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muscle_group_ranks_muscle_group_id_fkey"
            columns: ["muscle_group_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muscle_group_ranks_rank_id_fkey"
            columns: ["rank_id"]
            isOneToOne: false
            referencedRelation: "ranks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muscle_group_ranks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      muscle_groups: {
        Row: {
          created_at: string | null
          id: string
          name: string
          overall_weight: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          overall_weight?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          overall_weight?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      muscle_rank_benchmarks: {
        Row: {
          created_at: string
          gender: Database["public"]["Enums"]["gender"]
          id: string
          min_threshold: number
          muscle_id: string
          rank_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          gender: Database["public"]["Enums"]["gender"]
          id?: string
          min_threshold: number
          muscle_id: string
          rank_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          gender?: Database["public"]["Enums"]["gender"]
          id?: string
          min_threshold?: number
          muscle_id?: string
          rank_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_muscle"
            columns: ["muscle_id"]
            isOneToOne: false
            referencedRelation: "muscles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_rank"
            columns: ["rank_id"]
            isOneToOne: false
            referencedRelation: "ranks"
            referencedColumns: ["id"]
          },
        ]
      }
      muscle_rank_history: {
        Row: {
          achieved_at: string
          id: string
          muscle_id: string
          rank_id: number
          strength_score: number | null
          user_id: string
        }
        Insert: {
          achieved_at: string
          id?: string
          muscle_id: string
          rank_id: number
          strength_score?: number | null
          user_id: string
        }
        Update: {
          achieved_at?: string
          id?: string
          muscle_id?: string
          rank_id?: number
          strength_score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "muscle_rank_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "muscle_rank_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      muscle_ranks: {
        Row: {
          created_at: string
          id: string
          last_calculated_at: string | null
          muscle_id: string
          rank_id: number | null
          strength_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_calculated_at?: string | null
          muscle_id: string
          rank_id?: number | null
          strength_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_calculated_at?: string | null
          muscle_id?: string
          rank_id?: number | null
          strength_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_muscle"
            columns: ["muscle_id"]
            isOneToOne: false
            referencedRelation: "muscles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muscle_ranks_muscle_id_fkey"
            columns: ["muscle_id"]
            isOneToOne: false
            referencedRelation: "muscles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muscle_ranks_rank_id_fkey"
            columns: ["rank_id"]
            isOneToOne: false
            referencedRelation: "ranks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muscle_ranks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      muscles: {
        Row: {
          created_at: string | null
          id: string
          muscle_group_id: string
          muscle_group_weight: number
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          muscle_group_id: string
          muscle_group_weight?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          muscle_group_id?: string
          muscle_group_weight?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "muscles_muscle_group_id_fkey1"
            columns: ["muscle_group_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          is_silent: boolean
          metadata: Json | null
          recipient_user_id: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          is_silent?: boolean
          metadata?: Json | null
          recipient_user_id: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          is_silent?: boolean
          metadata?: Json | null
          recipient_user_id?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      overall_rank_benchmarks: {
        Row: {
          created_at: string
          gender: Database["public"]["Enums"]["gender"]
          id: string
          min_threshold: number
          rank_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          gender: Database["public"]["Enums"]["gender"]
          id?: string
          min_threshold: number
          rank_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          gender?: Database["public"]["Enums"]["gender"]
          id?: string
          min_threshold?: number
          rank_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_rank"
            columns: ["rank_id"]
            isOneToOne: false
            referencedRelation: "ranks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          current_level_id: string | null
          display_name: string | null
          experience_points: number
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_level_id?: string | null
          display_name?: string | null
          experience_points?: number
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_level_id?: string | null
          display_name?: string | null
          experience_points?: number
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_level_id_fkey"
            columns: ["current_level_id"]
            isOneToOne: false
            referencedRelation: "level_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      ranks: {
        Row: {
          description: string | null
          id: number
          min_score: number | null
          rank_name: string
        }
        Insert: {
          description?: string | null
          id?: number
          min_score?: number | null
          rank_name: string
        }
        Update: {
          description?: string | null
          id?: number
          min_score?: number | null
          rank_name?: string
        }
        Relationships: []
      }
      system_banners: {
        Row: {
          cta_link: string | null
          end_date: string | null
          id: string
          message: string
          start_date: string
          title: string
        }
        Insert: {
          cta_link?: string | null
          end_date?: string | null
          id?: string
          message: string
          start_date?: string
          title: string
        }
        Update: {
          cta_link?: string | null
          end_date?: string | null
          id?: string
          message?: string
          start_date?: string
          title?: string
        }
        Relationships: []
      }
      user_body_measurements: {
        Row: {
          body_weight: number | null
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          body_weight?: number | null
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          body_weight?: number | null
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_body_measurements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dismissed_banners: {
        Row: {
          banner_id: string
          dismissed_at: string
          id: string
          user_id: string
        }
        Insert: {
          banner_id: string
          dismissed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          banner_id?: string
          dismissed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_dismissed_banners_banner_id_fkey"
            columns: ["banner_id"]
            isOneToOne: false
            referencedRelation: "system_banners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_dismissed_banners_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_exercise_pr_history: {
        Row: {
          achieved_at: string
          best_1rm: number | null
          best_swr: number | null
          exercise_id: string
          id: string
          user_id: string
        }
        Insert: {
          achieved_at: string
          best_1rm?: number | null
          best_swr?: number | null
          exercise_id: string
          id?: string
          user_id: string
        }
        Update: {
          achieved_at?: string
          best_1rm?: number | null
          best_swr?: number | null
          exercise_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_exercise_pr_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_exercise_pr_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_exercise_prs: {
        Row: {
          achieved_at: string | null
          best_1rm: number | null
          best_reps: number | null
          best_swr: number | null
          created_at: string | null
          exercise_id: string
          id: string
          rank_id: number | null
          source_set_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          achieved_at?: string | null
          best_1rm?: number | null
          best_reps?: number | null
          best_swr?: number | null
          created_at?: string | null
          exercise_id: string
          id?: string
          rank_id?: number | null
          source_set_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          achieved_at?: string | null
          best_1rm?: number | null
          best_reps?: number | null
          best_swr?: number | null
          created_at?: string | null
          exercise_id?: string
          id?: string
          rank_id?: number | null
          source_set_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_rank_id"
            columns: ["rank_id"]
            isOneToOne: false
            referencedRelation: "ranks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_exercise_prs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_exercise_prs_source_set_id_fkey"
            columns: ["source_set_id"]
            isOneToOne: false
            referencedRelation: "workout_session_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_exercise_prs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          requested_response: boolean
          text: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          requested_response?: boolean
          text: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          requested_response?: boolean
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_muscle_last_worked: {
        Row: {
          deleted: boolean
          id: string
          last_worked_date: string
          muscle_id: string
          updated_at: string
          user_id: string
          workout_session_id: string | null
        }
        Insert: {
          deleted?: boolean
          id?: string
          last_worked_date: string
          muscle_id: string
          updated_at?: string
          user_id: string
          workout_session_id?: string | null
        }
        Update: {
          deleted?: boolean
          id?: string
          last_worked_date?: string
          muscle_id?: string
          updated_at?: string
          user_id?: string
          workout_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_muscle_last_worked_muscle_id_fkey"
            columns: ["muscle_id"]
            isOneToOne: false
            referencedRelation: "muscles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_muscle_last_worked_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_rank_history: {
        Row: {
          achieved_at: string
          id: string
          rank_id: number
          strength_score: number | null
          user_id: string
        }
        Insert: {
          achieved_at: string
          id?: string
          rank_id: number
          strength_score?: number | null
          user_id: string
        }
        Update: {
          achieved_at?: string
          id?: string
          rank_id?: number
          strength_score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_rank_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_rank_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ranks: {
        Row: {
          created_at: string
          id: string
          last_calculated_at: string | null
          rank_id: number | null
          strength_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_calculated_at?: string | null
          rank_id?: number | null
          strength_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_calculated_at?: string | null
          rank_id?: number | null
          strength_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_ranks_rank_id_fkey"
            columns: ["rank_id"]
            isOneToOne: false
            referencedRelation: "ranks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_ranks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_streaks: {
        Row: {
          created_at: string
          current_streak: number
          deleted: boolean
          id: string
          last_paid_recovery_at: string | null
          last_streak_activity_date: string | null
          longest_streak: number
          streak_broken_at: string | null
          streak_recovered_at: string | null
          streak_value_before_break: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          deleted?: boolean
          id?: string
          last_paid_recovery_at?: string | null
          last_streak_activity_date?: string | null
          longest_streak?: number
          streak_broken_at?: string | null
          streak_recovered_at?: string | null
          streak_value_before_break?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          deleted?: boolean
          id?: string
          last_paid_recovery_at?: string | null
          last_streak_activity_date?: string | null
          longest_streak?: number
          streak_broken_at?: string | null
          streak_recovered_at?: string | null
          streak_value_before_break?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          active_plan_privacy: Database["public"]["Enums"]["visibility_level"]
          activity_visibility: Database["public"]["Enums"]["visibility_level"]
          age: number | null
          body_weight_privacy: Database["public"]["Enums"]["visibility_level"]
          deleted: boolean
          funnel: string | null
          gender: string | null
          id: string
          onboard_complete: boolean
          profile_visibility: Database["public"]["Enums"]["visibility_level"]
          push_notification_token: string | null
          rank_privacy: Database["public"]["Enums"]["visibility_level"]
          reset_persist: boolean
          stats_visibility: Database["public"]["Enums"]["visibility_level"]
          theme_preference: string | null
          updated_at: string
          weight_preference: string
          workout_session_privacy: Database["public"]["Enums"]["visibility_level"]
        }
        Insert: {
          active_plan_privacy?: Database["public"]["Enums"]["visibility_level"]
          activity_visibility?: Database["public"]["Enums"]["visibility_level"]
          age?: number | null
          body_weight_privacy?: Database["public"]["Enums"]["visibility_level"]
          deleted?: boolean
          funnel?: string | null
          gender?: string | null
          id: string
          onboard_complete?: boolean
          profile_visibility?: Database["public"]["Enums"]["visibility_level"]
          push_notification_token?: string | null
          rank_privacy?: Database["public"]["Enums"]["visibility_level"]
          reset_persist?: boolean
          stats_visibility?: Database["public"]["Enums"]["visibility_level"]
          theme_preference?: string | null
          updated_at?: string
          weight_preference?: string
          workout_session_privacy?: Database["public"]["Enums"]["visibility_level"]
        }
        Update: {
          active_plan_privacy?: Database["public"]["Enums"]["visibility_level"]
          activity_visibility?: Database["public"]["Enums"]["visibility_level"]
          age?: number | null
          body_weight_privacy?: Database["public"]["Enums"]["visibility_level"]
          deleted?: boolean
          funnel?: string | null
          gender?: string | null
          id?: string
          onboard_complete?: boolean
          profile_visibility?: Database["public"]["Enums"]["visibility_level"]
          push_notification_token?: string | null
          rank_privacy?: Database["public"]["Enums"]["visibility_level"]
          reset_persist?: boolean
          stats_visibility?: Database["public"]["Enums"]["visibility_level"]
          theme_preference?: string | null
          updated_at?: string
          weight_preference?: string
          workout_session_privacy?: Database["public"]["Enums"]["visibility_level"]
        }
        Relationships: []
      }
      workout_plan_day_exercise_sets: {
        Row: {
          created_at: string
          id: string
          is_amrap: boolean | null
          max_reps: number | null
          min_reps: number | null
          notes: string | null
          rest_seconds: number | null
          set_order: number
          target_rep_increase: number | null
          target_weight: number | null
          target_weight_increase: number | null
          updated_at: string
          workout_plan_exercise_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_amrap?: boolean | null
          max_reps?: number | null
          min_reps?: number | null
          notes?: string | null
          rest_seconds?: number | null
          set_order: number
          target_rep_increase?: number | null
          target_weight?: number | null
          target_weight_increase?: number | null
          updated_at?: string
          workout_plan_exercise_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_amrap?: boolean | null
          max_reps?: number | null
          min_reps?: number | null
          notes?: string | null
          rest_seconds?: number | null
          set_order?: number
          target_rep_increase?: number | null
          target_weight?: number | null
          target_weight_increase?: number | null
          updated_at?: string
          workout_plan_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_plan_day_exercise_sets_workout_plan_exercise_id_fkey"
            columns: ["workout_plan_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_plan_day_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plan_day_exercises: {
        Row: {
          auto_progression_enabled: boolean | null
          created_at: string
          deleted: boolean
          edit_sets_individually: boolean | null
          exercise_id: string
          exercise_order: number
          id: string
          notes: string | null
          post_exercise_rest_seconds: number | null
          rest_timer_enabled: boolean | null
          rest_timer_seconds: number | null
          updated_at: string
          warmup_sets_enabled: boolean | null
          workout_plan_day_id: string
        }
        Insert: {
          auto_progression_enabled?: boolean | null
          created_at?: string
          deleted?: boolean
          edit_sets_individually?: boolean | null
          exercise_id: string
          exercise_order: number
          id?: string
          notes?: string | null
          post_exercise_rest_seconds?: number | null
          rest_timer_enabled?: boolean | null
          rest_timer_seconds?: number | null
          updated_at?: string
          warmup_sets_enabled?: boolean | null
          workout_plan_day_id: string
        }
        Update: {
          auto_progression_enabled?: boolean | null
          created_at?: string
          deleted?: boolean
          edit_sets_individually?: boolean | null
          exercise_id?: string
          exercise_order?: number
          id?: string
          notes?: string | null
          post_exercise_rest_seconds?: number | null
          rest_timer_enabled?: boolean | null
          rest_timer_seconds?: number | null
          updated_at?: string
          warmup_sets_enabled?: boolean | null
          workout_plan_day_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_plan_day_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_plan_day_exercises_workout_plan_day_id_fkey"
            columns: ["workout_plan_day_id"]
            isOneToOne: false
            referencedRelation: "workout_plan_days"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plan_days: {
        Row: {
          created_at: string
          day_name: string
          day_order: number
          deleted: boolean
          description: string | null
          id: string
          updated_at: string
          workout_plan_id: string
        }
        Insert: {
          created_at?: string
          day_name: string
          day_order: number
          deleted?: boolean
          description?: string | null
          id?: string
          updated_at?: string
          workout_plan_id: string
        }
        Update: {
          created_at?: string
          day_name?: string
          day_order?: number
          deleted?: boolean
          description?: string | null
          id?: string
          updated_at?: string
          workout_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_plan_days_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          admin_plan: boolean
          approximate_workout_minutes: number | null
          created_at: string
          created_by: string | null
          days_per_week: number | null
          deleted: boolean
          description: string | null
          goal: string | null
          id: string
          is_active: boolean | null
          name: string
          plan_type: string | null
          public: boolean
          recommended_week_duration: number | null
          source_description: string | null
          start_date: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_plan?: boolean
          approximate_workout_minutes?: number | null
          created_at?: string
          created_by?: string | null
          days_per_week?: number | null
          deleted?: boolean
          description?: string | null
          goal?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          plan_type?: string | null
          public?: boolean
          recommended_week_duration?: number | null
          source_description?: string | null
          start_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_plan?: boolean
          approximate_workout_minutes?: number | null
          created_at?: string
          created_by?: string | null
          days_per_week?: number | null
          deleted?: boolean
          description?: string | null
          goal?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          plan_type?: string | null
          public?: boolean
          recommended_week_duration?: number | null
          source_description?: string | null
          start_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_session_sets: {
        Row: {
          actual_reps: number | null
          actual_weight_kg: number | null
          calculated_1rm: number | null
          calculated_swr: number | null
          deleted: boolean
          exercise_id: string
          id: string
          is_success: boolean | null
          is_warmup: boolean | null
          notes: string | null
          performed_at: string
          planned_max_reps: number | null
          planned_min_reps: number | null
          planned_weight_kg: number | null
          rest_seconds_taken: number | null
          set_order: number
          updated_at: string
          workout_plan_day_exercise_sets_id: string | null
          workout_session_id: string
        }
        Insert: {
          actual_reps?: number | null
          actual_weight_kg?: number | null
          calculated_1rm?: number | null
          calculated_swr?: number | null
          deleted?: boolean
          exercise_id: string
          id?: string
          is_success?: boolean | null
          is_warmup?: boolean | null
          notes?: string | null
          performed_at?: string
          planned_max_reps?: number | null
          planned_min_reps?: number | null
          planned_weight_kg?: number | null
          rest_seconds_taken?: number | null
          set_order: number
          updated_at?: string
          workout_plan_day_exercise_sets_id?: string | null
          workout_session_id: string
        }
        Update: {
          actual_reps?: number | null
          actual_weight_kg?: number | null
          calculated_1rm?: number | null
          calculated_swr?: number | null
          deleted?: boolean
          exercise_id?: string
          id?: string
          is_success?: boolean | null
          is_warmup?: boolean | null
          notes?: string | null
          performed_at?: string
          planned_max_reps?: number | null
          planned_min_reps?: number | null
          planned_weight_kg?: number | null
          rest_seconds_taken?: number | null
          set_order?: number
          updated_at?: string
          workout_plan_day_exercise_sets_id?: string | null
          workout_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_session_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_session_sets_workout_plan_day_exercise_sets_id_fkey"
            columns: ["workout_plan_day_exercise_sets_id"]
            isOneToOne: false
            referencedRelation: "workout_plan_day_exercise_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_session_sets_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          deleted: boolean
          duration_seconds: number | null
          exercises_performed_summary: string | null
          id: string
          muscle_group_rank_ups_count: number
          muscle_rank_ups_count: number
          notes: string | null
          overall_rank_up_count: number
          public: boolean
          session_name: string | null
          started_at: string
          status: string
          total_reps: number | null
          total_sets: number | null
          total_volume_kg: number | null
          updated_at: string
          user_id: string
          workout_plan_day_id: string | null
          workout_plan_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deleted?: boolean
          duration_seconds?: number | null
          exercises_performed_summary?: string | null
          id?: string
          muscle_group_rank_ups_count?: number
          muscle_rank_ups_count?: number
          notes?: string | null
          overall_rank_up_count?: number
          public?: boolean
          session_name?: string | null
          started_at?: string
          status?: string
          total_reps?: number | null
          total_sets?: number | null
          total_volume_kg?: number | null
          updated_at?: string
          user_id: string
          workout_plan_day_id?: string | null
          workout_plan_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deleted?: boolean
          duration_seconds?: number | null
          exercises_performed_summary?: string | null
          id?: string
          muscle_group_rank_ups_count?: number
          muscle_rank_ups_count?: number
          notes?: string | null
          overall_rank_up_count?: number
          public?: boolean
          session_name?: string | null
          started_at?: string
          status?: string
          total_reps?: number | null
          total_sets?: number | null
          total_volume_kg?: number | null
          updated_at?: string
          user_id?: string
          workout_plan_day_id?: string | null
          workout_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_workout_plan_day_id_fkey"
            columns: ["workout_plan_day_id"]
            isOneToOne: false
            referencedRelation: "workout_plan_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      global_leaderboard: {
        Row: {
          avatar_url: string | null
          position: number | null
          strength_score: number | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_workout_plan: {
        Args: { user_id_input: string; plan_id_input: string }
        Returns: undefined
      }
      check_and_break_streaks: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      clone_user_workout_plan: {
        Args: { template_plan_id_input: string; target_user_id_input: string }
        Returns: string
      }
      initialize_user_muscle_groups: {
        Args: { new_user_id: string }
        Returns: undefined
      }
      is_friend: {
        Args: { user1_id: string; user2_id: string }
        Returns: boolean
      }
      is_plan_day_owner: {
        Args: { plan_day_id: string }
        Returns: boolean
      }
      is_plan_exercise_owner: {
        Args: { plan_exercise_id: string }
        Returns: boolean
      }
      is_set_log_owner: {
        Args: { set_log_id: string }
        Returns: boolean
      }
      recalculate_all_muscle_stats: {
        Args: { target_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      body_measurement_type:
        | "body_weight"
        | "body_fat_percentage"
        | "neck"
        | "chest"
        | "waist"
        | "hips"
        | "bicep_left"
        | "bicep_right"
        | "thigh_left"
        | "thigh_right"
        | "calf_left"
        | "calf_right"
      enum_body_side: "left" | "right" | "center" | "front" | "back"
      exercise_type:
        | "cardio"
        | "N/A"
        | "body_weight"
        | "free_weights"
        | "barbell"
        | "calisthenics"
        | "machine"
        | "assisted_body_weight"
        | "weighted_body_weight"
      friendship_status: "pending" | "accepted" | "blocked"
      gender: "male" | "female"
      meal_type: "breakfast" | "lunch" | "dinner" | "snack"
      muscle_group_type:
        | "BackLeftHead"
        | "BackLeftNeck"
        | "BackLeftTrapezius"
        | "BackLeftLatissimusDorsi"
        | "BackLeftInfraspinatus"
        | "BackLeftDeltoid"
        | "BackLeftTriceps"
        | "BackLeftForearm"
        | "BackLeftHand"
        | "BackLeftGlutes"
        | "BackLeftHamstrings"
        | "BackLeftKnee"
        | "BackLeftCalves"
        | "BackLeftShin"
        | "BackLeftFoot"
        | "BackLeftFiller"
        | "BackRightHead"
        | "BackRightNeck"
        | "BackRightTrapezius"
        | "BackRightLatissimusDorsi"
        | "BackRightInfraspinatus"
        | "BackRightDeltoid"
        | "BackRightTriceps"
        | "BackRightForearm"
        | "BackRightHand"
        | "BackRightGlutes"
        | "BackRightHamstrings"
        | "BackRightKnee"
        | "BackRightCalves"
        | "BackRightShin"
        | "BackRightFoot"
        | "BackRightFiller"
        | "FrontLeftHead"
        | "FrontLeftNeck"
        | "FrontLeftTrapezius"
        | "FrontLeftChest"
        | "FrontLeftDeltoid"
        | "FrontLeftBicep"
        | "FrontLeftForearm"
        | "FrontLeftHand"
        | "FrontLeftUpperAbs"
        | "FrontLeftLowerAbs"
        | "FrontLeftObliques"
        | "FrontLeftQuadriceps"
        | "FrontLeftKnee"
        | "FrontLeftCalves"
        | "FrontLeftShin"
        | "FrontLeftFoot"
        | "FrontRightHead"
        | "FrontRightNeck"
        | "FrontRightTrapezius"
        | "FrontRightChest"
        | "FrontRightDeltoid"
        | "FrontRightBicep"
        | "FrontRightForearm"
        | "FrontRightHand"
        | "FrontRightUpperAbs"
        | "FrontRightLowerAbs"
        | "FrontRightObliques"
        | "FrontRightQuadriceps"
        | "FrontRightKnee"
        | "FrontRightCalves"
        | "FrontRightShin"
        | "FrontRightFoot"
      muscle_intensity: "primary" | "secondary" | "accessory"
      muscle_rank:
        | "Neophyte"
        | "Adept"
        | "Vanguard"
        | "Elite"
        | "Master"
        | "Champion"
        | "Legend"
      muscle_type:
        | "BackLeftFoot"
        | "BackLeftShin2"
        | "BackLeftShin1"
        | "BackLeftCalve2"
        | "BackLeftCalve1"
        | "BackLeftKneeFiller"
        | "BackLeftSemitendinosus"
        | "BackLeftBicepsFemoris"
        | "BackLeftAdductorMagnus"
        | "BackLeftIlotibialBand1"
        | "BackLeftIlotibialBand2"
        | "BackLeftGluteusMaximus"
        | "BackLeftGluteusMedius"
        | "BackLeftLatissimusDorsi3"
        | "BackLeftLatissimusDorsi2"
        | "BackLeftLatissimusDorsi1"
        | "BackLeftInfraspinatus"
        | "BackLeftHand"
        | "BackLeftForearm"
        | "BackLeftLateralHead"
        | "BackLeftBrachiiLongHead"
        | "BackLeftMedialHead"
        | "BackLeftDeltoid"
        | "BackLeftTrapezius"
        | "BackLeftFiller"
        | "BackLeftNeck"
        | "BackLeftHead"
        | "BackRightFoot"
        | "BackRightShin2"
        | "BackRightShin1"
        | "BackRightCalve2"
        | "BackRightCalve1"
        | "BackRightKneeFiller"
        | "BackRightSemitendinosus"
        | "BackRightBicepsFemoris"
        | "BackRightAdductorMagnus"
        | "BackRightIlotibialBand1"
        | "BackRightIlotibialBand2"
        | "BackRightGluteusMaximus"
        | "BackRightGluteusMedius"
        | "BackRightLatissimusDorsi3"
        | "BackRightLatissimusDorsi2"
        | "BackRightLatissimusDorsi1"
        | "BackRightInfraspinatus"
        | "BackRightHand"
        | "BackRightForearm"
        | "BackRightLateralHead"
        | "BackRightBrachiiLongHead"
        | "BackRightMedialHead"
        | "BackRightDeltoid"
        | "BackRightTrapezius"
        | "BackRightFiller"
        | "BackRightNeck"
        | "BackRightHead"
        | "FrontRightFoot"
        | "FrontRightGastrocnemius"
        | "FrontRightPeroneusLongus"
        | "FrontRightShin"
        | "FrontRightKnee4"
        | "FrontRightKnee3"
        | "FrontRightKnee2"
        | "FrontRightKnee1"
        | "FrontRightVastusLateralis"
        | "FrontRightVastusMedialis"
        | "FrontRightRectusFemoris"
        | "FrontRightSartorius"
        | "FrontRightTensorFasciaeLatae"
        | "FrontRightInnerThigh"
        | "FrontRightRectusAbdominis"
        | "FrontRightTendinousInscriptions"
        | "FrontRightAbs2"
        | "FrontRightAbs1"
        | "FrontRightWaist2"
        | "FrontRightExternalOblique2"
        | "FrontRightExternalOblique1"
        | "FrontRightSerratusAnterior"
        | "FrontRightHand"
        | "FrontRightBrachioradialis"
        | "FrontRightPalmarisLongus"
        | "FrontRightBicep"
        | "FrontRightDeltoid"
        | "FrontRightChestFiller2"
        | "FrontRightChestFiller1"
        | "FrontRightChest2"
        | "FrontRightTrapezius"
        | "FrontRightNeck"
        | "FrontRightHead"
        | "FrontLeftFoot"
        | "FrontLeftGastrocnemius"
        | "FrontLeftPeroneusLongus"
        | "FrontLeftShin"
        | "FrontLeftKnee4"
        | "FrontLeftKnee3"
        | "FrontLeftKnee2"
        | "FrontLeftKnee1"
        | "FrontLeftVastusLateralis"
        | "FrontLeftVastusMedialis"
        | "FrontLeftRectusFemoris"
        | "FrontLeftSartorius"
        | "FrontLeftTensorFasciaeLatae"
        | "FrontLeftInnerThigh"
        | "FrontLeftRectusAbdominis"
        | "FrontLeftTendinousInscriptions"
        | "FrontLeftAbs2"
        | "FrontLeftAbs1"
        | "FrontLeftWaist"
        | "FrontLeftExternalOblique2"
        | "FrontLeftExternalOblique1"
        | "FrontLeftSerratusAnterior"
        | "FrontLeftHand"
        | "FrontLeftBrachioradialis"
        | "FrontLeftPalmarisLongus"
        | "FrontLeftBicep"
        | "FrontLeftDeltoid"
        | "FrontLeftChestFiller2"
        | "FrontLeftChestFiller1"
        | "FrontLeftChest"
        | "FrontLeftTrapezius"
        | "FrontLeftNeck"
        | "FrontLeftHead"
      notification_type:
        | "friend_request_received"
        | "friend_request_accepted"
        | "friendship_removed"
      primary_group_enum: "arms" | "legs" | "back" | "chest" | "abs"
      rank_label: "F" | "E" | "D" | "C" | "B" | "A" | "S" | "Elite"
      session_status:
        | "active"
        | "paused"
        | "completed"
        | "skipped"
        | "cancelled"
        | "error"
        | "pending"
        | "no_plan"
        | "no_workouts"
      unit_type: "metric" | "imperial"
      visibility_level: "public" | "friends_only" | "private"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      body_measurement_type: [
        "body_weight",
        "body_fat_percentage",
        "neck",
        "chest",
        "waist",
        "hips",
        "bicep_left",
        "bicep_right",
        "thigh_left",
        "thigh_right",
        "calf_left",
        "calf_right",
      ],
      enum_body_side: ["left", "right", "center", "front", "back"],
      exercise_type: [
        "cardio",
        "N/A",
        "body_weight",
        "free_weights",
        "barbell",
        "calisthenics",
        "machine",
        "assisted_body_weight",
        "weighted_body_weight",
      ],
      friendship_status: ["pending", "accepted", "blocked"],
      gender: ["male", "female"],
      meal_type: ["breakfast", "lunch", "dinner", "snack"],
      muscle_group_type: [
        "BackLeftHead",
        "BackLeftNeck",
        "BackLeftTrapezius",
        "BackLeftLatissimusDorsi",
        "BackLeftInfraspinatus",
        "BackLeftDeltoid",
        "BackLeftTriceps",
        "BackLeftForearm",
        "BackLeftHand",
        "BackLeftGlutes",
        "BackLeftHamstrings",
        "BackLeftKnee",
        "BackLeftCalves",
        "BackLeftShin",
        "BackLeftFoot",
        "BackLeftFiller",
        "BackRightHead",
        "BackRightNeck",
        "BackRightTrapezius",
        "BackRightLatissimusDorsi",
        "BackRightInfraspinatus",
        "BackRightDeltoid",
        "BackRightTriceps",
        "BackRightForearm",
        "BackRightHand",
        "BackRightGlutes",
        "BackRightHamstrings",
        "BackRightKnee",
        "BackRightCalves",
        "BackRightShin",
        "BackRightFoot",
        "BackRightFiller",
        "FrontLeftHead",
        "FrontLeftNeck",
        "FrontLeftTrapezius",
        "FrontLeftChest",
        "FrontLeftDeltoid",
        "FrontLeftBicep",
        "FrontLeftForearm",
        "FrontLeftHand",
        "FrontLeftUpperAbs",
        "FrontLeftLowerAbs",
        "FrontLeftObliques",
        "FrontLeftQuadriceps",
        "FrontLeftKnee",
        "FrontLeftCalves",
        "FrontLeftShin",
        "FrontLeftFoot",
        "FrontRightHead",
        "FrontRightNeck",
        "FrontRightTrapezius",
        "FrontRightChest",
        "FrontRightDeltoid",
        "FrontRightBicep",
        "FrontRightForearm",
        "FrontRightHand",
        "FrontRightUpperAbs",
        "FrontRightLowerAbs",
        "FrontRightObliques",
        "FrontRightQuadriceps",
        "FrontRightKnee",
        "FrontRightCalves",
        "FrontRightShin",
        "FrontRightFoot",
      ],
      muscle_intensity: ["primary", "secondary", "accessory"],
      muscle_rank: [
        "Neophyte",
        "Adept",
        "Vanguard",
        "Elite",
        "Master",
        "Champion",
        "Legend",
      ],
      muscle_type: [
        "BackLeftFoot",
        "BackLeftShin2",
        "BackLeftShin1",
        "BackLeftCalve2",
        "BackLeftCalve1",
        "BackLeftKneeFiller",
        "BackLeftSemitendinosus",
        "BackLeftBicepsFemoris",
        "BackLeftAdductorMagnus",
        "BackLeftIlotibialBand1",
        "BackLeftIlotibialBand2",
        "BackLeftGluteusMaximus",
        "BackLeftGluteusMedius",
        "BackLeftLatissimusDorsi3",
        "BackLeftLatissimusDorsi2",
        "BackLeftLatissimusDorsi1",
        "BackLeftInfraspinatus",
        "BackLeftHand",
        "BackLeftForearm",
        "BackLeftLateralHead",
        "BackLeftBrachiiLongHead",
        "BackLeftMedialHead",
        "BackLeftDeltoid",
        "BackLeftTrapezius",
        "BackLeftFiller",
        "BackLeftNeck",
        "BackLeftHead",
        "BackRightFoot",
        "BackRightShin2",
        "BackRightShin1",
        "BackRightCalve2",
        "BackRightCalve1",
        "BackRightKneeFiller",
        "BackRightSemitendinosus",
        "BackRightBicepsFemoris",
        "BackRightAdductorMagnus",
        "BackRightIlotibialBand1",
        "BackRightIlotibialBand2",
        "BackRightGluteusMaximus",
        "BackRightGluteusMedius",
        "BackRightLatissimusDorsi3",
        "BackRightLatissimusDorsi2",
        "BackRightLatissimusDorsi1",
        "BackRightInfraspinatus",
        "BackRightHand",
        "BackRightForearm",
        "BackRightLateralHead",
        "BackRightBrachiiLongHead",
        "BackRightMedialHead",
        "BackRightDeltoid",
        "BackRightTrapezius",
        "BackRightFiller",
        "BackRightNeck",
        "BackRightHead",
        "FrontRightFoot",
        "FrontRightGastrocnemius",
        "FrontRightPeroneusLongus",
        "FrontRightShin",
        "FrontRightKnee4",
        "FrontRightKnee3",
        "FrontRightKnee2",
        "FrontRightKnee1",
        "FrontRightVastusLateralis",
        "FrontRightVastusMedialis",
        "FrontRightRectusFemoris",
        "FrontRightSartorius",
        "FrontRightTensorFasciaeLatae",
        "FrontRightInnerThigh",
        "FrontRightRectusAbdominis",
        "FrontRightTendinousInscriptions",
        "FrontRightAbs2",
        "FrontRightAbs1",
        "FrontRightWaist2",
        "FrontRightExternalOblique2",
        "FrontRightExternalOblique1",
        "FrontRightSerratusAnterior",
        "FrontRightHand",
        "FrontRightBrachioradialis",
        "FrontRightPalmarisLongus",
        "FrontRightBicep",
        "FrontRightDeltoid",
        "FrontRightChestFiller2",
        "FrontRightChestFiller1",
        "FrontRightChest2",
        "FrontRightTrapezius",
        "FrontRightNeck",
        "FrontRightHead",
        "FrontLeftFoot",
        "FrontLeftGastrocnemius",
        "FrontLeftPeroneusLongus",
        "FrontLeftShin",
        "FrontLeftKnee4",
        "FrontLeftKnee3",
        "FrontLeftKnee2",
        "FrontLeftKnee1",
        "FrontLeftVastusLateralis",
        "FrontLeftVastusMedialis",
        "FrontLeftRectusFemoris",
        "FrontLeftSartorius",
        "FrontLeftTensorFasciaeLatae",
        "FrontLeftInnerThigh",
        "FrontLeftRectusAbdominis",
        "FrontLeftTendinousInscriptions",
        "FrontLeftAbs2",
        "FrontLeftAbs1",
        "FrontLeftWaist",
        "FrontLeftExternalOblique2",
        "FrontLeftExternalOblique1",
        "FrontLeftSerratusAnterior",
        "FrontLeftHand",
        "FrontLeftBrachioradialis",
        "FrontLeftPalmarisLongus",
        "FrontLeftBicep",
        "FrontLeftDeltoid",
        "FrontLeftChestFiller2",
        "FrontLeftChestFiller1",
        "FrontLeftChest",
        "FrontLeftTrapezius",
        "FrontLeftNeck",
        "FrontLeftHead",
      ],
      notification_type: [
        "friend_request_received",
        "friend_request_accepted",
        "friendship_removed",
      ],
      primary_group_enum: ["arms", "legs", "back", "chest", "abs"],
      rank_label: ["F", "E", "D", "C", "B", "A", "S", "Elite"],
      session_status: [
        "active",
        "paused",
        "completed",
        "skipped",
        "cancelled",
        "error",
        "pending",
        "no_plan",
        "no_workouts",
      ],
      unit_type: ["metric", "imperial"],
      visibility_level: ["public", "friends_only", "private"],
    },
  },
} as const
