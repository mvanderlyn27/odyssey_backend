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
      ai_coach_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_coach_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      body_measurements: {
        Row: {
          body_fat_percentage: number | null
          id: string
          logged_at: string
          other_metrics: Json | null
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          body_fat_percentage?: number | null
          id?: string
          logged_at?: string
          other_metrics?: Json | null
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          body_fat_percentage?: number | null
          id?: string
          logged_at?: string
          other_metrics?: Json | null
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_measurements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          created_at: string
          description: string | null
          difficulty: string | null
          equipment_required: string[] | null
          id: string
          image_url: string | null
          name: string
          primary_muscle_groups: string[] | null
          secondary_muscle_groups: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          difficulty?: string | null
          equipment_required?: string[] | null
          id?: string
          image_url?: string | null
          name: string
          primary_muscle_groups?: string[] | null
          secondary_muscle_groups?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          difficulty?: string | null
          equipment_required?: string[] | null
          id?: string
          image_url?: string | null
          name?: string
          primary_muscle_groups?: string[] | null
          secondary_muscle_groups?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      muscle_groups: {
        Row: {
          created_at: string
          id: string
          muscle_ranking_data: Json | null
          name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          muscle_ranking_data?: Json | null
          name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          muscle_ranking_data?: Json | null
          name?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin: boolean
          avatar_url: string | null
          created_at: string
          current_goal_id: string | null
          experience_points: number
          full_name: string | null
          height_cm: number | null
          id: string
          level: number
          onboarding_complete: boolean | null
          preferred_unit: string | null
          subscription_status: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          admin?: boolean
          avatar_url?: string | null
          created_at?: string
          current_goal_id?: string | null
          experience_points?: number
          full_name?: string | null
          height_cm?: number | null
          id: string
          level?: number
          onboarding_complete?: boolean | null
          preferred_unit?: string | null
          subscription_status?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          admin?: boolean
          avatar_url?: string | null
          created_at?: string
          current_goal_id?: string | null
          experience_points?: number
          full_name?: string | null
          height_cm?: number | null
          id?: string
          level?: number
          onboarding_complete?: boolean | null
          preferred_unit?: string | null
          subscription_status?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_current_goal"
            columns: ["current_goal_id"]
            isOneToOne: false
            referencedRelation: "user_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      session_exercises: {
        Row: {
          difficulty_rating: number | null
          exercise_id: string
          id: string
          logged_at: string
          logged_reps: number
          logged_weight_kg: number
          notes: string | null
          plan_workout_exercise_id: string | null
          set_order: number
          was_successful_for_progression: boolean | null
          workout_session_id: string
        }
        Insert: {
          difficulty_rating?: number | null
          exercise_id: string
          id?: string
          logged_at?: string
          logged_reps: number
          logged_weight_kg: number
          notes?: string | null
          plan_workout_exercise_id?: string | null
          set_order: number
          was_successful_for_progression?: boolean | null
          workout_session_id: string
        }
        Update: {
          difficulty_rating?: number | null
          exercise_id?: string
          id?: string
          logged_at?: string
          logged_reps?: number
          logged_weight_kg?: number
          notes?: string | null
          plan_workout_exercise_id?: string | null
          set_order?: number
          was_successful_for_progression?: boolean | null
          workout_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_plan_workout_exercise_id_fkey"
            columns: ["plan_workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_plan_day_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      streaks: {
        Row: {
          current_streak: number
          id: string
          last_incremented_at: string | null
          longest_streak: number
          streak_type: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          id?: string
          last_incremented_at?: string | null
          longest_streak?: number
          streak_type: string
          user_id: string
        }
        Update: {
          current_streak?: number
          id?: string
          last_incremented_at?: string | null
          longest_streak?: number
          streak_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_equipment: {
        Row: {
          equipment_id: string
          user_id: string
        }
        Insert: {
          equipment_id: string
          user_id: string
        }
        Update: {
          equipment_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_equipment_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_goals: {
        Row: {
          created_at: string
          estimated_completion_date: string | null
          goal_type: string | null
          id: string
          is_active: boolean | null
          start_date: string | null
          target_date: string | null
          target_muscle_kg: number | null
          target_weight_kg: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_completion_date?: string | null
          goal_type?: string | null
          id?: string
          is_active?: boolean | null
          start_date?: string | null
          target_date?: string | null
          target_muscle_kg?: number | null
          target_weight_kg?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_completion_date?: string | null
          goal_type?: string | null
          id?: string
          is_active?: boolean | null
          start_date?: string | null
          target_date?: string | null
          target_muscle_kg?: number | null
          target_weight_kg?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_streaks: {
        Row: {
          created_at: string
          current_streak: number
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
      workout_plan_day_exercises: {
        Row: {
          current_suggested_weight_kg: number | null
          exercise_id: string
          id: string
          on_success_weight_increase_kg: number | null
          order_in_workout: number
          target_reps_max: number | null
          target_reps_min: number
          target_rest_seconds: number | null
          target_sets: number
          workout_plan_day_id: string
        }
        Insert: {
          current_suggested_weight_kg?: number | null
          exercise_id: string
          id?: string
          on_success_weight_increase_kg?: number | null
          order_in_workout: number
          target_reps_max?: number | null
          target_reps_min: number
          target_rest_seconds?: number | null
          target_sets: number
          workout_plan_day_id: string
        }
        Update: {
          current_suggested_weight_kg?: number | null
          exercise_id?: string
          id?: string
          on_success_weight_increase_kg?: number | null
          order_in_workout?: number
          target_reps_max?: number | null
          target_reps_min?: number
          target_rest_seconds?: number | null
          target_sets?: number
          workout_plan_day_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_workout_exercises_plan_workout_id_fkey"
            columns: ["workout_plan_day_id"]
            isOneToOne: false
            referencedRelation: "workout_plan_days"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plan_days: {
        Row: {
          day_of_week: number | null
          focus: string | null
          id: string
          name: string
          order_in_plan: number
          plan_id: string
        }
        Insert: {
          day_of_week?: number | null
          focus?: string | null
          id?: string
          name: string
          order_in_plan: number
          plan_id: string
        }
        Update: {
          day_of_week?: number | null
          focus?: string | null
          id?: string
          name?: string
          order_in_plan?: number
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_workouts_plan_id_fkey"
            columns: ["plan_id"]
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
          description: string | null
          goal_type: string | null
          id: string
          is_active: boolean | null
          name: string
          plan_type: string | null
          recommended_week_duration: number | null
          source_description: string | null
          start_date: string | null
          user_id: string
        }
        Insert: {
          approximate_workout_minutes?: number | null
          created_at?: string
          created_by?: string | null
          days_per_week?: number | null
          description?: string | null
          goal_type?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          plan_type?: string | null
          recommended_week_duration?: number | null
          source_description?: string | null
          start_date?: string | null
          user_id: string
        }
        Update: {
          approximate_workout_minutes?: number | null
          created_at?: string
          created_by?: string | null
          days_per_week?: number | null
          description?: string | null
          goal_type?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          plan_type?: string | null
          recommended_week_duration?: number | null
          source_description?: string | null
          start_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          ended_at: string | null
          id: string
          notes: string | null
          overall_feeling: string | null
          started_at: string
          status: Database["public"]["Enums"]["session_status"] | null
          user_id: string
          workout_plan_day_id: string | null
        }
        Insert: {
          ended_at?: string | null
          id?: string
          notes?: string | null
          overall_feeling?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"] | null
          user_id: string
          workout_plan_day_id?: string | null
        }
        Update: {
          ended_at?: string | null
          id?: string
          notes?: string | null
          overall_feeling?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"] | null
          user_id?: string
          workout_plan_day_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_plan_workout_id_fkey"
            columns: ["workout_plan_day_id"]
            isOneToOne: false
            referencedRelation: "workout_plan_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      create_generated_plan: {
        Args: { user_id_input: string; plan_data: Json }
        Returns: {
          approximate_workout_minutes: number | null
          created_at: string
          created_by: string | null
          days_per_week: number | null
          description: string | null
          goal_type: string | null
          id: string
          is_active: boolean | null
          name: string
          plan_type: string | null
          recommended_week_duration: number | null
          source_description: string | null
          start_date: string | null
          user_id: string
        }
      }
      create_imported_plan: {
        Args: { user_id_input: string; plan_data: Json }
        Returns: {
          approximate_workout_minutes: number | null
          created_at: string
          created_by: string | null
          days_per_week: number | null
          description: string | null
          goal_type: string | null
          id: string
          is_active: boolean | null
          name: string
          plan_type: string | null
          recommended_week_duration: number | null
          source_description: string | null
          start_date: string | null
          user_id: string
        }
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
    }
    Enums: {
      meal_type: "breakfast" | "lunch" | "dinner" | "snack"
      session_status:
        | "active"
        | "paused"
        | "completed"
        | "skipped"
        | "cancelled"
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
      session_status: ["active", "paused", "completed", "skipped", "cancelled"],
    },
  },
} as const
