// Types generated from Supabase schema — keep in sync with supabase/migrations/
// Regenerate with: supabase gen types typescript --local > apps/web/src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          role: 'admin' | 'agente' | 'visor'
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          full_name: string
          role?: 'admin' | 'agente' | 'visor'
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: 'admin' | 'agente' | 'visor'
          avatar_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          id: string
          name: string
          position: number
          color: string
          is_won: boolean
          is_lost: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          position: number
          color?: string
          is_won?: boolean
          is_lost?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          position?: number
          color?: string
          is_won?: boolean
          is_lost?: boolean
          created_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          phone: string | null
          channel: 'whatsapp' | 'instagram' | 'messenger' | 'web_chat' | 'other'
          channel_user_id: string
          interest_type: 'real_estate' | 'construction' | 'concierge' | 'other' | null
          property_of_interest: string | null
          budget_range: string | null
          source: string | null
          stage_id: string | null
          assigned_to: string | null
          created_at: string
          updated_at: string
          last_contact_at: string | null
          follow_up_at: string | null
          property_id: string | null
          agent_last_read_at: string | null
          registered: boolean
        }
        Insert: {
          id?: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          channel: 'whatsapp' | 'instagram' | 'messenger' | 'web_chat' | 'other'
          channel_user_id: string
          interest_type?: 'real_estate' | 'construction' | 'concierge' | 'other' | null
          property_of_interest?: string | null
          budget_range?: string | null
          source?: string | null
          stage_id?: string | null
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
          last_contact_at?: string | null
          follow_up_at?: string | null
          property_id?: string | null
          agent_last_read_at?: string | null
          registered?: boolean
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          channel?: 'whatsapp' | 'instagram' | 'messenger' | 'web_chat' | 'other'
          channel_user_id?: string
          interest_type?: 'real_estate' | 'construction' | 'concierge' | 'other' | null
          property_of_interest?: string | null
          budget_range?: string | null
          source?: string | null
          stage_id?: string | null
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
          last_contact_at?: string | null
          follow_up_at?: string | null
          property_id?: string | null
          agent_last_read_at?: string | null
          registered?: boolean
        }
        Relationships: [
          { foreignKeyName: "clients_stage_id_fkey"; columns: ["stage_id"]; isOneToOne: false; referencedRelation: "pipeline_stages"; referencedColumns: ["id"] },
          { foreignKeyName: "clients_assigned_to_fkey"; columns: ["assigned_to"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "clients_property_id_fkey"; columns: ["property_id"]; isOneToOne: false; referencedRelation: "properties"; referencedColumns: ["id"] }
        ]
      }
      client_comments: {
        Row: {
          id: string
          client_id: string
          author_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          author_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          author_id?: string
          content?: string
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "client_comments_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
          { foreignKeyName: "client_comments_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      stage_history: {
        Row: {
          id: string
          client_id: string
          from_stage_id: string | null
          to_stage_id: string
          changed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          from_stage_id?: string | null
          to_stage_id: string
          changed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          from_stage_id?: string | null
          to_stage_id?: string
          changed_by?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "stage_history_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
          { foreignKeyName: "stage_history_to_stage_id_fkey"; columns: ["to_stage_id"]; isOneToOne: false; referencedRelation: "pipeline_stages"; referencedColumns: ["id"] }
        ]
      }
      messages: {
        Row: {
          id: string
          client_id: string
          channel: string
          direction: 'inbound' | 'outbound'
          content: string | null
          raw_payload: Json | null
          created_at: string
          wa_message_id: string | null
          wa_status: string | null
          wa_error: Json | null
        }
        Insert: {
          id?: string
          client_id: string
          channel: string
          direction: 'inbound' | 'outbound'
          content?: string | null
          raw_payload?: Json | null
          created_at?: string
          wa_message_id?: string | null
          wa_status?: string | null
          wa_error?: Json | null
        }
        Update: {
          id?: string
          client_id?: string
          channel?: string
          direction?: 'inbound' | 'outbound'
          content?: string | null
          raw_payload?: Json | null
          created_at?: string
          wa_message_id?: string | null
          wa_status?: string | null
          wa_error?: Json | null
        }
        Relationships: [
          { foreignKeyName: "messages_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] }
        ]
      }
      properties: {
        Row: {
          id: string
          name: string
          slug: string | null
          location: string | null
          property_type: 'land' | 'house' | 'department' | 'lot' | 'other'
          price_label: string | null
          price_usd: number | null
          size_label: string | null
          status: 'available' | 'reserved' | 'sold' | 'off_market'
          description: string | null
          image_url: string | null
          source_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug?: string | null
          location?: string | null
          property_type?: 'land' | 'house' | 'department' | 'lot' | 'other'
          price_label?: string | null
          price_usd?: number | null
          size_label?: string | null
          status?: 'available' | 'reserved' | 'sold' | 'off_market'
          description?: string | null
          image_url?: string | null
          source_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string | null
          location?: string | null
          property_type?: 'land' | 'house' | 'department' | 'lot' | 'other'
          price_label?: string | null
          price_usd?: number | null
          size_label?: string | null
          status?: 'available' | 'reserved' | 'sold' | 'off_market'
          description?: string | null
          image_url?: string | null
          source_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string | null
          endpoint: string
          p256dh: string
          auth: string
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          endpoint?: string
          p256dh?: string
          auth?: string
          user_agent?: string | null
          created_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          id: string
          client_id: string
          title: string | null
          appointment_type: 'visit' | 'call' | 'meeting' | 'signing' | 'follow_up' | 'other'
          starts_at: string
          ends_at: string | null
          location: string | null
          notes: string | null
          status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
          assigned_to: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          title?: string | null
          appointment_type?: 'visit' | 'call' | 'meeting' | 'signing' | 'follow_up' | 'other'
          starts_at: string
          ends_at?: string | null
          location?: string | null
          notes?: string | null
          status?: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
          assigned_to?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          title?: string | null
          appointment_type?: 'visit' | 'call' | 'meeting' | 'signing' | 'follow_up' | 'other'
          starts_at?: string
          ends_at?: string | null
          location?: string | null
          notes?: string | null
          status?: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
          assigned_to?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "appointments_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
          { foreignKeyName: "appointments_assigned_to_fkey"; columns: ["assigned_to"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      client_attachments: {
        Row: {
          id: string
          client_id: string
          file_name: string
          file_path: string
          file_size: number | null
          mime_type: string | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          mime_type?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          mime_type?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "client_attachments_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] }
        ]
      }
    }
    Views: Record<string, { Row: Record<string, unknown> }>
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>
    Enums: {
      user_role: 'admin' | 'agente' | 'visor'
      channel_type: 'whatsapp' | 'instagram' | 'messenger' | 'web_chat' | 'other'
      interest_type: 'real_estate' | 'construction' | 'concierge' | 'other'
      message_direction: 'inbound' | 'outbound'
    }
    CompositeTypes: Record<string, never>
  }
}

// Convenience aliases
export type Profile = Database['public']['Tables']['profiles']['Row']
export type PipelineStage = Database['public']['Tables']['pipeline_stages']['Row']
export type Client = Database['public']['Tables']['clients']['Row']
export type ClientComment = Database['public']['Tables']['client_comments']['Row']
export type StageHistory = Database['public']['Tables']['stage_history']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type Property = Database['public']['Tables']['properties']['Row']
export type ClientAttachment = Database['public']['Tables']['client_attachments']['Row']
export type Appointment = Database['public']['Tables']['appointments']['Row']

export type ClientInsert = Database['public']['Tables']['clients']['Insert']
export type PropertyInsert = Database['public']['Tables']['properties']['Insert']
export type PropertyUpdate = Database['public']['Tables']['properties']['Update']
export type ClientUpdate = Database['public']['Tables']['clients']['Update']
export type ClientCommentInsert = Database['public']['Tables']['client_comments']['Insert']
export type StageHistoryInsert = Database['public']['Tables']['stage_history']['Insert']
export type AppointmentInsert = Database['public']['Tables']['appointments']['Insert']
export type AppointmentUpdate = Database['public']['Tables']['appointments']['Update']

export type UserRole = Database['public']['Enums']['user_role']
export type Channel = Database['public']['Enums']['channel_type']
export type InterestType = Database['public']['Enums']['interest_type']
export type MessageDirection = Database['public']['Enums']['message_direction']
