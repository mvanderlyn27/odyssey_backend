export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      _internal_resolve: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query: string;
          variables?: Json;
        };
        Returns: Json;
      };
      comment_directive: { Args: { comment_: string }; Returns: Json };
      exception: { Args: { message: string }; Returns: string };
      get_schema_version: { Args: never; Returns: number };
      resolve: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      active_workout_plans: {
        Row: {
          active_workout_plan_id: string | null;
          cur_cycle_start_date: string | null;
          deleted: boolean;
          id: string;
          prev_cycle_start_date: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active_workout_plan_id?: string | null;
          cur_cycle_start_date?: string | null;
          deleted?: boolean;
          id?: string;
          prev_cycle_start_date?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active_workout_plan_id?: string | null;
          cur_cycle_start_date?: string | null;
          deleted?: boolean;
          id?: string;
          prev_cycle_start_date?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "active_workout_plans_active_workout_plan_id_fkey";
            columns: ["active_workout_plan_id"];
            isOneToOne: false;
            referencedRelation: "workout_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "active_workout_plans_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      active_workout_sessions: {
        Row: {
          created_at: string;
          id: string;
          started_at: string | null;
          user_id: string;
          workout_session_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          started_at?: string | null;
          user_id: string;
          workout_session_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          started_at?: string | null;
          user_id?: string;
          workout_session_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "active_workout_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "active_workout_sessions_workout_session_id_fkey";
            columns: ["workout_session_id"];
            isOneToOne: false;
            referencedRelation: "workout_sessions";
            referencedColumns: ["id"];
          }
        ];
      };
      badges: {
        Row: {
          created_at: string;
          description: string | null;
          icon_url: string | null;
          id: string;
          name: string;
          requirements: Json | null;
          xp_reward: number;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          icon_url?: string | null;
          id?: string;
          name: string;
          requirements?: Json | null;
          xp_reward?: number;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          icon_url?: string | null;
          id?: string;
          name?: string;
          requirements?: Json | null;
          xp_reward?: number;
        };
        Relationships: [];
      };
      body_measurements: {
        Row: {
          created_at: string;
          id: string;
          measured_at: string;
          measurement_type: Database["public"]["Enums"]["body_measurement_type"];
          user_id: string;
          value: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          measured_at?: string;
          measurement_type: Database["public"]["Enums"]["body_measurement_type"];
          user_id: string;
          value: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          measured_at?: string;
          measurement_type?: Database["public"]["Enums"]["body_measurement_type"];
          user_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "body_measurements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      custom_exercise_equipment_requirements: {
        Row: {
          created_at: string;
          custom_exercise_id: string;
          equipment_id: string;
          id: string;
          priority: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          custom_exercise_id: string;
          equipment_id: string;
          id?: string;
          priority?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          custom_exercise_id?: string;
          equipment_id?: string;
          id?: string;
          priority?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "custom_exercise_equipment_requirements_custom_exercise_id_fkey";
            columns: ["custom_exercise_id"];
            isOneToOne: false;
            referencedRelation: "custom_exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "custom_exercise_equipment_requirements_equipment_id_fkey";
            columns: ["equipment_id"];
            isOneToOne: false;
            referencedRelation: "equipment";
            referencedColumns: ["id"];
          }
        ];
      };
      custom_exercise_muscles: {
        Row: {
          created_at: string | null;
          custom_exercise_id: string;
          exercise_muscle_weight: number | null;
          id: string;
          muscle_id: string;
          muscle_intensity: Database["public"]["Enums"]["muscle_intensity"];
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          custom_exercise_id: string;
          exercise_muscle_weight?: number | null;
          id?: string;
          muscle_id: string;
          muscle_intensity: Database["public"]["Enums"]["muscle_intensity"];
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          custom_exercise_id?: string;
          exercise_muscle_weight?: number | null;
          id?: string;
          muscle_id?: string;
          muscle_intensity?: Database["public"]["Enums"]["muscle_intensity"];
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "custom_exercise_muscles_custom_exercise_id_fkey";
            columns: ["custom_exercise_id"];
            isOneToOne: false;
            referencedRelation: "custom_exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "custom_exercise_muscles_muscle_id_fkey";
            columns: ["muscle_id"];
            isOneToOne: false;
            referencedRelation: "muscles";
            referencedColumns: ["id"];
          }
        ];
      };
      custom_exercises: {
        Row: {
          created_at: string;
          deleted: boolean;
          description: string | null;
          difficulty: string | null;
          exercise_type: Database["public"]["Enums"]["exercise_type"] | null;
          id: string;
          instructions: string | null;
          is_bilateral: boolean | null;
          name: string;
          popularity: number;
          source_custom_exercise_id: string | null;
          updated_at: string;
          user_id: string;
          video_url: string | null;
        };
        Insert: {
          created_at?: string;
          deleted?: boolean;
          description?: string | null;
          difficulty?: string | null;
          exercise_type?: Database["public"]["Enums"]["exercise_type"] | null;
          id?: string;
          instructions?: string | null;
          is_bilateral?: boolean | null;
          name: string;
          popularity?: number;
          source_custom_exercise_id?: string | null;
          updated_at?: string;
          user_id: string;
          video_url?: string | null;
        };
        Update: {
          created_at?: string;
          deleted?: boolean;
          description?: string | null;
          difficulty?: string | null;
          exercise_type?: Database["public"]["Enums"]["exercise_type"] | null;
          id?: string;
          instructions?: string | null;
          is_bilateral?: boolean | null;
          name?: string;
          popularity?: number;
          source_custom_exercise_id?: string | null;
          updated_at?: string;
          user_id?: string;
          video_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "custom_exercises_source_custom_exercise_id_fkey";
            columns: ["source_custom_exercise_id"];
            isOneToOne: false;
            referencedRelation: "custom_exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "custom_exercises_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "global_leaderboard";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "custom_exercises_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "custom_exercises_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "v_global_leaderboard_with_change";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "custom_exercises_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "v_user_profile_full";
            referencedColumns: ["user_id"];
          }
        ];
      };
      equipment: {
        Row: {
          created_at: string;
          deleted: boolean;
          description: string | null;
          id: string;
          image_url: string | null;
          name: string;
          type: Database["public"]["Enums"]["equipment_type"] | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted?: boolean;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          name: string;
          type?: Database["public"]["Enums"]["equipment_type"] | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted?: boolean;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          name?: string;
          type?: Database["public"]["Enums"]["equipment_type"] | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      exercise_alternate_names: {
        Row: {
          exercise_id: string;
          id: string;
          name: string;
        };
        Insert: {
          exercise_id: string;
          id?: string;
          name: string;
        };
        Update: {
          exercise_id?: string;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exercise_alternate_names_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          }
        ];
      };
      exercise_equipment_requirements: {
        Row: {
          created_at: string;
          deleted: boolean;
          equipment_id: string | null;
          exercise_id: string;
          id: string;
          priority: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted?: boolean;
          equipment_id?: string | null;
          exercise_id: string;
          id?: string;
          priority?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted?: boolean;
          equipment_id?: string | null;
          exercise_id?: string;
          id?: string;
          priority?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exercise_equipment_requirements_equipment_id_fkey";
            columns: ["equipment_id"];
            isOneToOne: false;
            referencedRelation: "equipment";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_equipment_requirements_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          }
        ];
      };
      exercise_muscles: {
        Row: {
          created_at: string | null;
          exercise_id: string;
          exercise_muscle_weight: number | null;
          id: string;
          muscle_id: string;
          muscle_intensity: Database["public"]["Enums"]["muscle_intensity"];
        };
        Insert: {
          created_at?: string | null;
          exercise_id: string;
          exercise_muscle_weight?: number | null;
          id?: string;
          muscle_id: string;
          muscle_intensity: Database["public"]["Enums"]["muscle_intensity"];
        };
        Update: {
          created_at?: string | null;
          exercise_id?: string;
          exercise_muscle_weight?: number | null;
          id?: string;
          muscle_id?: string;
          muscle_intensity?: Database["public"]["Enums"]["muscle_intensity"];
        };
        Relationships: [
          {
            foreignKeyName: "exercise_muscles_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_muscles_muscle_id_fkey";
            columns: ["muscle_id"];
            isOneToOne: false;
            referencedRelation: "muscles";
            referencedColumns: ["id"];
          }
        ];
      };
      exercises: {
        Row: {
          alpha_value: number | null;
          created_at: string;
          deleted: boolean;
          description: string | null;
          difficulty: string | null;
          elite_duration_female: number | null;
          elite_duration_male: number | null;
          elite_reps_female: number | null;
          elite_reps_male: number | null;
          elite_swr_female: number | null;
          elite_swr_male: number | null;
          exercise_type: Database["public"]["Enums"]["exercise_type"] | null;
          id: string;
          instructions: string | null;
          is_bilateral: boolean | null;
          movement_type: Database["public"]["Enums"]["movement_types"] | null;
          name: string;
          popularity: number;
          updated_at: string;
          video_url: string | null;
        };
        Insert: {
          alpha_value?: number | null;
          created_at?: string;
          deleted?: boolean;
          description?: string | null;
          difficulty?: string | null;
          elite_duration_female?: number | null;
          elite_duration_male?: number | null;
          elite_reps_female?: number | null;
          elite_reps_male?: number | null;
          elite_swr_female?: number | null;
          elite_swr_male?: number | null;
          exercise_type?: Database["public"]["Enums"]["exercise_type"] | null;
          id?: string;
          instructions?: string | null;
          is_bilateral?: boolean | null;
          movement_type?: Database["public"]["Enums"]["movement_types"] | null;
          name: string;
          popularity?: number;
          updated_at?: string;
          video_url?: string | null;
        };
        Update: {
          alpha_value?: number | null;
          created_at?: string;
          deleted?: boolean;
          description?: string | null;
          difficulty?: string | null;
          elite_duration_female?: number | null;
          elite_duration_male?: number | null;
          elite_reps_female?: number | null;
          elite_reps_male?: number | null;
          elite_swr_female?: number | null;
          elite_swr_male?: number | null;
          exercise_type?: Database["public"]["Enums"]["exercise_type"] | null;
          id?: string;
          instructions?: string | null;
          is_bilateral?: boolean | null;
          movement_type?: Database["public"]["Enums"]["movement_types"] | null;
          name?: string;
          popularity?: number;
          updated_at?: string;
          video_url?: string | null;
        };
        Relationships: [];
      };
      feed_items: {
        Row: {
          comments_count: number;
          created_at: string;
          id: string;
          is_public: boolean;
          likes_count: number;
          metadata: Json;
          post_type: Database["public"]["Enums"]["feed_post_type"];
          status: Database["public"]["Enums"]["processing_status"];
          user_id: string;
          workout_session_id: string | null;
        };
        Insert: {
          comments_count?: number;
          created_at?: string;
          id?: string;
          is_public?: boolean;
          likes_count?: number;
          metadata?: Json;
          post_type: Database["public"]["Enums"]["feed_post_type"];
          status?: Database["public"]["Enums"]["processing_status"];
          user_id: string;
          workout_session_id?: string | null;
        };
        Update: {
          comments_count?: number;
          created_at?: string;
          id?: string;
          is_public?: boolean;
          likes_count?: number;
          metadata?: Json;
          post_type?: Database["public"]["Enums"]["feed_post_type"];
          status?: Database["public"]["Enums"]["processing_status"];
          user_id?: string;
          workout_session_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "feed_items_workout_session_id_fkey";
            columns: ["workout_session_id"];
            isOneToOne: false;
            referencedRelation: "workout_sessions";
            referencedColumns: ["id"];
          }
        ];
      };
      friendships: {
        Row: {
          addressee_id: string;
          created_at: string;
          id: string;
          requester_id: string;
          status: Database["public"]["Enums"]["friendship_status"];
          updated_at: string;
        };
        Insert: {
          addressee_id: string;
          created_at?: string;
          id?: string;
          requester_id: string;
          status?: Database["public"]["Enums"]["friendship_status"];
          updated_at?: string;
        };
        Update: {
          addressee_id?: string;
          created_at?: string;
          id?: string;
          requester_id?: string;
          status?: Database["public"]["Enums"]["friendship_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey";
            columns: ["addressee_id"];
            isOneToOne: false;
            referencedRelation: "global_leaderboard";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "friendships_addressee_id_fkey";
            columns: ["addressee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "friendships_addressee_id_fkey";
            columns: ["addressee_id"];
            isOneToOne: false;
            referencedRelation: "v_global_leaderboard_with_change";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "friendships_addressee_id_fkey";
            columns: ["addressee_id"];
            isOneToOne: false;
            referencedRelation: "v_user_profile_full";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "friendships_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "global_leaderboard";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "friendships_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "friendships_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "v_global_leaderboard_with_change";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "friendships_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "v_user_profile_full";
            referencedColumns: ["user_id"];
          }
        ];
      };
      inspirational_quotes: {
        Row: {
          created_at: string;
          id: string;
          quote_author: string | null;
          quote_day: string;
          quote_text: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          quote_author?: string | null;
          quote_day: string;
          quote_text: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          quote_author?: string | null;
          quote_day?: string;
          quote_text?: string;
        };
        Relationships: [];
      };
      inter_ranks: {
        Row: {
          id: number;
          max_score: number;
          min_score: number;
          name: string;
          rank_id: number;
          sort_order: number;
        };
        Insert: {
          id?: number;
          max_score: number;
          min_score: number;
          name: string;
          rank_id: number;
          sort_order: number;
        };
        Update: {
          id?: number;
          max_score?: number;
          min_score?: number;
          name?: string;
          rank_id?: number;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "inter_ranks_rank_id_fkey";
            columns: ["rank_id"];
            isOneToOne: false;
            referencedRelation: "ranks";
            referencedColumns: ["id"];
          }
        ];
      };
      level_definitions: {
        Row: {
          created_at: string;
          id: string;
          level_number: number;
          title: string | null;
          xp_required: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          level_number: number;
          title?: string | null;
          xp_required: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          level_number?: number;
          title?: string | null;
          xp_required?: number;
        };
        Relationships: [];
      };
      muscle_group_rank_history: {
        Row: {
          achieved_at: string;
          id: string;
          leaderboard_inter_rank_id: number | null;
          leaderboard_position: number | null;
          leaderboard_position_change: number | null;
          leaderboard_rank_id: number | null;
          leaderboard_score: number | null;
          locked: boolean;
          muscle_group_id: string;
          permanent_inter_rank_id: number | null;
          permanent_rank_id: number | null;
          permanent_score: number | null;
          user_id: string;
        };
        Insert: {
          achieved_at: string;
          id?: string;
          leaderboard_inter_rank_id?: number | null;
          leaderboard_position?: number | null;
          leaderboard_position_change?: number | null;
          leaderboard_rank_id?: number | null;
          leaderboard_score?: number | null;
          locked?: boolean;
          muscle_group_id: string;
          permanent_inter_rank_id?: number | null;
          permanent_rank_id?: number | null;
          permanent_score?: number | null;
          user_id: string;
        };
        Update: {
          achieved_at?: string;
          id?: string;
          leaderboard_inter_rank_id?: number | null;
          leaderboard_position?: number | null;
          leaderboard_position_change?: number | null;
          leaderboard_rank_id?: number | null;
          leaderboard_score?: number | null;
          locked?: boolean;
          muscle_group_id?: string;
          permanent_inter_rank_id?: number | null;
          permanent_rank_id?: number | null;
          permanent_score?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "muscle_group_rank_history_leaderboard_inter_rank_id_fkey";
            columns: ["leaderboard_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_group_rank_history_permanent_inter_rank_id_fkey";
            columns: ["permanent_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_group_rank_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      muscle_group_ranks: {
        Row: {
          created_at: string;
          id: string;
          last_calculated_at: string | null;
          leaderboard_inter_rank_id: number | null;
          leaderboard_position: number | null;
          leaderboard_position_change: number | null;
          leaderboard_rank_id: number | null;
          leaderboard_score: number | null;
          locked: boolean;
          muscle_group_id: string;
          permanent_inter_rank_id: number | null;
          permanent_rank_id: number | null;
          permanent_score: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_calculated_at?: string | null;
          leaderboard_inter_rank_id?: number | null;
          leaderboard_position?: number | null;
          leaderboard_position_change?: number | null;
          leaderboard_rank_id?: number | null;
          leaderboard_score?: number | null;
          locked?: boolean;
          muscle_group_id: string;
          permanent_inter_rank_id?: number | null;
          permanent_rank_id?: number | null;
          permanent_score?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_calculated_at?: string | null;
          leaderboard_inter_rank_id?: number | null;
          leaderboard_position?: number | null;
          leaderboard_position_change?: number | null;
          leaderboard_rank_id?: number | null;
          leaderboard_score?: number | null;
          locked?: boolean;
          muscle_group_id?: string;
          permanent_inter_rank_id?: number | null;
          permanent_rank_id?: number | null;
          permanent_score?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_muscle_group";
            columns: ["muscle_group_id"];
            isOneToOne: false;
            referencedRelation: "muscle_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_group_ranks_leaderboard_inter_rank_id_fkey";
            columns: ["leaderboard_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_group_ranks_leaderboard_rank_id_fkey";
            columns: ["leaderboard_rank_id"];
            isOneToOne: false;
            referencedRelation: "ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_group_ranks_muscle_group_id_fkey";
            columns: ["muscle_group_id"];
            isOneToOne: false;
            referencedRelation: "muscle_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_group_ranks_permanent_inter_rank_id_fkey";
            columns: ["permanent_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_group_ranks_rank_id_fkey";
            columns: ["permanent_rank_id"];
            isOneToOne: false;
            referencedRelation: "ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_group_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "global_leaderboard";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "muscle_group_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_group_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "v_global_leaderboard_with_change";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "muscle_group_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "v_user_profile_full";
            referencedColumns: ["user_id"];
          }
        ];
      };
      muscle_groups: {
        Row: {
          created_at: string | null;
          id: string;
          name: string;
          overall_weight: number;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          name: string;
          overall_weight?: number;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          name?: string;
          overall_weight?: number;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      muscle_rank_history: {
        Row: {
          achieved_at: string;
          id: string;
          leaderboard_inter_rank_id: number | null;
          leaderboard_position: number | null;
          leaderboard_position_change: number | null;
          leaderboard_rank_id: number | null;
          leaderboard_score: number | null;
          locked: boolean;
          muscle_id: string;
          permanent_inter_rank_id: number | null;
          permanent_rank_id: number | null;
          permanent_score: number | null;
          user_id: string;
        };
        Insert: {
          achieved_at: string;
          id?: string;
          leaderboard_inter_rank_id?: number | null;
          leaderboard_position?: number | null;
          leaderboard_position_change?: number | null;
          leaderboard_rank_id?: number | null;
          leaderboard_score?: number | null;
          locked?: boolean;
          muscle_id: string;
          permanent_inter_rank_id?: number | null;
          permanent_rank_id?: number | null;
          permanent_score?: number | null;
          user_id: string;
        };
        Update: {
          achieved_at?: string;
          id?: string;
          leaderboard_inter_rank_id?: number | null;
          leaderboard_position?: number | null;
          leaderboard_position_change?: number | null;
          leaderboard_rank_id?: number | null;
          leaderboard_score?: number | null;
          locked?: boolean;
          muscle_id?: string;
          permanent_inter_rank_id?: number | null;
          permanent_rank_id?: number | null;
          permanent_score?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "muscle_rank_history_leaderboard_inter_rank_id_fkey";
            columns: ["leaderboard_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_rank_history_permanent_inter_rank_id_fkey";
            columns: ["permanent_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_rank_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      muscle_ranks: {
        Row: {
          created_at: string;
          id: string;
          last_calculated_at: string | null;
          leaderboard_inter_rank_id: number | null;
          leaderboard_position: number | null;
          leaderboard_position_change: number | null;
          leaderboard_rank_id: number | null;
          leaderboard_score: number | null;
          locked: boolean;
          muscle_id: string;
          permanent_inter_rank_id: number | null;
          permanent_rank_id: number | null;
          permanent_score: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_calculated_at?: string | null;
          leaderboard_inter_rank_id?: number | null;
          leaderboard_position?: number | null;
          leaderboard_position_change?: number | null;
          leaderboard_rank_id?: number | null;
          leaderboard_score?: number | null;
          locked?: boolean;
          muscle_id: string;
          permanent_inter_rank_id?: number | null;
          permanent_rank_id?: number | null;
          permanent_score?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_calculated_at?: string | null;
          leaderboard_inter_rank_id?: number | null;
          leaderboard_position?: number | null;
          leaderboard_position_change?: number | null;
          leaderboard_rank_id?: number | null;
          leaderboard_score?: number | null;
          locked?: boolean;
          muscle_id?: string;
          permanent_inter_rank_id?: number | null;
          permanent_rank_id?: number | null;
          permanent_score?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_muscle";
            columns: ["muscle_id"];
            isOneToOne: false;
            referencedRelation: "muscles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_ranks_leaderboard_inter_rank_id_fkey";
            columns: ["leaderboard_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_ranks_leaderboard_rank_id_fkey";
            columns: ["leaderboard_rank_id"];
            isOneToOne: false;
            referencedRelation: "ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_ranks_muscle_id_fkey";
            columns: ["muscle_id"];
            isOneToOne: false;
            referencedRelation: "muscles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_ranks_permanent_inter_rank_id_fkey";
            columns: ["permanent_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_ranks_rank_id_fkey";
            columns: ["permanent_rank_id"];
            isOneToOne: false;
            referencedRelation: "ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "global_leaderboard";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "muscle_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "v_global_leaderboard_with_change";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "muscle_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "v_user_profile_full";
            referencedColumns: ["user_id"];
          }
        ];
      };
      muscles: {
        Row: {
          created_at: string | null;
          id: string;
          muscle_group_id: string;
          muscle_group_weight: number;
          name: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          muscle_group_id: string;
          muscle_group_weight?: number;
          name: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          muscle_group_id?: string;
          muscle_group_weight?: number;
          name?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "muscles_muscle_group_id_fkey1";
            columns: ["muscle_group_id"];
            isOneToOne: false;
            referencedRelation: "muscle_groups";
            referencedColumns: ["id"];
          }
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          error_message: string | null;
          id: string;
          is_read: boolean;
          is_silent: boolean;
          link: string | null;
          message: string | null;
          metadata: Json | null;
          recipient_user_id: string;
          sender_avatar_url: string | null;
          sent_at: string | null;
          status: Database["public"]["Enums"]["notification_status"];
          title: string | null;
          type: Database["public"]["Enums"]["notification_type"];
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          is_read?: boolean;
          is_silent?: boolean;
          link?: string | null;
          message?: string | null;
          metadata?: Json | null;
          recipient_user_id: string;
          sender_avatar_url?: string | null;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["notification_status"];
          title?: string | null;
          type: Database["public"]["Enums"]["notification_type"];
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          is_read?: boolean;
          is_silent?: boolean;
          link?: string | null;
          message?: string | null;
          metadata?: Json | null;
          recipient_user_id?: string;
          sender_avatar_url?: string | null;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["notification_status"];
          title?: string | null;
          type?: Database["public"]["Enums"]["notification_type"];
        };
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {
        Row: {
          avatar_blurhash: string | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          current_level_id: string | null;
          display_name: string | null;
          experience_points: number;
          id: string;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          avatar_blurhash?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          current_level_id?: string | null;
          display_name?: string | null;
          experience_points?: number;
          id: string;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          avatar_blurhash?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          current_level_id?: string | null;
          display_name?: string | null;
          experience_points?: number;
          id?: string;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_current_level_id_fkey";
            columns: ["current_level_id"];
            isOneToOne: false;
            referencedRelation: "level_definitions";
            referencedColumns: ["id"];
          }
        ];
      };
      quest_tasks: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          quest_id: string;
          requirements: Json | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          quest_id: string;
          requirements?: Json | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          quest_id?: string;
          requirements?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "quest_tasks_quest_id_fkey";
            columns: ["quest_id"];
            isOneToOne: false;
            referencedRelation: "quests";
            referencedColumns: ["id"];
          }
        ];
      };
      quests: {
        Row: {
          created_at: string;
          end_date: string | null;
          id: string;
          name: string;
          rewards: Json | null;
          start_date: string | null;
          type: Database["public"]["Enums"]["quest_type"] | null;
        };
        Insert: {
          created_at?: string;
          end_date?: string | null;
          id?: string;
          name: string;
          rewards?: Json | null;
          start_date?: string | null;
          type?: Database["public"]["Enums"]["quest_type"] | null;
        };
        Update: {
          created_at?: string;
          end_date?: string | null;
          id?: string;
          name?: string;
          rewards?: Json | null;
          start_date?: string | null;
          type?: Database["public"]["Enums"]["quest_type"] | null;
        };
        Relationships: [];
      };
      rank_calculations: {
        Row: {
          achieved_at: string | null;
          bodyweight_kg: number | null;
          created_at: string | null;
          exercise_id: string | null;
          id: string;
          new_calculator_balance: number | null;
          old_calculator_balance: number | null;
          rank_up_data: Json | null;
          reps: number | null;
          status: Database["public"]["Enums"]["processing_status"];
          user_id: string;
          weight_kg: number | null;
        };
        Insert: {
          achieved_at?: string | null;
          bodyweight_kg?: number | null;
          created_at?: string | null;
          exercise_id?: string | null;
          id?: string;
          new_calculator_balance?: number | null;
          old_calculator_balance?: number | null;
          rank_up_data?: Json | null;
          reps?: number | null;
          status?: Database["public"]["Enums"]["processing_status"];
          user_id: string;
          weight_kg?: number | null;
        };
        Update: {
          achieved_at?: string | null;
          bodyweight_kg?: number | null;
          created_at?: string | null;
          exercise_id?: string | null;
          id?: string;
          new_calculator_balance?: number | null;
          old_calculator_balance?: number | null;
          rank_up_data?: Json | null;
          reps?: number | null;
          status?: Database["public"]["Enums"]["processing_status"];
          user_id?: string;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "rank_calculations_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rank_calculations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      ranks: {
        Row: {
          description: string | null;
          id: number;
          max_score: number | null;
          min_score: number | null;
          rank_name: string;
        };
        Insert: {
          description?: string | null;
          id?: number;
          max_score?: number | null;
          min_score?: number | null;
          rank_name: string;
        };
        Update: {
          description?: string | null;
          id?: number;
          max_score?: number | null;
          min_score?: number | null;
          rank_name?: string;
        };
        Relationships: [];
      };
      streak_rewards: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          streak_length: number;
          xp_reward: number;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          streak_length: number;
          xp_reward: number;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          streak_length?: number;
          xp_reward?: number;
        };
        Relationships: [];
      };
      system_banners: {
        Row: {
          banner_info: Json;
          banner_type: Database["public"]["Enums"]["banner_type"];
          end_date: string | null;
          id: string;
          max_build: number | null;
          max_version: string | null;
          min_build: number | null;
          min_version: string | null;
          platform: Database["public"]["Enums"]["banner_platform"] | null;
          start_date: string;
          user_group: Database["public"]["Enums"]["banner_user_group"] | null;
        };
        Insert: {
          banner_info: Json;
          banner_type: Database["public"]["Enums"]["banner_type"];
          end_date?: string | null;
          id?: string;
          max_build?: number | null;
          max_version?: string | null;
          min_build?: number | null;
          min_version?: string | null;
          platform?: Database["public"]["Enums"]["banner_platform"] | null;
          start_date?: string;
          user_group?: Database["public"]["Enums"]["banner_user_group"] | null;
        };
        Update: {
          banner_info?: Json;
          banner_type?: Database["public"]["Enums"]["banner_type"];
          end_date?: string | null;
          id?: string;
          max_build?: number | null;
          max_version?: string | null;
          min_build?: number | null;
          min_version?: string | null;
          platform?: Database["public"]["Enums"]["banner_platform"] | null;
          start_date?: string;
          user_group?: Database["public"]["Enums"]["banner_user_group"] | null;
        };
        Relationships: [];
      };
      user_badges: {
        Row: {
          badge_id: string;
          unlocked_at: string;
          user_id: string;
        };
        Insert: {
          badge_id: string;
          unlocked_at?: string;
          user_id: string;
        };
        Update: {
          badge_id?: string;
          unlocked_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "badges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_badges_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_dismissed_banners: {
        Row: {
          banner_id: string;
          dismissed_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          banner_id: string;
          dismissed_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          banner_id?: string;
          dismissed_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_dismissed_banners_banner_id_fkey";
            columns: ["banner_id"];
            isOneToOne: false;
            referencedRelation: "system_banners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_dismissed_banners_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_exercise_pr_history: {
        Row: {
          achieved_at: string;
          bodyweight_kg: number | null;
          custom_exercise_id: string | null;
          estimated_1rm: number | null;
          exercise_id: string | null;
          exercise_key: string;
          id: string;
          pr_type: Database["public"]["Enums"]["pr_type"] | null;
          reps: number | null;
          source_set_id: string | null;
          swr: number | null;
          user_id: string;
          weight_kg: number | null;
        };
        Insert: {
          achieved_at: string;
          bodyweight_kg?: number | null;
          custom_exercise_id?: string | null;
          estimated_1rm?: number | null;
          exercise_id?: string | null;
          exercise_key: string;
          id?: string;
          pr_type?: Database["public"]["Enums"]["pr_type"] | null;
          reps?: number | null;
          source_set_id?: string | null;
          swr?: number | null;
          user_id: string;
          weight_kg?: number | null;
        };
        Update: {
          achieved_at?: string;
          bodyweight_kg?: number | null;
          custom_exercise_id?: string | null;
          estimated_1rm?: number | null;
          exercise_id?: string | null;
          exercise_key?: string;
          id?: string;
          pr_type?: Database["public"]["Enums"]["pr_type"] | null;
          reps?: number | null;
          source_set_id?: string | null;
          swr?: number | null;
          user_id?: string;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_exercise_pr_history_custom_exercise_id_fkey";
            columns: ["custom_exercise_id"];
            isOneToOne: false;
            referencedRelation: "custom_exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_exercise_pr_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_exercise_prs: {
        Row: {
          achieved_at: string | null;
          bodyweight_kg: number | null;
          created_at: string | null;
          custom_exercise_id: string | null;
          estimated_1rm: number | null;
          exercise_id: string | null;
          exercise_key: string;
          id: string;
          pr_type: Database["public"]["Enums"]["pr_type"];
          reps: number | null;
          source_set_id: string | null;
          swr: number | null;
          updated_at: string | null;
          user_id: string;
          weight_kg: number | null;
        };
        Insert: {
          achieved_at?: string | null;
          bodyweight_kg?: number | null;
          created_at?: string | null;
          custom_exercise_id?: string | null;
          estimated_1rm?: number | null;
          exercise_id?: string | null;
          exercise_key: string;
          id?: string;
          pr_type: Database["public"]["Enums"]["pr_type"];
          reps?: number | null;
          source_set_id?: string | null;
          swr?: number | null;
          updated_at?: string | null;
          user_id: string;
          weight_kg?: number | null;
        };
        Update: {
          achieved_at?: string | null;
          bodyweight_kg?: number | null;
          created_at?: string | null;
          custom_exercise_id?: string | null;
          estimated_1rm?: number | null;
          exercise_id?: string | null;
          exercise_key?: string;
          id?: string;
          pr_type?: Database["public"]["Enums"]["pr_type"];
          reps?: number | null;
          source_set_id?: string | null;
          swr?: number | null;
          updated_at?: string | null;
          user_id?: string;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_exercise_prs_custom_exercise_id_fkey";
            columns: ["custom_exercise_id"];
            isOneToOne: false;
            referencedRelation: "custom_exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_exercise_prs_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_exercise_prs_source_set_id_fkey";
            columns: ["source_set_id"];
            isOneToOne: false;
            referencedRelation: "workout_session_sets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_exercise_prs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_exercise_rank_history: {
        Row: {
          achieved_at: string;
          bodyweight_kg: number | null;
          estimated_1rm: number | null;
          exercise_id: string;
          id: string;
          leaderboard_inter_rank_id: number | null;
          leaderboard_position: number | null;
          leaderboard_position_change: number | null;
          leaderboard_rank_id: number | null;
          leaderboard_score: number | null;
          permanent_inter_rank_id: number | null;
          permanent_rank_id: number | null;
          permanent_score: number | null;
          reps: number | null;
          session_set_id: string | null;
          swr: number | null;
          user_id: string;
          weight_kg: number | null;
        };
        Insert: {
          achieved_at: string;
          bodyweight_kg?: number | null;
          estimated_1rm?: number | null;
          exercise_id: string;
          id?: string;
          leaderboard_inter_rank_id?: number | null;
          leaderboard_position?: number | null;
          leaderboard_position_change?: number | null;
          leaderboard_rank_id?: number | null;
          leaderboard_score?: number | null;
          permanent_inter_rank_id?: number | null;
          permanent_rank_id?: number | null;
          permanent_score?: number | null;
          reps?: number | null;
          session_set_id?: string | null;
          swr?: number | null;
          user_id: string;
          weight_kg?: number | null;
        };
        Update: {
          achieved_at?: string;
          bodyweight_kg?: number | null;
          estimated_1rm?: number | null;
          exercise_id?: string;
          id?: string;
          leaderboard_inter_rank_id?: number | null;
          leaderboard_position?: number | null;
          leaderboard_position_change?: number | null;
          leaderboard_rank_id?: number | null;
          leaderboard_score?: number | null;
          permanent_inter_rank_id?: number | null;
          permanent_rank_id?: number | null;
          permanent_score?: number | null;
          reps?: number | null;
          session_set_id?: string | null;
          swr?: number | null;
          user_id?: string;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_exercise_rank_history_leaderboard_inter_rank_id_fkey";
            columns: ["leaderboard_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_exercise_rank_history_leaderboard_rank_id_fkey";
            columns: ["leaderboard_rank_id"];
            isOneToOne: false;
            referencedRelation: "ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_exercise_rank_history_permanent_inter_rank_id_fkey";
            columns: ["permanent_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_exercise_rank_history_permanent_rank_id_fkey";
            columns: ["permanent_rank_id"];
            isOneToOne: false;
            referencedRelation: "ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_exercise_rank_history_session_set_id_fkey";
            columns: ["session_set_id"];
            isOneToOne: false;
            referencedRelation: "workout_session_sets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_exercise_rank_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_exercise_ranks: {
        Row: {
          bodyweight_kg: number | null;
          created_at: string | null;
          estimated_1rm: number | null;
          exercise_id: string;
          id: string;
          last_calculated_at: string | null;
          leaderboard_inter_rank_id: number | null;
          leaderboard_position: number | null;
          leaderboard_position_change: number | null;
          leaderboard_rank_id: number | null;
          leaderboard_score: number | null;
          permanent_inter_rank_id: number | null;
          permanent_rank_id: number | null;
          permanent_score: number | null;
          reps: number | null;
          session_set_id: string | null;
          swr: number | null;
          updated_at: string | null;
          user_id: string;
          weight_kg: number | null;
        };
        Insert: {
          bodyweight_kg?: number | null;
          created_at?: string | null;
          estimated_1rm?: number | null;
          exercise_id: string;
          id?: string;
          last_calculated_at?: string | null;
          leaderboard_inter_rank_id?: number | null;
          leaderboard_position?: number | null;
          leaderboard_position_change?: number | null;
          leaderboard_rank_id?: number | null;
          leaderboard_score?: number | null;
          permanent_inter_rank_id?: number | null;
          permanent_rank_id?: number | null;
          permanent_score?: number | null;
          reps?: number | null;
          session_set_id?: string | null;
          swr?: number | null;
          updated_at?: string | null;
          user_id: string;
          weight_kg?: number | null;
        };
        Update: {
          bodyweight_kg?: number | null;
          created_at?: string | null;
          estimated_1rm?: number | null;
          exercise_id?: string;
          id?: string;
          last_calculated_at?: string | null;
          leaderboard_inter_rank_id?: number | null;
          leaderboard_position?: number | null;
          leaderboard_position_change?: number | null;
          leaderboard_rank_id?: number | null;
          leaderboard_score?: number | null;
          permanent_inter_rank_id?: number | null;
          permanent_rank_id?: number | null;
          permanent_score?: number | null;
          reps?: number | null;
          session_set_id?: string | null;
          swr?: number | null;
          updated_at?: string | null;
          user_id?: string;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_exercise_ranks_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_exercise_ranks_leaderboard_inter_rank_id_fkey";
            columns: ["leaderboard_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_exercise_ranks_leaderboard_rank_id_fkey";
            columns: ["leaderboard_rank_id"];
            isOneToOne: false;
            referencedRelation: "ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_exercise_ranks_permanent_inter_rank_id_fkey";
            columns: ["permanent_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_exercise_ranks_permanent_rank_id_fkey";
            columns: ["permanent_rank_id"];
            isOneToOne: false;
            referencedRelation: "ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_exercise_ranks_session_set_id_fkey";
            columns: ["session_set_id"];
            isOneToOne: false;
            referencedRelation: "workout_session_sets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_exercise_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_favorite_exercises: {
        Row: {
          created_at: string | null;
          custom_exercise_id: string | null;
          exercise_id: string | null;
          id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          custom_exercise_id?: string | null;
          exercise_id?: string | null;
          id?: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          custom_exercise_id?: string | null;
          exercise_id?: string | null;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_favorite_exercises_custom_exercise_id_fkey";
            columns: ["custom_exercise_id"];
            isOneToOne: false;
            referencedRelation: "custom_exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_favorite_exercises_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          }
        ];
      };
      user_feedback: {
        Row: {
          completed: boolean;
          created_at: string;
          data: Json | null;
          email: string | null;
          feedback_type: Database["public"]["Enums"]["feedback_type"];
          id: string;
          requested_response: boolean;
          text: string | null;
          trigger: string | null;
          user_id: string;
        };
        Insert: {
          completed?: boolean;
          created_at?: string;
          data?: Json | null;
          email?: string | null;
          feedback_type?: Database["public"]["Enums"]["feedback_type"];
          id?: string;
          requested_response?: boolean;
          text?: string | null;
          trigger?: string | null;
          user_id: string;
        };
        Update: {
          completed?: boolean;
          created_at?: string;
          data?: Json | null;
          email?: string | null;
          feedback_type?: Database["public"]["Enums"]["feedback_type"];
          id?: string;
          requested_response?: boolean;
          text?: string | null;
          trigger?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_feedback_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_feeds: {
        Row: {
          created_at: string;
          feed_item_id: string;
          seen: boolean;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          feed_item_id: string;
          seen?: boolean;
          user_id: string;
        };
        Update: {
          created_at?: string;
          feed_item_id?: string;
          seen?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_feeds_feed_item_id_fkey";
            columns: ["feed_item_id"];
            isOneToOne: false;
            referencedRelation: "feed_items";
            referencedColumns: ["id"];
          }
        ];
      };
      user_interactions: {
        Row: {
          feedback_prompt_skip_count: number;
          has_shown_cancellation_feedback: boolean | null;
          last_feedback_interaction_type: string | null;
          last_feedback_prompt_shown_at: string | null;
          last_paywall_shown_at: string | null;
          last_positive_feedback_at: string | null;
          paywall_show_count: number;
          user_id: string;
        };
        Insert: {
          feedback_prompt_skip_count?: number;
          has_shown_cancellation_feedback?: boolean | null;
          last_feedback_interaction_type?: string | null;
          last_feedback_prompt_shown_at?: string | null;
          last_paywall_shown_at?: string | null;
          last_positive_feedback_at?: string | null;
          paywall_show_count?: number;
          user_id: string;
        };
        Update: {
          feedback_prompt_skip_count?: number;
          has_shown_cancellation_feedback?: boolean | null;
          last_feedback_interaction_type?: string | null;
          last_feedback_prompt_shown_at?: string | null;
          last_paywall_shown_at?: string | null;
          last_positive_feedback_at?: string | null;
          paywall_show_count?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_interactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_milestone_progress: {
        Row: {
          app_opens: number | null;
          body_rank_ups_achieved: number | null;
          exercise_rank_ups_achieved: number | null;
          friends_added: number | null;
          max_muscles_logged_in_one_workout: number | null;
          max_prs_achieved_in_one_workout: number | null;
          max_rank_ups_in_one_workout: number | null;
          max_workout_duration_seconds: number | null;
          muscle_group_rank_ups_achieved: number | null;
          muscle_rank_ups_achieved: number | null;
          prs_achieved: number | null;
          share_workout_count: number | null;
          shared_rank_card: number | null;
          total_level_ups_gained: number | null;
          total_reps_achieved: number | null;
          total_sets_achieved: number | null;
          total_volume_achieved: number | null;
          total_xp_gained: number | null;
          unique_exercises_logged: Json | null;
          unique_muscles_logged: Json | null;
          unique_profiles_viewed: Json | null;
          updated_at: string | null;
          user_id: string;
          workout_plans_created: number | null;
          workouts_completed: number | null;
        };
        Insert: {
          app_opens?: number | null;
          body_rank_ups_achieved?: number | null;
          exercise_rank_ups_achieved?: number | null;
          friends_added?: number | null;
          max_muscles_logged_in_one_workout?: number | null;
          max_prs_achieved_in_one_workout?: number | null;
          max_rank_ups_in_one_workout?: number | null;
          max_workout_duration_seconds?: number | null;
          muscle_group_rank_ups_achieved?: number | null;
          muscle_rank_ups_achieved?: number | null;
          prs_achieved?: number | null;
          share_workout_count?: number | null;
          shared_rank_card?: number | null;
          total_level_ups_gained?: number | null;
          total_reps_achieved?: number | null;
          total_sets_achieved?: number | null;
          total_volume_achieved?: number | null;
          total_xp_gained?: number | null;
          unique_exercises_logged?: Json | null;
          unique_muscles_logged?: Json | null;
          unique_profiles_viewed?: Json | null;
          updated_at?: string | null;
          user_id: string;
          workout_plans_created?: number | null;
          workouts_completed?: number | null;
        };
        Update: {
          app_opens?: number | null;
          body_rank_ups_achieved?: number | null;
          exercise_rank_ups_achieved?: number | null;
          friends_added?: number | null;
          max_muscles_logged_in_one_workout?: number | null;
          max_prs_achieved_in_one_workout?: number | null;
          max_rank_ups_in_one_workout?: number | null;
          max_workout_duration_seconds?: number | null;
          muscle_group_rank_ups_achieved?: number | null;
          muscle_rank_ups_achieved?: number | null;
          prs_achieved?: number | null;
          share_workout_count?: number | null;
          shared_rank_card?: number | null;
          total_level_ups_gained?: number | null;
          total_reps_achieved?: number | null;
          total_sets_achieved?: number | null;
          total_volume_achieved?: number | null;
          total_xp_gained?: number | null;
          unique_exercises_logged?: Json | null;
          unique_muscles_logged?: Json | null;
          unique_profiles_viewed?: Json | null;
          updated_at?: string | null;
          user_id?: string;
          workout_plans_created?: number | null;
          workouts_completed?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_milestone_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_muscle_last_worked: {
        Row: {
          deleted: boolean;
          id: string;
          last_worked_date: string;
          muscle_id: string;
          updated_at: string;
          user_id: string;
          workout_session_id: string | null;
        };
        Insert: {
          deleted?: boolean;
          id?: string;
          last_worked_date: string;
          muscle_id: string;
          updated_at?: string;
          user_id: string;
          workout_session_id?: string | null;
        };
        Update: {
          deleted?: boolean;
          id?: string;
          last_worked_date?: string;
          muscle_id?: string;
          updated_at?: string;
          user_id?: string;
          workout_session_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_muscle_last_worked_muscle_id_fkey";
            columns: ["muscle_id"];
            isOneToOne: false;
            referencedRelation: "muscles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_muscle_last_worked_workout_session_id_fkey";
            columns: ["workout_session_id"];
            isOneToOne: false;
            referencedRelation: "workout_sessions";
            referencedColumns: ["id"];
          }
        ];
      };
      user_quest_task_progress: {
        Row: {
          created_at: string;
          progress_data: Json | null;
          quest_id: string;
          task_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          progress_data?: Json | null;
          quest_id: string;
          task_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          progress_data?: Json | null;
          quest_id?: string;
          task_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_quest_task_progress_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "quest_tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_quest_task_progress_user_id_quest_id_fkey";
            columns: ["user_id", "quest_id"];
            isOneToOne: false;
            referencedRelation: "user_quests";
            referencedColumns: ["user_id", "quest_id"];
          }
        ];
      };
      user_quests: {
        Row: {
          claimed_at: string | null;
          completed_at: string | null;
          created_at: string;
          quest_id: string;
          status: Database["public"]["Enums"]["quest_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          claimed_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          quest_id: string;
          status: Database["public"]["Enums"]["quest_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          claimed_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          quest_id?: string;
          status?: Database["public"]["Enums"]["quest_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_quests_quest_id_fkey";
            columns: ["quest_id"];
            isOneToOne: false;
            referencedRelation: "quests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_quests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_rank_history: {
        Row: {
          achieved_at: string;
          id: string;
          leaderboard_inter_rank_id: number | null;
          leaderboard_position: number | null;
          leaderboard_position_change: number | null;
          leaderboard_rank_id: number | null;
          leaderboard_score: number | null;
          permanent_inter_rank_id: number | null;
          permanent_rank_id: number | null;
          permanent_score: number | null;
          user_id: string;
        };
        Insert: {
          achieved_at: string;
          id?: string;
          leaderboard_inter_rank_id?: number | null;
          leaderboard_position?: number | null;
          leaderboard_position_change?: number | null;
          leaderboard_rank_id?: number | null;
          leaderboard_score?: number | null;
          permanent_inter_rank_id?: number | null;
          permanent_rank_id?: number | null;
          permanent_score?: number | null;
          user_id: string;
        };
        Update: {
          achieved_at?: string;
          id?: string;
          leaderboard_inter_rank_id?: number | null;
          leaderboard_position?: number | null;
          leaderboard_position_change?: number | null;
          leaderboard_rank_id?: number | null;
          leaderboard_score?: number | null;
          permanent_inter_rank_id?: number | null;
          permanent_rank_id?: number | null;
          permanent_score?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_rank_history_leaderboard_inter_rank_id_fkey";
            columns: ["leaderboard_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_rank_history_permanent_inter_rank_id_fkey";
            columns: ["permanent_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_rank_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_ranks: {
        Row: {
          created_at: string;
          id: string;
          last_calculated_at: string | null;
          leaderboard_inter_rank_id: number | null;
          leaderboard_position: number | null;
          leaderboard_position_change: number | null;
          leaderboard_rank_id: number | null;
          leaderboard_score: number | null;
          permanent_inter_rank_id: number | null;
          permanent_rank_id: number | null;
          permanent_score: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_calculated_at?: string | null;
          leaderboard_inter_rank_id?: number | null;
          leaderboard_position?: number | null;
          leaderboard_position_change?: number | null;
          leaderboard_rank_id?: number | null;
          leaderboard_score?: number | null;
          permanent_inter_rank_id?: number | null;
          permanent_rank_id?: number | null;
          permanent_score?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_calculated_at?: string | null;
          leaderboard_inter_rank_id?: number | null;
          leaderboard_position?: number | null;
          leaderboard_position_change?: number | null;
          leaderboard_rank_id?: number | null;
          leaderboard_score?: number | null;
          permanent_inter_rank_id?: number | null;
          permanent_rank_id?: number | null;
          permanent_score?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_ranks_leaderboard_inter_rank_id_fkey";
            columns: ["leaderboard_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_ranks_leaderboard_rank_id_fkey";
            columns: ["leaderboard_rank_id"];
            isOneToOne: false;
            referencedRelation: "ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_ranks_permanent_inter_rank_id_fkey";
            columns: ["permanent_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_ranks_rank_id_fkey";
            columns: ["permanent_rank_id"];
            isOneToOne: false;
            referencedRelation: "ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "global_leaderboard";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "user_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "v_global_leaderboard_with_change";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "user_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "v_user_profile_full";
            referencedColumns: ["user_id"];
          }
        ];
      };
      user_streak_rewards: {
        Row: {
          created_at: string;
          is_claimed: boolean;
          is_eligible: boolean;
          streak_reward_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          is_claimed?: boolean;
          is_eligible?: boolean;
          streak_reward_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          is_claimed?: boolean;
          is_eligible?: boolean;
          streak_reward_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_streak_rewards_streak_reward_id_fkey";
            columns: ["streak_reward_id"];
            isOneToOne: false;
            referencedRelation: "streak_rewards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_streak_rewards_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_streaks: {
        Row: {
          created_at: string;
          current_streak: number;
          highest_streak: number;
          last_workout_date: string | null;
          previous_streak: number;
          streak_lost_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          current_streak?: number;
          highest_streak?: number;
          last_workout_date?: string | null;
          previous_streak?: number;
          streak_lost_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          current_streak?: number;
          highest_streak?: number;
          last_workout_date?: string | null;
          previous_streak?: number;
          streak_lost_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_streaks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_xp: {
        Row: {
          created_at: string;
          level: number;
          updated_at: string;
          user_id: string;
          xp: number;
        };
        Insert: {
          created_at?: string;
          level?: number;
          updated_at?: string;
          user_id: string;
          xp?: number;
        };
        Update: {
          created_at?: string;
          level?: number;
          updated_at?: string;
          user_id?: string;
          xp?: number;
        };
        Relationships: [
          {
            foreignKeyName: "user_xp_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_xp_log: {
        Row: {
          created_at: string | null;
          id: string;
          leveled_up: boolean | null;
          source: string | null;
          user_id: string;
          xp_added: number;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          leveled_up?: boolean | null;
          source?: string | null;
          user_id: string;
          xp_added: number;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          leveled_up?: boolean | null;
          source?: string | null;
          user_id?: string;
          xp_added?: number;
        };
        Relationships: [
          {
            foreignKeyName: "user_xp_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      users: {
        Row: {
          age: number | null;
          beta_offer_claimed: Database["public"]["Enums"]["beta_offer_type"] | null;
          beta_user: boolean | null;
          deleted: boolean;
          force_logout: boolean | null;
          funnel: string | null;
          gender: Database["public"]["Enums"]["gender"] | null;
          id: string;
          is_premium: boolean | null;
          last_workout_timestamp: string | null;
          notification_enabled: boolean | null;
          onboard_complete: boolean;
          onboarding_metadata: Json | null;
          plan_type: string | null;
          premium_expires_at: string | null;
          premium_status: Database["public"]["Enums"]["premium_status"] | null;
          profile_privacy: Database["public"]["Enums"]["visibility_level"];
          push_notification_token: string | null;
          rank_calculator_balance: number;
          reset_persist: boolean;
          theme_preference: string | null;
          trial_end: string | null;
          trial_start: string | null;
          updated_at: string;
          weight_preference: Database["public"]["Enums"]["unit_type"] | null;
        };
        Insert: {
          age?: number | null;
          beta_offer_claimed?: Database["public"]["Enums"]["beta_offer_type"] | null;
          beta_user?: boolean | null;
          deleted?: boolean;
          force_logout?: boolean | null;
          funnel?: string | null;
          gender?: Database["public"]["Enums"]["gender"] | null;
          id: string;
          is_premium?: boolean | null;
          last_workout_timestamp?: string | null;
          notification_enabled?: boolean | null;
          onboard_complete?: boolean;
          onboarding_metadata?: Json | null;
          plan_type?: string | null;
          premium_expires_at?: string | null;
          premium_status?: Database["public"]["Enums"]["premium_status"] | null;
          profile_privacy?: Database["public"]["Enums"]["visibility_level"];
          push_notification_token?: string | null;
          rank_calculator_balance?: number;
          reset_persist?: boolean;
          theme_preference?: string | null;
          trial_end?: string | null;
          trial_start?: string | null;
          updated_at?: string;
          weight_preference?: Database["public"]["Enums"]["unit_type"] | null;
        };
        Update: {
          age?: number | null;
          beta_offer_claimed?: Database["public"]["Enums"]["beta_offer_type"] | null;
          beta_user?: boolean | null;
          deleted?: boolean;
          force_logout?: boolean | null;
          funnel?: string | null;
          gender?: Database["public"]["Enums"]["gender"] | null;
          id?: string;
          is_premium?: boolean | null;
          last_workout_timestamp?: string | null;
          notification_enabled?: boolean | null;
          onboard_complete?: boolean;
          onboarding_metadata?: Json | null;
          plan_type?: string | null;
          premium_expires_at?: string | null;
          premium_status?: Database["public"]["Enums"]["premium_status"] | null;
          profile_privacy?: Database["public"]["Enums"]["visibility_level"];
          push_notification_token?: string | null;
          rank_calculator_balance?: number;
          reset_persist?: boolean;
          theme_preference?: string | null;
          trial_end?: string | null;
          trial_start?: string | null;
          updated_at?: string;
          weight_preference?: Database["public"]["Enums"]["unit_type"] | null;
        };
        Relationships: [];
      };
      workout_notes: {
        Row: {
          created_at: string;
          custom_exercise_id: string | null;
          exercise_id: string | null;
          exercise_key: string;
          id: string;
          note: string;
          note_order: number;
          updated_at: string;
          user_id: string;
          workout_session_id: string | null;
        };
        Insert: {
          created_at?: string;
          custom_exercise_id?: string | null;
          exercise_id?: string | null;
          exercise_key: string;
          id?: string;
          note: string;
          note_order?: number;
          updated_at?: string;
          user_id: string;
          workout_session_id?: string | null;
        };
        Update: {
          created_at?: string;
          custom_exercise_id?: string | null;
          exercise_id?: string | null;
          exercise_key?: string;
          id?: string;
          note?: string;
          note_order?: number;
          updated_at?: string;
          user_id?: string;
          workout_session_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "workout_notes_custom_exercise_id_fkey";
            columns: ["custom_exercise_id"];
            isOneToOne: false;
            referencedRelation: "custom_exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_notes_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_notes_workout_session_id_fkey";
            columns: ["workout_session_id"];
            isOneToOne: false;
            referencedRelation: "workout_sessions";
            referencedColumns: ["id"];
          }
        ];
      };
      workout_plan_changes_staging: {
        Row: {
          data: Json | null;
          entity_id: string;
          entity_type: string;
          operation_type: string;
          parent_id: string | null;
          user_id: string;
        };
        Insert: {
          data?: Json | null;
          entity_id: string;
          entity_type: string;
          operation_type: string;
          parent_id?: string | null;
          user_id: string;
        };
        Update: {
          data?: Json | null;
          entity_id?: string;
          entity_type?: string;
          operation_type?: string;
          parent_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      workout_plan_day_exercise_sets: {
        Row: {
          created_at: string;
          id: string;
          is_amrap: boolean | null;
          max_reps: number | null;
          min_reps: number | null;
          rest_seconds: number | null;
          set_order: number;
          target_rep_increase: number | null;
          target_weight: number | null;
          target_weight_increase: number | null;
          updated_at: string;
          workout_plan_exercise_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_amrap?: boolean | null;
          max_reps?: number | null;
          min_reps?: number | null;
          rest_seconds?: number | null;
          set_order: number;
          target_rep_increase?: number | null;
          target_weight?: number | null;
          target_weight_increase?: number | null;
          updated_at?: string;
          workout_plan_exercise_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_amrap?: boolean | null;
          max_reps?: number | null;
          min_reps?: number | null;
          rest_seconds?: number | null;
          set_order?: number;
          target_rep_increase?: number | null;
          target_weight?: number | null;
          target_weight_increase?: number | null;
          updated_at?: string;
          workout_plan_exercise_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_plan_day_exercise_sets_workout_plan_exercise_id_fkey";
            columns: ["workout_plan_exercise_id"];
            isOneToOne: false;
            referencedRelation: "workout_plan_day_exercises";
            referencedColumns: ["id"];
          }
        ];
      };
      workout_plan_day_exercises: {
        Row: {
          auto_progression_enabled: boolean | null;
          created_at: string;
          custom_exercise_id: string | null;
          deleted: boolean;
          edit_sets_individually: boolean | null;
          exercise_id: string | null;
          exercise_order: number;
          id: string;
          post_exercise_rest_seconds: number | null;
          rest_timer_enabled: boolean | null;
          rest_timer_seconds: number | null;
          updated_at: string;
          warmup_sets_enabled: boolean | null;
          workout_plan_day_id: string;
        };
        Insert: {
          auto_progression_enabled?: boolean | null;
          created_at?: string;
          custom_exercise_id?: string | null;
          deleted?: boolean;
          edit_sets_individually?: boolean | null;
          exercise_id?: string | null;
          exercise_order: number;
          id?: string;
          post_exercise_rest_seconds?: number | null;
          rest_timer_enabled?: boolean | null;
          rest_timer_seconds?: number | null;
          updated_at?: string;
          warmup_sets_enabled?: boolean | null;
          workout_plan_day_id: string;
        };
        Update: {
          auto_progression_enabled?: boolean | null;
          created_at?: string;
          custom_exercise_id?: string | null;
          deleted?: boolean;
          edit_sets_individually?: boolean | null;
          exercise_id?: string | null;
          exercise_order?: number;
          id?: string;
          post_exercise_rest_seconds?: number | null;
          rest_timer_enabled?: boolean | null;
          rest_timer_seconds?: number | null;
          updated_at?: string;
          warmup_sets_enabled?: boolean | null;
          workout_plan_day_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_plan_day_exercises_custom_exercise_id_fkey";
            columns: ["custom_exercise_id"];
            isOneToOne: false;
            referencedRelation: "custom_exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_plan_day_exercises_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_plan_day_exercises_workout_plan_day_id_fkey";
            columns: ["workout_plan_day_id"];
            isOneToOne: false;
            referencedRelation: "workout_plan_days";
            referencedColumns: ["id"];
          }
        ];
      };
      workout_plan_days: {
        Row: {
          created_at: string;
          day_name: string;
          day_order: number;
          deleted: boolean;
          description: string | null;
          id: string;
          updated_at: string;
          workout_plan_id: string;
        };
        Insert: {
          created_at?: string;
          day_name: string;
          day_order: number;
          deleted?: boolean;
          description?: string | null;
          id?: string;
          updated_at?: string;
          workout_plan_id: string;
        };
        Update: {
          created_at?: string;
          day_name?: string;
          day_order?: number;
          deleted?: boolean;
          description?: string | null;
          id?: string;
          updated_at?: string;
          workout_plan_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_plan_days_workout_plan_id_fkey";
            columns: ["workout_plan_id"];
            isOneToOne: false;
            referencedRelation: "workout_plans";
            referencedColumns: ["id"];
          }
        ];
      };
      workout_plans: {
        Row: {
          admin_plan: boolean;
          approximate_workout_minutes: number | null;
          created_at: string;
          created_by: string | null;
          days_per_week: number | null;
          deleted: boolean;
          description: string | null;
          goal: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          parent_plan_id: string | null;
          plan_type: string | null;
          public: boolean;
          recommended_week_duration: number | null;
          source_description: string | null;
          start_date: string | null;
          updated_at: string;
          user_id: string | null;
          visibility_setting: Database["public"]["Enums"]["visibility_level"];
        };
        Insert: {
          admin_plan?: boolean;
          approximate_workout_minutes?: number | null;
          created_at?: string;
          created_by?: string | null;
          days_per_week?: number | null;
          deleted?: boolean;
          description?: string | null;
          goal?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          parent_plan_id?: string | null;
          plan_type?: string | null;
          public?: boolean;
          recommended_week_duration?: number | null;
          source_description?: string | null;
          start_date?: string | null;
          updated_at?: string;
          user_id?: string | null;
          visibility_setting?: Database["public"]["Enums"]["visibility_level"];
        };
        Update: {
          admin_plan?: boolean;
          approximate_workout_minutes?: number | null;
          created_at?: string;
          created_by?: string | null;
          days_per_week?: number | null;
          deleted?: boolean;
          description?: string | null;
          goal?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          parent_plan_id?: string | null;
          plan_type?: string | null;
          public?: boolean;
          recommended_week_duration?: number | null;
          source_description?: string | null;
          start_date?: string | null;
          updated_at?: string;
          user_id?: string | null;
          visibility_setting?: Database["public"]["Enums"]["visibility_level"];
        };
        Relationships: [
          {
            foreignKeyName: "workout_plans_parent_plan_id_fkey";
            columns: ["parent_plan_id"];
            isOneToOne: false;
            referencedRelation: "workout_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_plans_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      workout_session_sets: {
        Row: {
          actual_reps: number | null;
          actual_weight_kg: number | null;
          calculated_1rm: number | null;
          calculated_swr: number | null;
          custom_exercise_id: string | null;
          deleted: boolean;
          exercise_id: string | null;
          id: string;
          is_amrap: boolean | null;
          is_min_success: boolean | null;
          is_success: boolean | null;
          is_warmup: boolean | null;
          performed_at: string;
          planned_max_reps: number | null;
          planned_min_reps: number | null;
          planned_weight_kg: number | null;
          rest_seconds_taken: number | null;
          set_order: number;
          updated_at: string;
          workout_plan_day_exercise_sets_id: string | null;
          workout_session_id: string;
        };
        Insert: {
          actual_reps?: number | null;
          actual_weight_kg?: number | null;
          calculated_1rm?: number | null;
          calculated_swr?: number | null;
          custom_exercise_id?: string | null;
          deleted?: boolean;
          exercise_id?: string | null;
          id?: string;
          is_amrap?: boolean | null;
          is_min_success?: boolean | null;
          is_success?: boolean | null;
          is_warmup?: boolean | null;
          performed_at?: string;
          planned_max_reps?: number | null;
          planned_min_reps?: number | null;
          planned_weight_kg?: number | null;
          rest_seconds_taken?: number | null;
          set_order: number;
          updated_at?: string;
          workout_plan_day_exercise_sets_id?: string | null;
          workout_session_id: string;
        };
        Update: {
          actual_reps?: number | null;
          actual_weight_kg?: number | null;
          calculated_1rm?: number | null;
          calculated_swr?: number | null;
          custom_exercise_id?: string | null;
          deleted?: boolean;
          exercise_id?: string | null;
          id?: string;
          is_amrap?: boolean | null;
          is_min_success?: boolean | null;
          is_success?: boolean | null;
          is_warmup?: boolean | null;
          performed_at?: string;
          planned_max_reps?: number | null;
          planned_min_reps?: number | null;
          planned_weight_kg?: number | null;
          rest_seconds_taken?: number | null;
          set_order?: number;
          updated_at?: string;
          workout_plan_day_exercise_sets_id?: string | null;
          workout_session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_session_sets_custom_exercise_id_fkey";
            columns: ["custom_exercise_id"];
            isOneToOne: false;
            referencedRelation: "custom_exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_session_sets_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_session_sets_workout_plan_day_exercise_sets_id_fkey";
            columns: ["workout_plan_day_exercise_sets_id"];
            isOneToOne: false;
            referencedRelation: "workout_plan_day_exercise_sets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_session_sets_workout_session_id_fkey";
            columns: ["workout_session_id"];
            isOneToOne: false;
            referencedRelation: "workout_sessions";
            referencedColumns: ["id"];
          }
        ];
      };
      workout_sessions: {
        Row: {
          completed_at: string | null;
          created_at: string;
          deleted: boolean;
          duration_seconds: number | null;
          exercises_performed_summary: string | null;
          id: string;
          public: boolean;
          session_name: string | null;
          started_at: string;
          status: string;
          total_reps: number | null;
          total_sets: number | null;
          total_volume_kg: number | null;
          updated_at: string;
          user_id: string;
          workout_plan_day_id: string | null;
          workout_plan_id: string | null;
          workout_summary_data: Json | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          deleted?: boolean;
          duration_seconds?: number | null;
          exercises_performed_summary?: string | null;
          id?: string;
          public?: boolean;
          session_name?: string | null;
          started_at?: string;
          status?: string;
          total_reps?: number | null;
          total_sets?: number | null;
          total_volume_kg?: number | null;
          updated_at?: string;
          user_id: string;
          workout_plan_day_id?: string | null;
          workout_plan_id?: string | null;
          workout_summary_data?: Json | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          deleted?: boolean;
          duration_seconds?: number | null;
          exercises_performed_summary?: string | null;
          id?: string;
          public?: boolean;
          session_name?: string | null;
          started_at?: string;
          status?: string;
          total_reps?: number | null;
          total_sets?: number | null;
          total_volume_kg?: number | null;
          updated_at?: string;
          user_id?: string;
          workout_plan_day_id?: string | null;
          workout_plan_id?: string | null;
          workout_summary_data?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "workout_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_sessions_workout_plan_day_id_fkey";
            columns: ["workout_plan_day_id"];
            isOneToOne: false;
            referencedRelation: "workout_plan_days";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_sessions_workout_plan_id_fkey";
            columns: ["workout_plan_id"];
            isOneToOne: false;
            referencedRelation: "workout_plans";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      global_exercise_leaderboard: {
        Row: {
          avatar_url: string | null;
          bodyweight_kg: number | null;
          display_name: string | null;
          estimated_1rm: number | null;
          exercise_id: string | null;
          leaderboard_position: number | null;
          leaderboard_score: number | null;
          reps: number | null;
          swr: number | null;
          user_id: string | null;
          username: string | null;
          weight_kg: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_exercise_ranks_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_exercise_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      global_leaderboard: {
        Row: {
          avatar_url: string | null;
          display_name: string | null;
          leaderboard_inter_rank_id: number | null;
          leaderboard_position: number | null;
          leaderboard_rank_id: number | null;
          leaderboard_score: number | null;
          user_id: string | null;
          username: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_ranks_leaderboard_inter_rank_id_fkey";
            columns: ["leaderboard_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_ranks_leaderboard_rank_id_fkey";
            columns: ["leaderboard_rank_id"];
            isOneToOne: false;
            referencedRelation: "ranks";
            referencedColumns: ["id"];
          }
        ];
      };
      global_muscle_group_leaderboard: {
        Row: {
          avatar_url: string | null;
          display_name: string | null;
          leaderboard_position: number | null;
          leaderboard_score: number | null;
          muscle_group_id: string | null;
          user_id: string | null;
          username: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_muscle_group";
            columns: ["muscle_group_id"];
            isOneToOne: false;
            referencedRelation: "muscle_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_group_ranks_muscle_group_id_fkey";
            columns: ["muscle_group_id"];
            isOneToOne: false;
            referencedRelation: "muscle_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_group_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "global_leaderboard";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "muscle_group_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_group_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "v_global_leaderboard_with_change";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "muscle_group_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "v_user_profile_full";
            referencedColumns: ["user_id"];
          }
        ];
      };
      global_muscle_leaderboard: {
        Row: {
          avatar_url: string | null;
          display_name: string | null;
          leaderboard_position: number | null;
          leaderboard_score: number | null;
          muscle_id: string | null;
          user_id: string | null;
          username: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_muscle";
            columns: ["muscle_id"];
            isOneToOne: false;
            referencedRelation: "muscles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_ranks_muscle_id_fkey";
            columns: ["muscle_id"];
            isOneToOne: false;
            referencedRelation: "muscles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "global_leaderboard";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "muscle_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "v_global_leaderboard_with_change";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "muscle_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "v_user_profile_full";
            referencedColumns: ["user_id"];
          }
        ];
      };
      v_global_exercise_leaderboard_with_change: {
        Row: {
          avatar_url: string | null;
          bodyweight_kg: number | null;
          display_name: string | null;
          estimated_1rm: number | null;
          exercise_id: string | null;
          inter_rank_name: string | null;
          leaderboard_position: number | null;
          leaderboard_position_change: number | null;
          leaderboard_score: number | null;
          rank_name: string | null;
          reps: number | null;
          swr: number | null;
          user_id: string | null;
          username: string | null;
          weight_kg: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_exercise_ranks_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_exercise_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      v_global_leaderboard_with_change: {
        Row: {
          avatar_url: string | null;
          display_name: string | null;
          inter_rank_name: string | null;
          leaderboard_inter_rank_id: number | null;
          leaderboard_position: number | null;
          leaderboard_position_change: number | null;
          leaderboard_rank_id: number | null;
          leaderboard_score: number | null;
          rank_name: string | null;
          user_id: string | null;
          username: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_ranks_leaderboard_inter_rank_id_fkey";
            columns: ["leaderboard_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_ranks_leaderboard_rank_id_fkey";
            columns: ["leaderboard_rank_id"];
            isOneToOne: false;
            referencedRelation: "ranks";
            referencedColumns: ["id"];
          }
        ];
      };
      v_global_muscle_group_leaderboard_with_change: {
        Row: {
          avatar_url: string | null;
          display_name: string | null;
          inter_rank_name: string | null;
          leaderboard_position: number | null;
          leaderboard_position_change: number | null;
          leaderboard_score: number | null;
          muscle_group_id: string | null;
          muscle_group_name: string | null;
          rank_name: string | null;
          user_id: string | null;
          username: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_muscle_group";
            columns: ["muscle_group_id"];
            isOneToOne: false;
            referencedRelation: "muscle_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_group_ranks_muscle_group_id_fkey";
            columns: ["muscle_group_id"];
            isOneToOne: false;
            referencedRelation: "muscle_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_group_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "global_leaderboard";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "muscle_group_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_group_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "v_global_leaderboard_with_change";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "muscle_group_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "v_user_profile_full";
            referencedColumns: ["user_id"];
          }
        ];
      };
      v_global_muscle_leaderboard_with_change: {
        Row: {
          avatar_url: string | null;
          display_name: string | null;
          inter_rank_name: string | null;
          leaderboard_position: number | null;
          leaderboard_position_change: number | null;
          leaderboard_score: number | null;
          muscle_id: string | null;
          muscle_name: string | null;
          rank_name: string | null;
          user_id: string | null;
          username: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_muscle";
            columns: ["muscle_id"];
            isOneToOne: false;
            referencedRelation: "muscles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_ranks_muscle_id_fkey";
            columns: ["muscle_id"];
            isOneToOne: false;
            referencedRelation: "muscles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "global_leaderboard";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "muscle_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "muscle_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "v_global_leaderboard_with_change";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "muscle_ranks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "v_user_profile_full";
            referencedColumns: ["user_id"];
          }
        ];
      };
      v_user_profile_full: {
        Row: {
          avatar_blurhash: string | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string | null;
          display_name: string | null;
          is_premium: boolean | null;
          leaderboard_inter_rank_id: number | null;
          leaderboard_inter_rank_name: string | null;
          leaderboard_position: number | null;
          leaderboard_position_change: number | null;
          leaderboard_rank_name: string | null;
          leaderboard_score: number | null;
          permanent_inter_rank_id: number | null;
          permanent_inter_rank_name: string | null;
          permanent_rank_name: string | null;
          permanent_score: number | null;
          user_id: string | null;
          user_leaderboard_rank_id: number | null;
          user_permanent_rank_id: number | null;
          username: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_ranks_leaderboard_inter_rank_id_fkey";
            columns: ["leaderboard_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_ranks_leaderboard_rank_id_fkey";
            columns: ["user_leaderboard_rank_id"];
            isOneToOne: false;
            referencedRelation: "ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_ranks_permanent_inter_rank_id_fkey";
            columns: ["permanent_inter_rank_id"];
            isOneToOne: false;
            referencedRelation: "inter_ranks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_ranks_rank_id_fkey";
            columns: ["user_permanent_rank_id"];
            isOneToOne: false;
            referencedRelation: "ranks";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Functions: {
      activate_workout_plan: {
        Args: { p_plan_id: string; p_user_id: string };
        Returns: string;
      };
      add_xp: {
        Args: { p_source?: string; p_user_id: string; p_xp_to_add: number };
        Returns: Json;
      };
      bulk_update_ranks: {
        Args: {
          p_muscle_group_rank_updates?: Database["public"]["CompositeTypes"]["muscle_group_rank_update"][];
          p_muscle_rank_updates?: Database["public"]["CompositeTypes"]["muscle_rank_update"][];
          p_user_exercise_rank_updates?: Database["public"]["CompositeTypes"]["user_exercise_rank_update"][];
          p_user_rank_update?: Database["public"]["CompositeTypes"]["user_rank_update"];
        };
        Returns: undefined;
      };
      can_view_user_info: { Args: { p_user_id: string }; Returns: boolean };
      can_view_workout_plan: { Args: { p_plan_id: string }; Returns: boolean };
      check_and_break_streaks: { Args: never; Returns: undefined };
      check_cycle_completion: {
        Args: { p_plan_id: string; p_user_id: string };
        Returns: boolean;
      };
      check_requirements_met: {
        Args: { p_progress: Json; p_requirements: Json };
        Returns: boolean;
      };
      claim_quest_reward: {
        Args: { p_quest_id: string; p_user_id: string };
        Returns: Json;
      };
      claim_streak_reward: {
        Args: { p_streak_reward_id: string; p_user_id: string };
        Returns: Json;
      };
      clone_custom_exercise: {
        Args: { source_exercise_id: string; target_user_id: string };
        Returns: undefined;
      };
      clone_custom_exercises_from_plan: {
        Args: { p_user_id: string; source_plan_id: string };
        Returns: undefined;
      };
      clone_user_workout_plan: {
        Args: { target_user_id_input: string; template_plan_id_input: string };
        Returns: string;
      };
      clone_workout_plan: {
        Args: { p_source_plan_id: string; p_user_id: string };
        Returns: string;
      };
      create_custom_exercise: { Args: { exercise_data: Json }; Returns: Json };
      create_workout_plan: { Args: never; Returns: string };
      deactivate_expired_premium_users: { Args: never; Returns: undefined };
      filter_user_exercise_ranks: {
        Args: {
          p_exercise_types?: string[];
          p_muscle_ids?: string[];
          p_rank_ids?: string[];
          p_search_term?: string;
          p_sort_by?: string;
          p_user_id: string;
        };
        Returns: {
          bodyweight_kg: number | null;
          created_at: string | null;
          estimated_1rm: number | null;
          exercise_id: string;
          id: string;
          last_calculated_at: string | null;
          leaderboard_inter_rank_id: number | null;
          leaderboard_position: number | null;
          leaderboard_position_change: number | null;
          leaderboard_rank_id: number | null;
          leaderboard_score: number | null;
          permanent_inter_rank_id: number | null;
          permanent_rank_id: number | null;
          permanent_score: number | null;
          reps: number | null;
          session_set_id: string | null;
          swr: number | null;
          updated_at: string | null;
          user_id: string;
          weight_kg: number | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "user_exercise_ranks";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_alternate_exercises: {
        Args: { p_exercise_id: string };
        Returns: {
          exercise: Json;
        }[];
      };
      get_exercises_full: {
        Args: { exercise_ids?: string[]; user_id_param?: string };
        Returns: {
          exercise: Json;
        }[];
      };
      get_last_exercise_performance_sets: {
        Args: { p_exercise_id: string; p_user_id: string };
        Returns: {
          actual_reps: number | null;
          actual_weight_kg: number | null;
          calculated_1rm: number | null;
          calculated_swr: number | null;
          custom_exercise_id: string | null;
          deleted: boolean;
          exercise_id: string | null;
          id: string;
          is_amrap: boolean | null;
          is_min_success: boolean | null;
          is_success: boolean | null;
          is_warmup: boolean | null;
          performed_at: string;
          planned_max_reps: number | null;
          planned_min_reps: number | null;
          planned_weight_kg: number | null;
          rest_seconds_taken: number | null;
          set_order: number;
          updated_at: string;
          workout_plan_day_exercise_sets_id: string | null;
          workout_session_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "workout_session_sets";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_workout_plans_full: {
        Args: {
          p_plan_ids?: string[];
          p_plan_type?: string;
          p_user_id?: string;
        };
        Returns: {
          plan: Json;
        }[];
      };
      initialize_user_muscle_groups: {
        Args: { new_user_id: string };
        Returns: undefined;
      };
      is_friend: {
        Args: { user1_id: string; user2_id: string };
        Returns: boolean;
      };
      is_plan_day_owner: { Args: { plan_day_id: string }; Returns: boolean };
      is_plan_exercise_owner: {
        Args: { plan_exercise_id: string };
        Returns: boolean;
      };
      is_set_log_owner: { Args: { set_log_id: string }; Returns: boolean };
      mark_all_pending_as_failed: { Args: never; Returns: undefined };
      process_pending_notifications: { Args: never; Returns: undefined };
      process_user_action: {
        Args: {
          p_action_type: Database["public"]["Enums"]["gamification_action"];
          p_payload?: Json;
        };
        Returns: Database["public"]["CompositeTypes"]["gamification_response"];
        SetofOptions: {
          from: "*";
          to: "gamification_response";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      recalculate_all_muscle_stats: {
        Args: { target_user_id: string };
        Returns: undefined;
      };
      refresh_workout_streak: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      renew_streak: { Args: { p_user_id: string }; Returns: boolean };
      save_workout_plan_changes: { Args: { p_changes: Json }; Returns: string };
      search_exercises:
        | {
            Args: {
              equipment_ids_param: string[];
              exercise_types_param: string[];
              limit_param?: number;
              muscle_ids_param: string[];
              name_param: string;
              offset_param?: number;
              user_id_param?: string;
            };
            Returns: {
              exercise: Json;
            }[];
          }
        | {
            Args: {
              equipment_ids_param: string[];
              exercise_types_param: string[];
              favorites_only_param?: boolean;
              limit_param?: number;
              muscle_ids_param: string[];
              name_param: string;
              offset_param?: number;
              user_id_param?: string;
            };
            Returns: {
              exercise: Json;
            }[];
          };
      search_workout_plans: {
        Args: {
          p_days_per_week_param?: number;
          p_limit_param?: number;
          p_name_param: string;
          p_offset_param?: number;
        };
        Returns: {
          plan: Json;
        }[];
      };
      send_trial_ending_notifications: { Args: never; Returns: undefined };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
      update_leaderboard_data_and_refresh_views: {
        Args: never;
        Returns: undefined;
      };
      update_premium_status: {
        Args: { is_premium_param: boolean; user_id_param: string };
        Returns: undefined;
      };
    };
    Enums: {
      banner_platform: "all" | "ios" | "android";
      banner_type: "landing_page" | "unskippable" | "dashboard";
      banner_user_group: "all" | "beta" | "non_beta";
      beta_offer_type: "monthly" | "trial6m" | "annual";
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
        | "calf_right";
      enum_body_side: "left" | "right" | "center" | "front" | "back";
      equipment_type:
        | "FreeWeights"
        | "Machines"
        | "BenchesAndRacks"
        | "BarsAndAttachments"
        | "BandsAndTubes"
        | "BodyweightAssistTools"
        | "Cardio"
        | "RehabAndMobility"
        | "SpecialtyStrength"
        | "Other";
      exercise_type:
        | "cardio"
        | "N/A"
        | "body_weight"
        | "free_weights"
        | "barbell"
        | "calisthenics"
        | "machine"
        | "assisted_body_weight"
        | "weighted_body_weight";
      feed_post_type: "workout" | "workout_with_pr" | "workout_with_rankup";
      feedback_type:
        | "default_feedback"
        | "exercise_request"
        | "thumbs_up"
        | "thumbs_down"
        | "premium_cancelled_feedback"
        | "uninstall_support"
        | "winback_offer";
      friendship_status: "pending" | "accepted" | "blocked";
      gamification_action:
        | "set_profile_picture"
        | "enable_notifications"
        | "purchase_premium"
        | "update_body_weight"
        | "add_friend"
        | "refer_friend"
        | "share_rank_card"
        | "share_workout"
        | "view_profile"
        | "create_workout_plan"
        | "open_app"
        | "view_leaderboard"
        | "view_social_media"
        | "log_rank_calculation";
      gender: "male" | "female" | "other";
      meal_type: "breakfast" | "lunch" | "dinner" | "snack";
      movement_types:
        | "horizontal_push"
        | "vertical_push"
        | "horizontal_pull"
        | "vertical_pull"
        | "squat"
        | "hinge"
        | "core";
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
        | "FrontRightFoot";
      muscle_intensity: "primary" | "secondary" | "accessory";
      muscle_rank: "Neophyte" | "Adept" | "Vanguard" | "Elite" | "Master" | "Champion" | "Legend";
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
        | "FrontLeftHead";
      notification_status: "pending" | "sent" | "failed" | "processing" | "cancelled";
      notification_type:
        | "friend_request_received"
        | "friend_request_accepted"
        | "friendship_removed"
        | "new_feed_item"
        | "new_workout_session"
        | "leaderboard_change"
        | "feed_reaction"
        | "feed_comment"
        | "system_message"
        | "trial_ending"
        | "premium_ending"
        | "premium_cancelled";
      pr_type: "one_rep_max" | "max_reps" | "max_swr";
      premium_status: "active" | "trial" | "cancelled" | "expired" | "billing_issue";
      primary_group_enum: "arms" | "legs" | "back" | "chest" | "abs";
      processing_status: "processing" | "success" | "failed";
      quest_status: "in_progress" | "completed";
      quest_type: "STARTER" | "SEASONAL" | "DEFAULT";
      rank_label: "F" | "E" | "D" | "C" | "B" | "A" | "S" | "Elite";
      session_status:
        | "active"
        | "paused"
        | "completed"
        | "skipped"
        | "cancelled"
        | "error"
        | "pending"
        | "no_plan"
        | "no_workouts";
      unit_type: "metric" | "imperial";
      visibility_level: "public" | "friends_only" | "private";
    };
    CompositeTypes: {
      gamification_response: {
        completed_quests: Json | null;
        unlocked_badges: Json | null;
      };
      muscle_group_rank_update: {
        user_id: string | null;
        muscle_group_id: string | null;
        permanent_rank_id: number | null;
        permanent_inter_rank_id: number | null;
        permanent_score: number | null;
        leaderboard_score: number | null;
        locked: boolean | null;
        leaderboard_rank_id: number | null;
        leaderboard_inter_rank_id: number | null;
        last_calculated_at: string | null;
      };
      muscle_rank_update: {
        user_id: string | null;
        muscle_id: string | null;
        permanent_rank_id: number | null;
        permanent_inter_rank_id: number | null;
        permanent_score: number | null;
        leaderboard_score: number | null;
        locked: boolean | null;
        leaderboard_rank_id: number | null;
        leaderboard_inter_rank_id: number | null;
        last_calculated_at: string | null;
      };
      user_exercise_rank_update: {
        user_id: string | null;
        exercise_id: string | null;
        permanent_rank_id: number | null;
        permanent_inter_rank_id: number | null;
        permanent_score: number | null;
        leaderboard_score: number | null;
        leaderboard_rank_id: number | null;
        leaderboard_inter_rank_id: number | null;
        weight_kg: number | null;
        reps: number | null;
        bodyweight_kg: number | null;
        estimated_1rm: number | null;
        swr: number | null;
        session_set_id: string | null;
        last_calculated_at: string | null;
      };
      user_rank_update: {
        user_id: string | null;
        permanent_rank_id: number | null;
        permanent_inter_rank_id: number | null;
        permanent_score: number | null;
        leaderboard_score: number | null;
        leaderboard_rank_id: number | null;
        leaderboard_inter_rank_id: number | null;
        last_calculated_at: string | null;
      };
    };
  };
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null;
          avif_autodetection: boolean | null;
          created_at: string | null;
          file_size_limit: number | null;
          id: string;
          name: string;
          owner: string | null;
          owner_id: string | null;
          public: boolean | null;
          type: Database["storage"]["Enums"]["buckettype"];
          updated_at: string | null;
        };
        Insert: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id: string;
          name: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string | null;
        };
        Update: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id?: string;
          name?: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string | null;
        };
        Relationships: [];
      };
      buckets_analytics: {
        Row: {
          created_at: string;
          format: string;
          id: string;
          type: Database["storage"]["Enums"]["buckettype"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          format?: string;
          id: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          format?: string;
          id?: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Relationships: [];
      };
      iceberg_namespaces: {
        Row: {
          bucket_id: string;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets_analytics";
            referencedColumns: ["id"];
          }
        ];
      };
      iceberg_tables: {
        Row: {
          bucket_id: string;
          created_at: string;
          id: string;
          location: string;
          name: string;
          namespace_id: string;
          updated_at: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          id?: string;
          location: string;
          name: string;
          namespace_id: string;
          updated_at?: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          id?: string;
          location?: string;
          name?: string;
          namespace_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets_analytics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey";
            columns: ["namespace_id"];
            isOneToOne: false;
            referencedRelation: "iceberg_namespaces";
            referencedColumns: ["id"];
          }
        ];
      };
      migrations: {
        Row: {
          executed_at: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Insert: {
          executed_at?: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Update: {
          executed_at?: string | null;
          hash?: string;
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      objects: {
        Row: {
          bucket_id: string | null;
          created_at: string | null;
          id: string;
          last_accessed_at: string | null;
          level: number | null;
          metadata: Json | null;
          name: string | null;
          owner: string | null;
          owner_id: string | null;
          path_tokens: string[] | null;
          updated_at: string | null;
          user_metadata: Json | null;
          version: string | null;
        };
        Insert: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          level?: number | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Update: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          level?: number | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          }
        ];
      };
      prefixes: {
        Row: {
          bucket_id: string;
          created_at: string | null;
          level: number;
          name: string;
          updated_at: string | null;
        };
        Insert: {
          bucket_id: string;
          created_at?: string | null;
          level?: number;
          name: string;
          updated_at?: string | null;
        };
        Update: {
          bucket_id?: string;
          created_at?: string | null;
          level?: number;
          name?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "prefixes_bucketId_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          }
        ];
      };
      s3_multipart_uploads: {
        Row: {
          bucket_id: string;
          created_at: string;
          id: string;
          in_progress_size: number;
          key: string;
          owner_id: string | null;
          upload_signature: string;
          user_metadata: Json | null;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          id: string;
          in_progress_size?: number;
          key: string;
          owner_id?: string | null;
          upload_signature: string;
          user_metadata?: Json | null;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          id?: string;
          in_progress_size?: number;
          key?: string;
          owner_id?: string | null;
          upload_signature?: string;
          user_metadata?: Json | null;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          }
        ];
      };
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string;
          created_at: string;
          etag: string;
          id: string;
          key: string;
          owner_id: string | null;
          part_number: number;
          size: number;
          upload_id: string;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          etag: string;
          id?: string;
          key: string;
          owner_id?: string | null;
          part_number: number;
          size?: number;
          upload_id: string;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          etag?: string;
          id?: string;
          key?: string;
          owner_id?: string | null;
          part_number?: number;
          size?: number;
          upload_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey";
            columns: ["upload_id"];
            isOneToOne: false;
            referencedRelation: "s3_multipart_uploads";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_prefixes: {
        Args: { _bucket_id: string; _name: string };
        Returns: undefined;
      };
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string };
        Returns: undefined;
      };
      delete_leaf_prefixes: {
        Args: { bucket_ids: string[]; names: string[] };
        Returns: undefined;
      };
      delete_prefix: {
        Args: { _bucket_id: string; _name: string };
        Returns: boolean;
      };
      extension: { Args: { name: string }; Returns: string };
      filename: { Args: { name: string }; Returns: string };
      foldername: { Args: { name: string }; Returns: string[] };
      get_level: { Args: { name: string }; Returns: number };
      get_prefix: { Args: { name: string }; Returns: string };
      get_prefixes: { Args: { name: string }; Returns: string[] };
      get_size_by_bucket: {
        Args: never;
        Returns: {
          bucket_id: string;
          size: number;
        }[];
      };
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string;
          delimiter_param: string;
          max_keys?: number;
          next_key_token?: string;
          next_upload_token?: string;
          prefix_param: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
        }[];
      };
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string;
          delimiter_param: string;
          max_keys?: number;
          next_token?: string;
          prefix_param: string;
          start_after?: string;
        };
        Returns: {
          id: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      lock_top_prefixes: {
        Args: { bucket_ids: string[]; names: string[] };
        Returns: undefined;
      };
      operation: { Args: never; Returns: string };
      search: {
        Args: {
          bucketname: string;
          levels?: number;
          limits?: number;
          offsets?: number;
          prefix: string;
          search?: string;
          sortcolumn?: string;
          sortorder?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      search_legacy_v1: {
        Args: {
          bucketname: string;
          levels?: number;
          limits?: number;
          offsets?: number;
          prefix: string;
          search?: string;
          sortcolumn?: string;
          sortorder?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      search_v1_optimised: {
        Args: {
          bucketname: string;
          levels?: number;
          limits?: number;
          offsets?: number;
          prefix: string;
          search?: string;
          sortcolumn?: string;
          sortorder?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
      search_v2: {
        Args: {
          bucket_name: string;
          levels?: number;
          limits?: number;
          prefix: string;
          sort_column?: string;
          sort_column_after?: string;
          sort_order?: string;
          start_after?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
        }[];
      };
    };
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  graphql: {
    Enums: {},
  },
  public: {
    Enums: {
      banner_platform: ["all", "ios", "android"],
      banner_type: ["landing_page", "unskippable", "dashboard"],
      banner_user_group: ["all", "beta", "non_beta"],
      beta_offer_type: ["monthly", "trial6m", "annual"],
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
      equipment_type: [
        "FreeWeights",
        "Machines",
        "BenchesAndRacks",
        "BarsAndAttachments",
        "BandsAndTubes",
        "BodyweightAssistTools",
        "Cardio",
        "RehabAndMobility",
        "SpecialtyStrength",
        "Other",
      ],
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
      feed_post_type: ["workout", "workout_with_pr", "workout_with_rankup"],
      feedback_type: [
        "default_feedback",
        "exercise_request",
        "thumbs_up",
        "thumbs_down",
        "premium_cancelled_feedback",
        "uninstall_support",
        "winback_offer",
      ],
      friendship_status: ["pending", "accepted", "blocked"],
      gamification_action: [
        "set_profile_picture",
        "enable_notifications",
        "purchase_premium",
        "update_body_weight",
        "add_friend",
        "refer_friend",
        "share_rank_card",
        "share_workout",
        "view_profile",
        "create_workout_plan",
        "open_app",
        "view_leaderboard",
        "view_social_media",
        "log_rank_calculation",
      ],
      gender: ["male", "female", "other"],
      meal_type: ["breakfast", "lunch", "dinner", "snack"],
      movement_types: [
        "horizontal_push",
        "vertical_push",
        "horizontal_pull",
        "vertical_pull",
        "squat",
        "hinge",
        "core",
      ],
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
      muscle_rank: ["Neophyte", "Adept", "Vanguard", "Elite", "Master", "Champion", "Legend"],
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
      notification_status: ["pending", "sent", "failed", "processing", "cancelled"],
      notification_type: [
        "friend_request_received",
        "friend_request_accepted",
        "friendship_removed",
        "new_feed_item",
        "new_workout_session",
        "leaderboard_change",
        "feed_reaction",
        "feed_comment",
        "system_message",
        "trial_ending",
        "premium_ending",
        "premium_cancelled",
      ],
      pr_type: ["one_rep_max", "max_reps", "max_swr"],
      premium_status: ["active", "trial", "cancelled", "expired", "billing_issue"],
      primary_group_enum: ["arms", "legs", "back", "chest", "abs"],
      processing_status: ["processing", "success", "failed"],
      quest_status: ["in_progress", "completed"],
      quest_type: ["STARTER", "SEASONAL", "DEFAULT"],
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
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS"],
    },
  },
} as const;
