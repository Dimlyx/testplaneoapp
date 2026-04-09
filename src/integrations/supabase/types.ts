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
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          organization_id: string
          read_at: string
          read_by: string | null
        }
        Insert: {
          announcement_id: string
          id?: string
          organization_id: string
          read_at?: string
          read_by?: string | null
        }
        Update: {
          announcement_id?: string
          id?: string
          organization_id?: string
          read_at?: string
          read_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          target_organization_ids: string[] | null
          target_type: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          target_organization_ids?: string[] | null
          target_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          target_organization_ids?: string[] | null
          target_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          organization_id: string | null
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          organization_id?: string | null
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          organization_id?: string | null
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          organization_id: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          organization_id?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          organization_id?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          client_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          organization_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          organization_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          organization_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          client_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_intervention_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          label: string
          name: string
          organization_id: string
          status_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          label: string
          name: string
          organization_id: string
          status_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          label?: string
          name?: string
          organization_id?: string
          status_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_intervention_statuses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_text: string
          closing_text: string
          created_at: string
          footer_text: string
          greeting: string
          header_color: string
          id: string
          organization_id: string | null
          signature_text: string
          subject: string
          template_type: string
          updated_at: string
        }
        Insert: {
          body_text?: string
          closing_text?: string
          created_at?: string
          footer_text?: string
          greeting?: string
          header_color?: string
          id?: string
          organization_id?: string | null
          signature_text?: string
          subject?: string
          template_type?: string
          updated_at?: string
        }
        Update: {
          body_text?: string
          closing_text?: string
          created_at?: string
          footer_text?: string
          greeting?: string
          header_color?: string
          id?: string
          organization_id?: string | null
          signature_text?: string
          subject?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "equipment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          intervention_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          intervention_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          intervention_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_attachments_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_equipment: {
        Row: {
          created_at: string
          equipment_functional: boolean | null
          equipment_id: string
          equipment_status:
            | Database["public"]["Enums"]["equipment_status"]
            | null
          id: string
          intervention_id: string
          technical_comments: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          equipment_functional?: boolean | null
          equipment_id: string
          equipment_status?:
            | Database["public"]["Enums"]["equipment_status"]
            | null
          id?: string
          intervention_id: string
          technical_comments?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          equipment_functional?: boolean | null
          equipment_id?: string
          equipment_status?:
            | Database["public"]["Enums"]["equipment_status"]
            | null
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
      intervention_pauses: {
        Row: {
          created_at: string
          id: string
          intervention_id: string
          pause_reason: string
          paused_at: string
          paused_by: string | null
          resumed_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          intervention_id: string
          pause_reason: string
          paused_at?: string
          paused_by?: string | null
          resumed_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          intervention_id?: string
          pause_reason?: string
          paused_at?: string
          paused_by?: string | null
          resumed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_pauses_intervention_id_fkey"
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
      intervention_step_completions: {
        Row: {
          checklist_data: Json | null
          comment: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          intervention_id: string
          loop_index: number
          multiple_choice_data: Json | null
          photo_url: string | null
          step_id: string
        }
        Insert: {
          checklist_data?: Json | null
          comment?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          intervention_id: string
          loop_index?: number
          multiple_choice_data?: Json | null
          photo_url?: string | null
          step_id: string
        }
        Update: {
          checklist_data?: Json | null
          comment?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          intervention_id?: string
          loop_index?: number
          multiple_choice_data?: Json | null
          photo_url?: string | null
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_step_completions_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_step_completions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "intervention_workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_types: {
        Row: {
          allow_loop: boolean
          color: string | null
          created_at: string
          id: string
          label: string
          name: string
          organization_id: string | null
          track_journey: boolean
        }
        Insert: {
          allow_loop?: boolean
          color?: string | null
          created_at?: string
          id?: string
          label: string
          name: string
          organization_id?: string | null
          track_journey?: boolean
        }
        Update: {
          allow_loop?: boolean
          color?: string | null
          created_at?: string
          id?: string
          label?: string
          name?: string
          organization_id?: string | null
          track_journey?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "intervention_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_workflow_steps: {
        Row: {
          checklist_items: Json | null
          created_at: string
          description: string | null
          id: string
          intervention_type_id: string
          is_loop_trigger: boolean
          is_mandatory: boolean | null
          label: string
          loop_no_step_id: string | null
          loop_yes_step_id: string | null
          multiple_choice_items: Json | null
          name: string
          organization_id: string | null
          requires_comment: boolean | null
          requires_photo: boolean | null
          requires_signature: boolean | null
          step_order: number
          updated_at: string
        }
        Insert: {
          checklist_items?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          intervention_type_id: string
          is_loop_trigger?: boolean
          is_mandatory?: boolean | null
          label: string
          loop_no_step_id?: string | null
          loop_yes_step_id?: string | null
          multiple_choice_items?: Json | null
          name: string
          organization_id?: string | null
          requires_comment?: boolean | null
          requires_photo?: boolean | null
          requires_signature?: boolean | null
          step_order?: number
          updated_at?: string
        }
        Update: {
          checklist_items?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          intervention_type_id?: string
          is_loop_trigger?: boolean
          is_mandatory?: boolean | null
          label?: string
          loop_no_step_id?: string | null
          loop_yes_step_id?: string | null
          multiple_choice_items?: Json | null
          name?: string
          organization_id?: string | null
          requires_comment?: boolean | null
          requires_photo?: boolean | null
          requires_signature?: boolean | null
          step_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_workflow_steps_intervention_type_id_fkey"
            columns: ["intervention_type_id"]
            isOneToOne: false
            referencedRelation: "intervention_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_workflow_steps_loop_no_step_id_fkey"
            columns: ["loop_no_step_id"]
            isOneToOne: false
            referencedRelation: "intervention_workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_workflow_steps_loop_yes_step_id_fkey"
            columns: ["loop_yes_step_id"]
            isOneToOne: false
            referencedRelation: "intervention_workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_workflow_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      interventions: {
        Row: {
          arrival_time: string | null
          cancellation_details: string | null
          cancellation_photos: Json | null
          cancellation_reason: string | null
          client_id: string
          client_signature_name: string | null
          client_signature_url: string | null
          created_at: string
          custom_status_id: string | null
          departure_time: string | null
          description: string | null
          equipment_functional: boolean | null
          equipment_id: string | null
          estimated_duration: number | null
          id: string
          intervention_address: string | null
          intervention_building: string | null
          intervention_city: string | null
          intervention_contact_name: string | null
          intervention_email: string | null
          intervention_floor: string | null
          intervention_phone: string | null
          intervention_postal_code: string | null
          intervention_type: string
          is_paused: boolean
          observations: string | null
          organization_id: string | null
          public_token: string | null
          report: string | null
          scheduled_date: string | null
          scheduled_end_time: string | null
          scheduled_time: string | null
          status: Database["public"]["Enums"]["intervention_status"]
          team_id: string | null
          technical_comments: string | null
          technician_id: string | null
          title: string
          token_expires_at: string | null
          travel_departure_time: string | null
          travel_return_arrival_time: string | null
          travel_return_time: string | null
          updated_at: string
        }
        Insert: {
          arrival_time?: string | null
          cancellation_details?: string | null
          cancellation_photos?: Json | null
          cancellation_reason?: string | null
          client_id: string
          client_signature_name?: string | null
          client_signature_url?: string | null
          created_at?: string
          custom_status_id?: string | null
          departure_time?: string | null
          description?: string | null
          equipment_functional?: boolean | null
          equipment_id?: string | null
          estimated_duration?: number | null
          id?: string
          intervention_address?: string | null
          intervention_building?: string | null
          intervention_city?: string | null
          intervention_contact_name?: string | null
          intervention_email?: string | null
          intervention_floor?: string | null
          intervention_phone?: string | null
          intervention_postal_code?: string | null
          intervention_type: string
          is_paused?: boolean
          observations?: string | null
          organization_id?: string | null
          public_token?: string | null
          report?: string | null
          scheduled_date?: string | null
          scheduled_end_time?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["intervention_status"]
          team_id?: string | null
          technical_comments?: string | null
          technician_id?: string | null
          title: string
          token_expires_at?: string | null
          travel_departure_time?: string | null
          travel_return_arrival_time?: string | null
          travel_return_time?: string | null
          updated_at?: string
        }
        Update: {
          arrival_time?: string | null
          cancellation_details?: string | null
          cancellation_photos?: Json | null
          cancellation_reason?: string | null
          client_id?: string
          client_signature_name?: string | null
          client_signature_url?: string | null
          created_at?: string
          custom_status_id?: string | null
          departure_time?: string | null
          description?: string | null
          equipment_functional?: boolean | null
          equipment_id?: string | null
          estimated_duration?: number | null
          id?: string
          intervention_address?: string | null
          intervention_building?: string | null
          intervention_city?: string | null
          intervention_contact_name?: string | null
          intervention_email?: string | null
          intervention_floor?: string | null
          intervention_phone?: string | null
          intervention_postal_code?: string | null
          intervention_type?: string
          is_paused?: boolean
          observations?: string | null
          organization_id?: string | null
          public_token?: string | null
          report?: string | null
          scheduled_date?: string | null
          scheduled_end_time?: string | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["intervention_status"]
          team_id?: string | null
          technical_comments?: string | null
          technician_id?: string | null
          title?: string
          token_expires_at?: string | null
          travel_departure_time?: string | null
          travel_return_arrival_time?: string | null
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
            foreignKeyName: "interventions_custom_status_id_fkey"
            columns: ["custom_status_id"]
            isOneToOne: false
            referencedRelation: "custom_intervention_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interventions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_alerts: {
        Row: {
          alert_date: string
          client_id: string | null
          created_at: string
          description: string | null
          equipment_id: string | null
          id: string
          last_triggered_at: string | null
          organization_id: string | null
          recurrence: Database["public"]["Enums"]["alert_recurrence"]
          recurrence_months: number
          status: Database["public"]["Enums"]["alert_status"]
          title: string
          updated_at: string
        }
        Insert: {
          alert_date: string
          client_id?: string | null
          created_at?: string
          description?: string | null
          equipment_id?: string | null
          id?: string
          last_triggered_at?: string | null
          organization_id?: string | null
          recurrence?: Database["public"]["Enums"]["alert_recurrence"]
          recurrence_months?: number
          status?: Database["public"]["Enums"]["alert_status"]
          title: string
          updated_at?: string
        }
        Update: {
          alert_date?: string
          client_id?: string | null
          created_at?: string
          description?: string | null
          equipment_id?: string | null
          id?: string
          last_triggered_at?: string | null
          organization_id?: string | null
          recurrence?: Database["public"]["Enums"]["alert_recurrence"]
          recurrence_months?: number
          status?: Database["public"]["Enums"]["alert_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_alerts_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          intervention_id: string | null
          is_read: boolean
          message: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intervention_id?: string | null
          is_read?: boolean
          message?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intervention_id?: string | null
          is_read?: boolean
          message?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          max_users: number | null
          name: string
          phone: string | null
          plan: string
          postal_code: string | null
          siret: string | null
          slug: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          tva_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          max_users?: number | null
          name: string
          phone?: string | null
          plan?: string
          postal_code?: string | null
          siret?: string | null
          slug: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          tva_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          max_users?: number | null
          name?: string
          phone?: string | null
          plan?: string
          postal_code?: string | null
          siret?: string | null
          slug?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          tva_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          organization_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          leader_id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          leader_id: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          leader_id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_details: {
        Row: {
          address: string | null
          birth_date: string | null
          city: string | null
          collaboration_end_date: string | null
          collaboration_start_date: string | null
          contract_end_date: string | null
          contract_link: string | null
          contract_type: string | null
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          hire_date: string | null
          id: string
          kbis_url: string | null
          notes: string | null
          organization_id: string | null
          permissions: Json
          personal_email: string | null
          personal_phone: string | null
          position: string | null
          postal_code: string | null
          social_security_number: string | null
          specialties: string | null
          technician_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          city?: string | null
          collaboration_end_date?: string | null
          collaboration_start_date?: string | null
          contract_end_date?: string | null
          contract_link?: string | null
          contract_type?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          hire_date?: string | null
          id?: string
          kbis_url?: string | null
          notes?: string | null
          organization_id?: string | null
          permissions?: Json
          personal_email?: string | null
          personal_phone?: string | null
          position?: string | null
          postal_code?: string | null
          social_security_number?: string | null
          specialties?: string | null
          technician_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          city?: string | null
          collaboration_end_date?: string | null
          collaboration_start_date?: string | null
          contract_end_date?: string | null
          contract_link?: string | null
          contract_type?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          hire_date?: string | null
          id?: string
          kbis_url?: string | null
          notes?: string | null
          organization_id?: string | null
          permissions?: Json
          personal_email?: string | null
          personal_phone?: string | null
          position?: string | null
          postal_code?: string | null
          social_security_number?: string | null
          specialties?: string | null
          technician_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_details_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_documents: {
        Row: {
          created_at: string
          document_type: string
          expiration_date: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          organization_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type: string
          expiration_date?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          organization_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          expiration_date?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          organization_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_organization: { Args: { _user_id: string }; Returns: string }
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
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      alert_recurrence: "once" | "weekly" | "monthly" | "quarterly" | "yearly"
      alert_status: "pending" | "acknowledged" | "completed" | "dismissed"
      app_role: "admin" | "technician" | "super_admin"
      client_type: "individual" | "professional"
      equipment_status: "not_working" | "needs_intervention" | "working"
      intervention_status:
        | "to_plan"
        | "planned"
        | "in_progress"
        | "completed"
        | "to_invoice"
        | "archived"
        | "cancelled"
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
      alert_recurrence: ["once", "weekly", "monthly", "quarterly", "yearly"],
      alert_status: ["pending", "acknowledged", "completed", "dismissed"],
      app_role: ["admin", "technician", "super_admin"],
      client_type: ["individual", "professional"],
      equipment_status: ["not_working", "needs_intervention", "working"],
      intervention_status: [
        "to_plan",
        "planned",
        "in_progress",
        "completed",
        "to_invoice",
        "archived",
        "cancelled",
      ],
    },
  },
} as const
