export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
            referencedRelation: "user_profiles"
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
      exercise_muscle_groups: {
        Row: {
          created_at: string
          deleted: boolean
          exercise_id: string
          id: string
          intensity: string | null
          muscle_group_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted?: boolean
          exercise_id: string
          id?: string
          intensity?: string | null
          muscle_group_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted?: boolean
          exercise_id?: string
          id?: string
          intensity?: string | null
          muscle_group_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_muscle_groups_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_muscle_groups_muscle_group_id_fkey"
            columns: ["muscle_group_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          deleted: boolean
          description: string | null
          difficulty: string | null
          id: string
          instructions: string | null
          is_public: boolean | null
          name: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          deleted?: boolean
          description?: string | null
          difficulty?: string | null
          id?: string
          instructions?: string | null
          is_public?: boolean | null
          name: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          deleted?: boolean
          description?: string | null
          difficulty?: string | null
          id?: string
          instructions?: string | null
          is_public?: boolean | null
          name?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      muscle_groups: {
        Row: {
          created_at: string
          deleted: boolean
          description: string | null
          id: string
          image_url: string | null
          name: string
          parent_muscle_group_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted?: boolean
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          parent_muscle_group_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted?: boolean
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          parent_muscle_group_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "muscle_groups_parent_muscle_group_id_fkey"
            columns: ["parent_muscle_group_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_exercise_prs: {
        Row: {
          achieved_at: string
          created_at: string
          deleted: boolean
          exercise_id: string
          id: string
          pr_type: string
          pr_value: number
          updated_at: string
          user_id: string
          workout_session_set_id: string | null
        }
        Insert: {
          achieved_at: string
          created_at?: string
          deleted?: boolean
          exercise_id: string
          id?: string
          pr_type: string
          pr_value: number
          updated_at?: string
          user_id: string
          workout_session_set_id?: string | null
        }
        Update: {
          achieved_at?: string
          created_at?: string
          deleted?: boolean
          exercise_id?: string
          id?: string
          pr_type?: string
          pr_value?: number
          updated_at?: string
          user_id?: string
          workout_session_set_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_exercise_prs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_exercise_prs_workout_session_set_id_fkey"
            columns: ["workout_session_set_id"]
            isOneToOne: false
            referencedRelation: "workout_session_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_muscle_last_worked: {
        Row: {
          deleted: boolean
          id: string
          last_worked_date: string
          muscle_group_id: string
          total_sets_last_session: number | null
          total_volume_last_session: number | null
          updated_at: string
          user_id: string
          workout_session_id: string | null
        }
        Insert: {
          deleted?: boolean
          id?: string
          last_worked_date: string
          muscle_group_id: string
          total_sets_last_session?: number | null
          total_volume_last_session?: number | null
          updated_at?: string
          user_id: string
          workout_session_id?: string | null
        }
        Update: {
          deleted?: boolean
          id?: string
          last_worked_date?: string
          muscle_group_id?: string
          total_sets_last_session?: number | null
          total_volume_last_session?: number | null
          updated_at?: string
          user_id?: string
          workout_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_muscle_last_worked_muscle_group_id_fkey"
            columns: ["muscle_group_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
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
      user_muscle_ranks: {
        Row: {
          deleted: boolean
          id: string
          muscle_group_id: string
          muscle_rank: string
          total_sets_last_session: number | null
          total_volume_last_session: number | null
          updated_at: string
          user_id: string
          workout_session_id: string | null
        }
        Insert: {
          deleted?: boolean
          id?: string
          muscle_group_id: string
          muscle_rank: string
          total_sets_last_session?: number | null
          total_volume_last_session?: number | null
          updated_at?: string
          user_id: string
          workout_session_id?: string | null
        }
        Update: {
          deleted?: boolean
          id?: string
          muscle_group_id?: string
          muscle_rank?: string
          total_sets_last_session?: number | null
          total_volume_last_session?: number | null
          updated_at?: string
          user_id?: string
          workout_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_muscle_ranks_muscle_group_id_fkey"
            columns: ["muscle_group_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_muscle_ranks_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          age: number | null
          avatar_url: string | null
          created_at: string
          deleted: boolean
          experience_points: number
          full_name: string | null
          gender: string | null
          id: string
          onboard_complete: boolean
          theme_preference: string | null
          updated_at: string
          username: string | null
          weight_preference: Database["public"]["Enums"]["unit_type"]
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string
          deleted?: boolean
          experience_points?: number
          full_name?: string | null
          gender?: string | null
          id: string
          onboard_complete?: boolean
          theme_preference?: string | null
          updated_at?: string
          username?: string | null
          weight_preference?: Database["public"]["Enums"]["unit_type"]
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          created_at?: string
          deleted?: boolean
          experience_points?: number
          full_name?: string | null
          gender?: string | null
          id?: string
          onboard_complete?: boolean
          theme_preference?: string | null
          updated_at?: string
          username?: string | null
          weight_preference?: Database["public"]["Enums"]["unit_type"]
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          created_at: string
          current_streak: number
          deleted: boolean
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
          last_paid_recovery_at?: string | null
          last_streak_activity_date?: string | null
          longest_streak?: number
          streak_broken_at?: string | null
          streak_recovered_at?: string | null
          streak_value_before_break?: number | null
          updated_at?: string
          user_id?: string
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
          target_reps_text: string | null
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
          target_reps_text?: string | null
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
          target_reps_text?: string | null
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
          recommended_week_duration: number | null
          source_description: string | null
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
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
          recommended_week_duration?: number | null
          source_description?: string | null
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
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
          recommended_week_duration?: number | null
          source_description?: string | null
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_session_sets: {
        Row: {
          actual_reps: number | null
          actual_weight_kg: number | null
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
          workout_session_id: string
        }
        Insert: {
          actual_reps?: number | null
          actual_weight_kg?: number | null
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
          workout_session_id: string
        }
        Update: {
          actual_reps?: number | null
          actual_weight_kg?: number | null
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
          id: string
          notes: string | null
          session_name: string | null
          started_at: string
          status: string
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
          id?: string
          notes?: string | null
          session_name?: string | null
          started_at?: string
          status?: string
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
          id?: string
          notes?: string | null
          session_name?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
          workout_plan_day_id?: string | null
          workout_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_user_id_fkey1"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
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
      [_ in never]: never
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
      initialize_user_muscle_groups: {
        Args: { new_user_id: string }
        Returns: undefined
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
      meal_type: "breakfast" | "lunch" | "dinner" | "snack"
      muscle_rank:
        | "Neophyte"
        | "Adept"
        | "Vanguard"
        | "Elite"
        | "Master"
        | "Champion"
        | "Legend"
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
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      meal_type: ["breakfast", "lunch", "dinner", "snack"],
      muscle_rank: [
        "Neophyte",
        "Adept",
        "Vanguard",
        "Elite",
        "Master",
        "Champion",
        "Legend",
      ],
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
    },
  },
} as const
