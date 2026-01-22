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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          address: string | null
          city: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      equipment: {
        Row: {
          brand: string
          client_id: string
          created_at: string
          equipment_type: string
          id: string
          installation_date: string | null
          model: string
          notes: string | null
          serial_number: string | null
          updated_at: string
        }
        Insert: {
          brand: string
          client_id: string
          created_at?: string
          equipment_type: string
          id?: string
          installation_date?: string | null
          model: string
          notes?: string | null
          serial_number?: string | null
          updated_at?: string
        }
        Update: {
          brand?: string
          client_id?: string
          created_at?: string
          equipment_type?: string
          id?: string
          installation_date?: string | null
          model?: string
          notes?: string | null
          serial_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_equipment: {
        Row: {
          created_at: string
          equipment_functional: boolean | null
          equipment_id: string
          id: string
          intervention_id: string
          technical_comments: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          equipment_functional?: boolean | null
          equipment_id: string
          id?: string
          intervention_id: string
          technical_comments?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          equipment_functional?: boolean | null
          equipment_id?: string
          id?: string
          intervention_id?: string
          technical_comments?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_equipment_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_photos: {
        Row: {
          created_at: string
          equipment_id: string | null
          id: string
          intervention_id: string
          photo_type: string
          photo_url: string
        }
        Insert: {
          created_at?: string
          equipment_id?: string | null
          id?: string
          intervention_id: string
          photo_type: string
          photo_url: string
        }
        Update: {
          created_at?: string
          equipment_id?: string | null
          id?: string
          intervention_id?: string
          photo_type?: string
          photo_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_photos_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_photos_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_types: {
        Row: {
          color: string | null
          created_at: string
          id: string
          label: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          label: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          label?: string
          name?: string
        }
        Relationships: []
      }
      interventions: {
        Row: {
          arrival_time: string | null
          client_id: string
          client_signature_name: string | null
          client_signature_url: string | null
          created_at: string
          departure_time: string | null
          description: string | null
          equipment_functional: boolean | null
          equipment_id: string | null
          id: string
          intervention_address: string | null
          intervention_city: string | null
          intervention_email: string | null
          intervention_phone: string | null
          intervention_postal_code: string | null
          intervention_type: Database["public"]["Enums"]["intervention_type"]
          observations: string | null
          public_token: string | null
          report: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          status: Database["public"]["Enums"]["intervention_status"]
          technical_comments: string | null
          technician_id: string | null
          title: string
          travel_departure_time: string | null
          travel_return_time: string | null
          updated_at: string
        }
        Insert: {
          arrival_time?: string | null
          client_id: string
          client_signature_name?: string | null
          client_signature_url?: string | null
          created_at?: string
          departure_time?: string | null
          description?: string | null
          equipment_functional?: boolean | null
          equipment_id?: string | null
          id?: string
          intervention_address?: string | null
          intervention_city?: string | null
          intervention_email?: string | null
          intervention_phone?: string | null
          intervention_postal_code?: string | null
          intervention_type: Database["public"]["Enums"]["intervention_type"]
          observations?: string | null
          public_token?: string | null
          report?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["intervention_status"]
          technical_comments?: string | null
          technician_id?: string | null
          title: string
          travel_departure_time?: string | null
          travel_return_time?: string | null
          updated_at?: string
        }
        Update: {
          arrival_time?: string | null
          client_id?: string
          client_signature_name?: string | null
          client_signature_url?: string | null
          created_at?: string
          departure_time?: string | null
          description?: string | null
          equipment_functional?: boolean | null
          equipment_id?: string | null
          id?: string
          intervention_address?: string | null
          intervention_city?: string | null
          intervention_email?: string | null
          intervention_phone?: string | null
          intervention_postal_code?: string | null
          intervention_type?: Database["public"]["Enums"]["intervention_type"]
          observations?: string | null
          public_token?: string | null
          report?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["intervention_status"]
          technical_comments?: string | null
          technician_id?: string | null
          title?: string
          travel_departure_time?: string | null
          travel_return_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interventions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "technician"
      client_type: "individual" | "professional"
      intervention_status:
        | "to_plan"
        | "planned"
        | "in_progress"
        | "completed"
        | "to_invoice"
        | "archived"
      intervention_type: "sav" | "maintenance" | "installation"
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
      app_role: ["admin", "technician"],
      client_type: ["individual", "professional"],
      intervention_status: [
        "to_plan",
        "planned",
        "in_progress",
        "completed",
        "to_invoice",
        "archived",
      ],
      intervention_type: ["sav", "maintenance", "installation"],
    },
  },
} as const
