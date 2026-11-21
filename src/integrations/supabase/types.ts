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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          address: string | null
          company_name: string
          default_currency: string
          email: string | null
          id: number
          phone: string | null
          tagline: string | null
          team_sees_all: boolean
          updated_at: string
          updated_by: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          company_name?: string
          default_currency?: string
          email?: string | null
          id?: number
          phone?: string | null
          tagline?: string | null
          team_sees_all?: boolean
          updated_at?: string
          updated_by?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          default_currency?: string
          email?: string | null
          id?: number
          phone?: string | null
          tagline?: string | null
          team_sees_all?: boolean
          updated_at?: string
          updated_by?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      cad_approvals: {
        Row: {
          approved_at: string
          approved_by: string
          document_id: string
          id: string
          order_id: string
        }
        Insert: {
          approved_at?: string
          approved_by: string
          document_id: string
          id?: string
          order_id: string
        }
        Update: {
          approved_at?: string
          approved_by?: string
          document_id?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cad_approvals_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cad_approvals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cad_approvals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          assigned_executive_id: string
          contact_person: string | null
          country: string
          created_at: string
          created_by: string | null
          email: string
          id: string
          internal_notes: string | null
          last_activity_at: string
          name: string
          phone: string | null
          portal_invited_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          assigned_executive_id: string
          contact_person?: string | null
          country: string
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          internal_notes?: string | null
          last_activity_at?: string
          name: string
          phone?: string | null
          portal_invited_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          assigned_executive_id?: string
          contact_person?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          internal_notes?: string | null
          last_activity_at?: string
          name?: string
          phone?: string | null
          portal_invited_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_assigned_executive_id_fkey"
            columns: ["assigned_executive_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          created_by: string | null
          customer_visible: boolean
          doc_type: string
          id: string
          mime_type: string | null
          name: string
          order_id: string
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_visible?: boolean
          doc_type: string
          id?: string
          mime_type?: string | null
          name: string
          order_id: string
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_visible?: boolean
          doc_type?: string
          id?: string
          mime_type?: string | null
          name?: string
          order_id?: string
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_records: {
        Row: {
          created_at: string
          customer_id: string
          document_url: string | null
          id: string
          rejection_reason: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          document_url?: string | null
          id?: string
          rejection_reason?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          document_url?: string | null
          id?: string
          rejection_reason?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      metal_supplies: {
        Row: {
          created_at: string
          id: string
          metal_purity: string | null
          metal_type: string
          metal_weight: number | null
          notes: string | null
          order_id: string
          status: string
          supplied_date: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metal_purity?: string | null
          metal_type?: string
          metal_weight?: number | null
          notes?: string | null
          order_id: string
          status?: string
          supplied_date?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metal_purity?: string | null
          metal_type?: string
          metal_weight?: number | null
          notes?: string | null
          order_id?: string
          status?: string
          supplied_date?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metal_supplies_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metal_supplies_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metal_supplies_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_approvals: {
        Row: {
          approval_type: string
          created_at: string
          customer_approval_required: boolean
          decided_at: string | null
          decided_by: string | null
          document_id: string | null
          file_name: string
          file_path: string
          id: string
          internal_qc_status: string
          order_id: string
          rejection_notes: string | null
          rejection_reason: string | null
          requested_by: string | null
          stage_key: string
          status: string
          version: number
        }
        Insert: {
          approval_type?: string
          created_at?: string
          customer_approval_required?: boolean
          decided_at?: string | null
          decided_by?: string | null
          document_id?: string | null
          file_name: string
          file_path: string
          id?: string
          internal_qc_status?: string
          order_id: string
          rejection_notes?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          stage_key: string
          status?: string
          version?: number
        }
        Update: {
          approval_type?: string
          created_at?: string
          customer_approval_required?: boolean
          decided_at?: string | null
          decided_by?: string | null
          document_id?: string | null
          file_name?: string
          file_path?: string
          id?: string
          internal_qc_status?: string
          order_id?: string
          rejection_notes?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          stage_key?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_approvals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_approvals_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_approvals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_approvals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_approvals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_stages: {
        Row: {
          completed_at: string | null
          customer_note: string | null
          details: Json
          id: string
          is_payment_stage: boolean
          journey_position: number
          name: string
          order_id: string
          position: number
          stage_key: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          completed_at?: string | null
          customer_note?: string | null
          details?: Json
          id?: string
          is_payment_stage?: boolean
          journey_position?: number
          name: string
          order_id: string
          position: number
          stage_key: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          completed_at?: string | null
          customer_note?: string | null
          details?: Json
          id?: string
          is_payment_stage?: boolean
          journey_position?: number
          name?: string
          order_id?: string
          position?: number
          stage_key?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_stages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_stages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_stages_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_updates: {
        Row: {
          created_at: string
          created_by: string | null
          customer_visible: boolean
          document_id: string | null
          id: string
          note: string | null
          order_id: string
          stage_id: string | null
          stage_name: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_visible?: boolean
          document_id?: string | null
          id?: string
          note?: string | null
          order_id: string
          stage_id?: string | null
          stage_name?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_visible?: boolean
          document_id?: string | null
          id?: string
          note?: string | null
          order_id?: string
          stage_id?: string | null
          stage_name?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_updates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_updates_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_updates_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_updates_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_updates_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "order_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_received: number
          balance_due: number | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          current_responsible_dept: string | null
          current_stage_key: string | null
          current_stage_name: string | null
          current_stage_status: string | null
          customer_action_required: string | null
          customer_id: string
          customer_po_ref: string | null
          executive_override_id: string | null
          expected_delivery_date: string | null
          feedback_at: string | null
          feedback_comment: string | null
          feedback_rating: number | null
          final_invoice_amount: number | null
          id: string
          notes: string | null
          order_type: string
          payment_status: string
          payment_terms: string | null
          proforma_amount: number | null
          progress_pct: number
          reference: string
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_received?: number
          balance_due?: number | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_responsible_dept?: string | null
          current_stage_key?: string | null
          current_stage_name?: string | null
          current_stage_status?: string | null
          customer_action_required?: string | null
          customer_id: string
          customer_po_ref?: string | null
          executive_override_id?: string | null
          expected_delivery_date?: string | null
          feedback_at?: string | null
          feedback_comment?: string | null
          feedback_rating?: number | null
          final_invoice_amount?: number | null
          id?: string
          notes?: string | null
          order_type: string
          payment_status?: string
          payment_terms?: string | null
          proforma_amount?: number | null
          progress_pct?: number
          reference: string
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_received?: number
          balance_due?: number | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_responsible_dept?: string | null
          current_stage_key?: string | null
          current_stage_name?: string | null
          current_stage_status?: string | null
          customer_action_required?: string | null
          customer_id?: string
          customer_po_ref?: string | null
          executive_override_id?: string | null
          expected_delivery_date?: string | null
          feedback_at?: string | null
          feedback_comment?: string | null
          feedback_rating?: number | null
          final_invoice_amount?: number | null
          id?: string
          notes?: string | null
          order_type?: string
          payment_status?: string
          payment_terms?: string | null
          proforma_amount?: number | null
          progress_pct?: number
          reference?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_executive_override_id_fkey"
            columns: ["executive_override_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          document_id: string | null
          id: string
          method: string
          notes: string | null
          order_id: string
          payment_date: string
          payment_type: string
          reference: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          document_id?: string | null
          id?: string
          method?: string
          notes?: string | null
          order_id: string
          payment_date?: string
          payment_type?: string
          reference?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          document_id?: string | null
          id?: string
          method?: string
          notes?: string | null
          order_id?: string
          payment_date?: string
          payment_type?: string
          reference?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photography_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          order_id: string
          photo_urls: string[]
          status: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          photo_urls?: string[]
          status?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          photo_urls?: string[]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "photography_tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "order_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photography_tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          customer_id: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          job_title: string | null
          phone: string | null
          photo_url: string | null
          role: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          job_title?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_customer_fk"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_customer_fk"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          courier: string
          created_at: string
          created_by: string | null
          delivered_at: string | null
          document_id: string | null
          estimated_delivery_date: string | null
          id: string
          order_id: string
          shipped_date: string | null
          status: string
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          courier: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          document_id?: string | null
          estimated_delivery_date?: string | null
          id?: string
          order_id: string
          shipped_date?: string | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          courier?: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          document_id?: string | null
          estimated_delivery_date?: string | null
          id?: string
          order_id?: string
          shipped_date?: string | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      terms_acceptance: {
        Row: {
          accepted_at: string
          accepted_by: string
          customer_id: string
          id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          accepted_by: string
          customer_id: string
          id?: string
          version: string
        }
        Update: {
          accepted_at?: string
          accepted_by?: string
          customer_id?: string
          id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_acceptance_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terms_acceptance_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terms_acceptance_version_fkey"
            columns: ["version"]
            isOneToOne: false
            referencedRelation: "terms_versions"
            referencedColumns: ["version"]
          },
        ]
      }
      terms_versions: {
        Row: {
          body: string
          effective_date: string
          published: boolean
          version: string
        }
        Insert: {
          body: string
          effective_date: string
          published?: boolean
          version: string
        }
        Update: {
          body?: string
          effective_date?: string
          published?: boolean
          version?: string
        }
        Relationships: []
      }
    }
    Views: {
      customer_list: {
        Row: {
          active_orders: number | null
          address: string | null
          assigned_executive_id: string | null
          completed_orders: number | null
          contact_person: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          executive_name: string | null
          id: string | null
          internal_notes: string | null
          last_activity: string | null
          last_activity_at: string | null
          name: string | null
          phone: string | null
          portal_invited_at: string | null
          portal_status: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_assigned_executive_id_fkey"
            columns: ["assigned_executive_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_list: {
        Row: {
          amount_received: number | null
          balance_due: number | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          current_responsible_dept: string | null
          current_stage_key: string | null
          current_stage_name: string | null
          current_stage_status: string | null
          customer_action_required: string | null
          customer_country: string | null
          customer_id: string | null
          customer_name: string | null
          customer_po_ref: string | null
          executive_id: string | null
          executive_name: string | null
          executive_override_id: string | null
          expected_delivery_date: string | null
          feedback_at: string | null
          feedback_comment: string | null
          feedback_rating: number | null
          final_invoice_amount: number | null
          id: string | null
          next_action: string | null
          notes: string | null
          order_type: string | null
          payment_status: string | null
          payment_terms: string | null
          proforma_amount: number | null
          progress_pct: number | null
          reference: string | null
          status: string | null
          title: string | null
          total_amount: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_executive_override_id_fkey"
            columns: ["executive_override_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_user_directory: {
        Args: never
        Returns: {
          created_at: string
          customer_id: string
          customer_name: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          job_title: string
          last_sign_in_at: string
          phone: string
          photo_url: string
          role: string
          whatsapp: string
        }[]
      }
      auth_role: { Args: never; Returns: string }
      calc_payment_status: {
        Args: { has_initiated: boolean; received: number; total: number }
        Returns: string
      }
      can_read_document_object: { Args: { p_path: string }; Returns: boolean }
      create_default_stages: {
        Args: { p_order_id: string; p_type: string }
        Returns: undefined
      }
      customer_owns_active_order: { Args: { oid: string }; Returns: boolean }
      customer_portal_status: { Args: { cid: string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      my_customer_id: { Args: never; Returns: string }
      portal_accept_terms: { Args: { p_version: string }; Returns: undefined }
      portal_approve_cad: {
        Args: { p_document_id: string; p_order_id: string }
        Returns: undefined
      }
      portal_decide_approval: {
        Args: {
          p_approval_id: string
          p_decision: string
          p_notes?: string
          p_reason?: string
        }
        Returns: undefined
      }
      portal_executive_json: { Args: { p_exec: string }; Returns: Json }
      portal_home: { Args: never; Returns: Json }
      portal_order: { Args: { p_order_id: string }; Returns: Json }
      portal_order_extra: { Args: { p_order_id: string }; Returns: Json }
      portal_submit_feedback: {
        Args: { p_comment?: string; p_order_id: string; p_rating: number }
        Returns: undefined
      }
      portal_submit_kyc: { Args: { p_path: string }; Returns: string }
      portal_submit_payment: {
        Args: {
          p_amount: number
          p_name: string
          p_order_id: string
          p_path: string
          p_reference?: string
        }
        Returns: string
      }
      portal_update_profile: {
        Args: { p_full_name: string; p_phone: string }
        Returns: undefined
      }
      promote_to_admin: { Args: { p_email: string }; Returns: string }
      recompute_order_payments: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      recompute_order_progress: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      record_stage_update: {
        Args: {
          p_customer_visible?: boolean
          p_details?: Json
          p_document_id?: string
          p_note?: string
          p_stage_id: string
          p_status: string
        }
        Returns: string
      }
      review_kyc: {
        Args: { p_id: string; p_reason?: string; p_status: string }
        Returns: undefined
      }
      staff_add_stage: {
        Args: { p_after_stage_id?: string; p_name: string; p_order_id: string }
        Returns: string
      }
      staff_can_access_customer: { Args: { cid: string }; Returns: boolean }
      staff_can_access_order: { Args: { oid: string }; Returns: boolean }
      staff_delete_stage: { Args: { p_stage_id: string }; Returns: undefined }
      staff_pending_payment_orders: { Args: never; Returns: string[] }
      staff_rename_stage: {
        Args: { p_name: string; p_stage_id: string }
        Returns: undefined
      }
      staff_reorder_stages: {
        Args: { p_order_id: string; p_stage_ids: string[] }
        Returns: undefined
      }
      staff_request_approval: {
        Args: {
          p_approval_type: string
          p_customer_required?: boolean
          p_document_id?: string
          p_file_name: string
          p_file_path: string
          p_order_id: string
          p_stage_key: string
        }
        Returns: string
      }
      team_sees_all: { Args: never; Returns: boolean }
      try_uuid: { Args: { p: string }; Returns: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
