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
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      exercises_library: {
        Row: {
          created_at: string
          description: string | null
          equipment_required: string[]
          id: string
          muscle_groups: string[] | null
          name: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          equipment_required: string[]
          id?: string
          muscle_groups?: string[] | null
          name: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          equipment_required?: string[]
          id?: string
          muscle_groups?: string[] | null
          name?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      meal_logs: {
        Row: {
          calories: number
          carbs_g: number
          created_at: string
          date: string
          description: string | null
          fat_g: number
          id: string
          meal_plan_id: string | null
          meal_type: Database["public"]["Enums"]["meal_type"]
          protein_g: number
          updated_at: string
          user_id: string
        }
        Insert: {
          calories: number
          carbs_g: number
          created_at?: string
          date?: string
          description?: string | null
          fat_g: number
          id?: string
          meal_plan_id?: string | null
          meal_type: Database["public"]["Enums"]["meal_type"]
          protein_g: number
          updated_at?: string
          user_id: string
        }
        Update: {
          calories?: number
          carbs_g?: number
          created_at?: string
          date?: string
          description?: string | null
          fat_g?: number
          id?: string
          meal_plan_id?: string | null
          meal_type?: Database["public"]["Enums"]["meal_type"]
          protein_g?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_logs_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          target_calories: number | null
          target_carbs_g: number | null
          target_fat_g: number | null
          target_protein_g: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          target_calories?: number | null
          target_carbs_g?: number | null
          target_fat_g?: number | null
          target_protein_g?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          target_calories?: number | null
          target_carbs_g?: number | null
          target_fat_g?: number | null
          target_protein_g?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_days: {
        Row: {
          created_at: string
          day_number: number
          id: string
          name: string | null
          plan_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_number: number
          id?: string
          name?: string | null
          plan_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_number?: number
          id?: string
          name?: string | null
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_exercises: {
        Row: {
          created_at: string
          display_order: number
          exercise_library_id: string
          id: string
          notes: string | null
          plan_day_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order: number
          exercise_library_id: string
          id?: string
          notes?: string | null
          plan_day_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          exercise_library_id?: string
          id?: string
          notes?: string | null
          plan_day_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_exercises_exercise_library_id_fkey"
            columns: ["exercise_library_id"]
            isOneToOne: false
            referencedRelation: "exercises_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_exercises_plan_day_id_fkey"
            columns: ["plan_day_id"]
            isOneToOne: false
            referencedRelation: "plan_days"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_sets: {
        Row: {
          created_at: string
          current_target_weight: number | null
          id: string
          plan_exercise_id: string
          rep_max: number | null
          rep_min: number | null
          rest_seconds: number | null
          set_number: number
          target_reps_text: string | null
          updated_at: string
          weight_progression_amount: number
        }
        Insert: {
          created_at?: string
          current_target_weight?: number | null
          id?: string
          plan_exercise_id: string
          rep_max?: number | null
          rep_min?: number | null
          rest_seconds?: number | null
          set_number: number
          target_reps_text?: string | null
          updated_at?: string
          weight_progression_amount?: number
        }
        Update: {
          created_at?: string
          current_target_weight?: number | null
          id?: string
          plan_exercise_id?: string
          rep_max?: number | null
          rep_min?: number | null
          rest_seconds?: number | null
          set_number?: number
          target_reps_text?: string | null
          updated_at?: string
          weight_progression_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_sets_plan_exercise_id_fkey"
            columns: ["plan_exercise_id"]
            isOneToOne: false
            referencedRelation: "plan_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_level: string | null
          available_equipment: string[] | null
          created_at: string
          current_weight_kg: number | null
          date_of_birth: string | null
          dietary_restrictions: string[] | null
          favorite_cuisines: string[] | null
          full_name: string | null
          height_cm: number | null
          onboarding_completed: boolean
          primary_goal: string | null
          unit_preference: string
          updated_at: string
          user_id: string
          username: string | null
          workout_days_pref: number[] | null
          workout_frequency_pref: number | null
        }
        Insert: {
          activity_level?: string | null
          available_equipment?: string[] | null
          created_at?: string
          current_weight_kg?: number | null
          date_of_birth?: string | null
          dietary_restrictions?: string[] | null
          favorite_cuisines?: string[] | null
          full_name?: string | null
          height_cm?: number | null
          onboarding_completed?: boolean
          primary_goal?: string | null
          unit_preference?: string
          updated_at?: string
          user_id: string
          username?: string | null
          workout_days_pref?: number[] | null
          workout_frequency_pref?: number | null
        }
        Update: {
          activity_level?: string | null
          available_equipment?: string[] | null
          created_at?: string
          current_weight_kg?: number | null
          date_of_birth?: string | null
          dietary_restrictions?: string[] | null
          favorite_cuisines?: string[] | null
          full_name?: string | null
          height_cm?: number | null
          onboarding_completed?: boolean
          primary_goal?: string | null
          unit_preference?: string
          updated_at?: string
          user_id?: string
          username?: string | null
          workout_days_pref?: number[] | null
          workout_frequency_pref?: number | null
        }
        Relationships: []
      }
      progress_photos: {
        Row: {
          description: string | null
          id: string
          storage_path: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          description?: string | null
          id?: string
          storage_path: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          description?: string | null
          id?: string
          storage_path?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          unit_preference: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          unit_preference?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          unit_preference?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weight_logs: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          user_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      workout_log_sets: {
        Row: {
          actual_exercise_library_id: string
          actual_reps: number | null
          actual_weight: number | null
          actual_weight_unit: string | null
          created_at: string
          id: string
          log_id: string
          notes: string | null
          plan_exercise_id: string
          set_number: number
          user_id: string
        }
        Insert: {
          actual_exercise_library_id: string
          actual_reps?: number | null
          actual_weight?: number | null
          actual_weight_unit?: string | null
          created_at?: string
          id?: string
          log_id: string
          notes?: string | null
          plan_exercise_id: string
          set_number: number
          user_id: string
        }
        Update: {
          actual_exercise_library_id?: string
          actual_reps?: number | null
          actual_weight?: number | null
          actual_weight_unit?: string | null
          created_at?: string
          id?: string
          log_id?: string
          notes?: string | null
          plan_exercise_id?: string
          set_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_log_sets_actual_exercise_library_id_fkey"
            columns: ["actual_exercise_library_id"]
            isOneToOne: false
            referencedRelation: "exercises_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_log_sets_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_log_sets_plan_exercise_id_fkey"
            columns: ["plan_exercise_id"]
            isOneToOne: false
            referencedRelation: "plan_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          completed: boolean
          created_at: string
          end_time: string | null
          id: string
          plan_day_id: string
          plan_id: string
          start_time: string | null
          user_id: string
          workout_date: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          end_time?: string | null
          id?: string
          plan_day_id: string
          plan_id: string
          start_time?: string | null
          user_id: string
          workout_date: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          end_time?: string | null
          id?: string
          plan_day_id?: string
          plan_id?: string
          start_time?: string | null
          user_id?: string
          workout_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_completed_plan_day_id_fkey"
            columns: ["plan_day_id"]
            isOneToOne: false
            referencedRelation: "plan_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          created_at: string
          days_per_week: number | null
          description: string | null
          experience_level: string | null
          goals: string[] | null
          id: string
          is_active: boolean
          name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_per_week?: number | null
          description?: string | null
          experience_level?: string | null
          goals?: string[] | null
          id?: string
          is_active?: boolean
          name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_per_week?: number | null
          description?: string | null
          experience_level?: string | null
          goals?: string[] | null
          id?: string
          is_active?: boolean
          name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
    },
  },
} as const
