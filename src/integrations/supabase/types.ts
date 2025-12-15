export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      custom_workdays: {
        Row: {
          created_at: string
          date: string
          id: string
          is_working_day: boolean
          note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_working_day?: boolean
          note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_working_day?: boolean
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      employee_shift_assignments: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          machine_shift_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          machine_shift_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          machine_shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_shift_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shift_assignments_machine_shift_id_fkey"
            columns: ["machine_shift_id"]
            isOneToOne: false
            referencedRelation: "machine_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_sick_days: {
        Row: {
          created_at: string
          date: string
          employee_id: string
          id: string
          note: string | null
        }
        Insert: {
          created_at?: string
          date: string
          employee_id: string
          id?: string
          note?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_sick_days_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_vacation_days: {
        Row: {
          created_at: string
          date: string
          employee_id: string
          id: string
          note: string | null
        }
        Insert: {
          created_at?: string
          date: string
          employee_id: string
          id?: string
          note?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_vacation_days_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          shift_model: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          shift_model?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          shift_model?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      excel_column_mappings: {
        Row: {
          column_name: string
          column_number: number
          created_at: string
          id: string
          is_article_number: boolean
          is_ba_number: boolean
          is_internal_completion_date: boolean
          is_order_duration: boolean
          updated_at: string
        }
        Insert: {
          column_name: string
          column_number: number
          created_at?: string
          id?: string
          is_article_number?: boolean
          is_ba_number?: boolean
          is_internal_completion_date?: boolean
          is_order_duration?: boolean
          updated_at?: string
        }
        Update: {
          column_name?: string
          column_number?: number
          created_at?: string
          id?: string
          is_article_number?: boolean
          is_ba_number?: boolean
          is_internal_completion_date?: boolean
          is_order_duration?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      excel_imports: {
        Row: {
          file_path: string
          filename: string
          id: string
          imported_at: string
          imported_by: string | null
          row_count: number | null
          status: string
        }
        Insert: {
          file_path: string
          filename: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          row_count?: number | null
          status?: string
        }
        Update: {
          file_path?: string
          filename?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          row_count?: number | null
          status?: string
        }
        Relationships: []
      }
      machine_excel_mappings: {
        Row: {
          column_numbers: number[]
          created_at: string
          excel_designation: string
          id: string
          machine_id: string
          updated_at: string
        }
        Insert: {
          column_numbers?: number[]
          created_at?: string
          excel_designation: string
          id?: string
          machine_id: string
          updated_at?: string
        }
        Update: {
          column_numbers?: number[]
          created_at?: string
          excel_designation?: string
          id?: string
          machine_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_excel_mappings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: true
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_shifts: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          hours: number
          id: string
          is_active: boolean
          machine_id: string
          shift_name: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          hours?: number
          id?: string
          is_active?: boolean
          machine_id: string
          shift_name: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          hours?: number
          id?: string
          is_active?: boolean
          machine_id?: string
          shift_name?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_shifts_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          efficiency_percent: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          efficiency_percent?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          efficiency_percent?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          description: string | null
          excel_data: Json | null
          excel_import_id: string | null
          id: string
          machine_id: string
          order_number: string | null
          part_number: string | null
          priority: number | null
          quantity: number | null
          sequence_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          excel_data?: Json | null
          excel_import_id?: string | null
          id?: string
          machine_id: string
          order_number?: string | null
          part_number?: string | null
          priority?: number | null
          quantity?: number | null
          sequence_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          excel_data?: Json | null
          excel_import_id?: string | null
          id?: string
          machine_id?: string
          order_number?: string | null
          part_number?: string | null
          priority?: number | null
          quantity?: number | null
          sequence_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_excel_import_id_fkey"
            columns: ["excel_import_id"]
            isOneToOne: false
            referencedRelation: "excel_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      part_families: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      part_family_items: {
        Row: {
          created_at: string
          family_id: string
          id: string
          part_value: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          part_value: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          part_value?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_family_items_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "part_families"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
