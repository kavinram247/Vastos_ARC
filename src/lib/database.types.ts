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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_extraction_jobs: {
        Row: {
          confidence: number | null
          created_at: string
          firm_id: string
          id: string
          model: string | null
          project_id: string | null
          raw_output: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_type: string
          source_url: string | null
          status: Database["public"]["Enums"]["extraction_status"]
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          firm_id: string
          id?: string
          model?: string | null
          project_id?: string | null
          raw_output?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_type: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["extraction_status"]
        }
        Update: {
          confidence?: number | null
          created_at?: string
          firm_id?: string
          id?: string
          model?: string | null
          project_id?: string | null
          raw_output?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_type?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["extraction_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ai_extraction_jobs_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_extraction_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_extraction_jobs_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          check_in_accuracy: number | null
          check_in_at: string | null
          check_in_label: string | null
          check_in_lat: number | null
          check_in_lng: number | null
          check_out_accuracy: number | null
          check_out_at: string | null
          check_out_label: string | null
          check_out_lat: number | null
          check_out_lng: number | null
          created_at: string
          firm_id: string
          id: string
          marked_by: string | null
          notes: string | null
          status: string
          updated_at: string
          user_id: string
          user_name: string
          work_date: string
        }
        Insert: {
          check_in_accuracy?: number | null
          check_in_at?: string | null
          check_in_label?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_out_accuracy?: number | null
          check_out_at?: string | null
          check_out_label?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          created_at?: string
          firm_id: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
          user_name: string
          work_date: string
        }
        Update: {
          check_in_accuracy?: number | null
          check_in_at?: string | null
          check_in_label?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_out_accuracy?: number | null
          check_out_at?: string | null
          check_out_label?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          created_at?: string
          firm_id?: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          user_name?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      boq_actual_variance: {
        Row: {
          actual_cost: number | null
          actual_qty: number | null
          actual_rate: number | null
          boq_line_id: string | null
          captured_at: string
          estimated_cost: number | null
          estimated_qty: number | null
          estimated_rate: number | null
          firm_id: string
          id: string
          product_id: string | null
          project_id: string | null
          region_id: string | null
          variance_pct: number | null
        }
        Insert: {
          actual_cost?: number | null
          actual_qty?: number | null
          actual_rate?: number | null
          boq_line_id?: string | null
          captured_at?: string
          estimated_cost?: number | null
          estimated_qty?: number | null
          estimated_rate?: number | null
          firm_id: string
          id?: string
          product_id?: string | null
          project_id?: string | null
          region_id?: string | null
          variance_pct?: number | null
        }
        Update: {
          actual_cost?: number | null
          actual_qty?: number | null
          actual_rate?: number | null
          boq_line_id?: string | null
          captured_at?: string
          estimated_cost?: number | null
          estimated_qty?: number | null
          estimated_rate?: number | null
          firm_id?: string
          id?: string
          product_id?: string | null
          project_id?: string | null
          region_id?: string | null
          variance_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "boq_actual_variance_boq_line_id_fkey"
            columns: ["boq_line_id"]
            isOneToOne: false
            referencedRelation: "boq_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_actual_variance_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_actual_variance_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_actual_variance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_actual_variance_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      boq_approvals: {
        Row: {
          approver_id: string | null
          boq_id: string
          comment: string | null
          created_at: string
          decision: Database["public"]["Enums"]["approval_decision"]
          firm_id: string
          id: string
          margin_at_approval: number | null
          version: number
        }
        Insert: {
          approver_id?: string | null
          boq_id: string
          comment?: string | null
          created_at?: string
          decision: Database["public"]["Enums"]["approval_decision"]
          firm_id: string
          id?: string
          margin_at_approval?: number | null
          version: number
        }
        Update: {
          approver_id?: string | null
          boq_id?: string
          comment?: string | null
          created_at?: string
          decision?: Database["public"]["Enums"]["approval_decision"]
          firm_id?: string
          id?: string
          margin_at_approval?: number | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "boq_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_approvals_boq_id_fkey"
            columns: ["boq_id"]
            isOneToOne: false
            referencedRelation: "boq_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_approvals_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      boq_documents: {
        Row: {
          created_at: string
          created_by: string | null
          current_version: number
          firm_id: string
          grand_total: number
          id: string
          lead_id: string | null
          margin_pct: number | null
          project_id: string | null
          region_id: string | null
          status: Database["public"]["Enums"]["boq_status"]
          title: string
          total_cost_price: number
          total_gst: number
          total_selling_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_version?: number
          firm_id: string
          grand_total?: number
          id?: string
          lead_id?: string | null
          margin_pct?: number | null
          project_id?: string | null
          region_id?: string | null
          status?: Database["public"]["Enums"]["boq_status"]
          title: string
          total_cost_price?: number
          total_gst?: number
          total_selling_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_version?: number
          firm_id?: string
          grand_total?: number
          id?: string
          lead_id?: string | null
          margin_pct?: number | null
          project_id?: string | null
          region_id?: string | null
          status?: Database["public"]["Enums"]["boq_status"]
          title?: string
          total_cost_price?: number
          total_gst?: number
          total_selling_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boq_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_documents_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_documents_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      boq_line_items: {
        Row: {
          ai_confidence: number | null
          boq_id: string
          cost_price: number
          created_at: string
          derivation: Json | null
          description: string
          discount_pct: number
          firm_id: string
          gst_rate: number
          id: string
          is_optional: boolean
          labour_activity_id: string | null
          margin_pct: number | null
          module_instance_id: string | null
          order_index: number
          product_id: string | null
          quantity: number
          rate: number
          rate_card_id: string | null
          section_id: string | null
          selling_price: number
          sku_id: string | null
          source: Database["public"]["Enums"]["boq_line_source"]
          uom: Database["public"]["Enums"]["uom"]
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          boq_id: string
          cost_price: number
          created_at?: string
          derivation?: Json | null
          description: string
          discount_pct?: number
          firm_id: string
          gst_rate?: number
          id?: string
          is_optional?: boolean
          labour_activity_id?: string | null
          margin_pct?: number | null
          module_instance_id?: string | null
          order_index?: number
          product_id?: string | null
          quantity: number
          rate: number
          rate_card_id?: string | null
          section_id?: string | null
          selling_price: number
          sku_id?: string | null
          source?: Database["public"]["Enums"]["boq_line_source"]
          uom: Database["public"]["Enums"]["uom"]
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          boq_id?: string
          cost_price?: number
          created_at?: string
          derivation?: Json | null
          description?: string
          discount_pct?: number
          firm_id?: string
          gst_rate?: number
          id?: string
          is_optional?: boolean
          labour_activity_id?: string | null
          margin_pct?: number | null
          module_instance_id?: string | null
          order_index?: number
          product_id?: string | null
          quantity?: number
          rate?: number
          rate_card_id?: string | null
          section_id?: string | null
          selling_price?: number
          sku_id?: string | null
          source?: Database["public"]["Enums"]["boq_line_source"]
          uom?: Database["public"]["Enums"]["uom"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boq_line_items_boq_id_fkey"
            columns: ["boq_id"]
            isOneToOne: false
            referencedRelation: "boq_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_line_items_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_line_items_labour_activity_id_fkey"
            columns: ["labour_activity_id"]
            isOneToOne: false
            referencedRelation: "labour_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_line_items_module_instance_id_fkey"
            columns: ["module_instance_id"]
            isOneToOne: false
            referencedRelation: "module_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_line_items_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "rate_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_line_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "boq_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_line_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      boq_revisions: {
        Row: {
          boq_id: string
          created_at: string
          created_by: string | null
          diff: Json | null
          firm_id: string
          id: string
          reason: string | null
          snapshot: Json
          totals: Json | null
          version: number
        }
        Insert: {
          boq_id: string
          created_at?: string
          created_by?: string | null
          diff?: Json | null
          firm_id: string
          id?: string
          reason?: string | null
          snapshot: Json
          totals?: Json | null
          version: number
        }
        Update: {
          boq_id?: string
          created_at?: string
          created_by?: string | null
          diff?: Json | null
          firm_id?: string
          id?: string
          reason?: string | null
          snapshot?: Json
          totals?: Json | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "boq_revisions_boq_id_fkey"
            columns: ["boq_id"]
            isOneToOne: false
            referencedRelation: "boq_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_revisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_revisions_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      boq_sections: {
        Row: {
          boq_id: string
          created_at: string
          firm_id: string
          id: string
          name: string
          order_index: number
          room_id: string | null
        }
        Insert: {
          boq_id: string
          created_at?: string
          firm_id: string
          id?: string
          name: string
          order_index?: number
          room_id?: string | null
        }
        Update: {
          boq_id?: string
          created_at?: string
          firm_id?: string
          id?: string
          name?: string
          order_index?: number
          room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boq_sections_boq_id_fkey"
            columns: ["boq_id"]
            isOneToOne: false
            referencedRelation: "boq_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_sections_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boq_sections_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      calibration_runs: {
        Row: {
          damping: number | null
          firm_id: string
          id: string
          metric: string
          new_value: number | null
          old_value: number | null
          product_id: string | null
          region_id: string | null
          run_at: string
          sample_size: number | null
        }
        Insert: {
          damping?: number | null
          firm_id: string
          id?: string
          metric: string
          new_value?: number | null
          old_value?: number | null
          product_id?: string | null
          region_id?: string | null
          run_at?: string
          sample_size?: number | null
        }
        Update: {
          damping?: number | null
          firm_id?: string
          id?: string
          metric?: string
          new_value?: number | null
          old_value?: number | null
          product_id?: string | null
          region_id?: string | null
          run_at?: string
          sample_size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "calibration_runs_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calibration_runs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calibration_runs_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_categories: {
        Row: {
          created_at: string
          firm_id: string | null
          icon: string | null
          id: string
          kind: Database["public"]["Enums"]["catalog_kind"]
          name: string
          order_index: number
          parent_id: string | null
          path: unknown
        }
        Insert: {
          created_at?: string
          firm_id?: string | null
          icon?: string | null
          id?: string
          kind: Database["public"]["Enums"]["catalog_kind"]
          name: string
          order_index?: number
          parent_id?: string | null
          path: unknown
        }
        Update: {
          created_at?: string
          firm_id?: string | null
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["catalog_kind"]
          name?: string
          order_index?: number
          parent_id?: string | null
          path?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "catalog_categories_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_embeddings: {
        Row: {
          embedding: string | null
          product_id: string
          updated_at: string
        }
        Insert: {
          embedding?: string | null
          product_id: string
          updated_at?: string
        }
        Update: {
          embedding?: string | null
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_embeddings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_products: {
        Row: {
          attributes: Json
          base_uom: Database["public"]["Enums"]["uom"]
          category_id: string
          created_at: string
          firm_id: string | null
          gst_rate: number
          hsn_code: string | null
          id: string
          install_loss: number
          is_active: boolean
          name: string
          packaging_loss: number
          secondary_uom: Database["public"]["Enums"]["uom"] | null
          uom_conversion: number | null
          updated_at: string
          waste_factor: number
        }
        Insert: {
          attributes?: Json
          base_uom: Database["public"]["Enums"]["uom"]
          category_id: string
          created_at?: string
          firm_id?: string | null
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          install_loss?: number
          is_active?: boolean
          name: string
          packaging_loss?: number
          secondary_uom?: Database["public"]["Enums"]["uom"] | null
          uom_conversion?: number | null
          updated_at?: string
          waste_factor?: number
        }
        Update: {
          attributes?: Json
          base_uom?: Database["public"]["Enums"]["uom"]
          category_id?: string
          created_at?: string
          firm_id?: string | null
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          install_loss?: number
          is_active?: boolean
          name?: string
          packaging_loss?: number
          secondary_uom?: Database["public"]["Enums"]["uom"] | null
          uom_conversion?: number | null
          updated_at?: string
          waste_factor?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_products_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_entries: {
        Row: {
          amount: number
          boq_line_id: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          firm_id: string
          id: string
          po_id: string | null
          project_id: string
          quantity: number | null
          receipt_url: string | null
          uom: Database["public"]["Enums"]["uom"] | null
          vendor_name: string | null
        }
        Insert: {
          amount: number
          boq_line_id?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          entry_date?: string
          firm_id: string
          id?: string
          po_id?: string | null
          project_id: string
          quantity?: number | null
          receipt_url?: string | null
          uom?: Database["public"]["Enums"]["uom"] | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          boq_line_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          firm_id?: string
          id?: string
          po_id?: string | null
          project_id?: string
          quantity?: number | null
          receipt_url?: string | null
          uom?: Database["public"]["Enums"]["uom"] | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_entries_boq_line_id_fkey"
            columns: ["boq_line_id"]
            isOneToOne: false
            referencedRelation: "boq_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activity_log: {
        Row: {
          action: string
          action_label: string | null
          created_at: string
          details: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          firm_id: string
          id: string
          module: string
          previous_value: string | null
          remarks: string | null
          updated_value: string | null
          user_id: string
        }
        Insert: {
          action: string
          action_label?: string | null
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          firm_id: string
          id: string
          module: string
          previous_value?: string | null
          remarks?: string | null
          updated_value?: string | null
          user_id: string
        }
        Update: {
          action?: string
          action_label?: string | null
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          firm_id?: string
          id?: string
          module?: string
          previous_value?: string | null
          remarks?: string | null
          updated_value?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activity_log_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_ad_accounts: {
        Row: {
          connected_by: string | null
          created_at: string
          currency: string
          external_account_id: string | null
          firm_id: string
          id: string
          last_synced_at: string | null
          name: string
          provider: string
          status: string
          sync_interval_minutes: number
          updated_at: string
        }
        Insert: {
          connected_by?: string | null
          created_at?: string
          currency?: string
          external_account_id?: string | null
          firm_id: string
          id?: string
          last_synced_at?: string | null
          name: string
          provider?: string
          status?: string
          sync_interval_minutes?: number
          updated_at?: string
        }
        Update: {
          connected_by?: string | null
          created_at?: string
          currency?: string
          external_account_id?: string | null
          firm_id?: string
          id?: string
          last_synced_at?: string | null
          name?: string
          provider?: string
          status?: string
          sync_interval_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_ad_accounts_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_ad_campaigns: {
        Row: {
          ad_account_id: string
          created_at: string
          daily_budget: number | null
          external_id: string | null
          firm_id: string
          id: string
          lifetime_budget: number | null
          name: string
          objective: string | null
          provider: string
          start_date: string | null
          status: string
          stop_date: string | null
        }
        Insert: {
          ad_account_id: string
          created_at?: string
          daily_budget?: number | null
          external_id?: string | null
          firm_id: string
          id?: string
          lifetime_budget?: number | null
          name: string
          objective?: string | null
          provider?: string
          start_date?: string | null
          status?: string
          stop_date?: string | null
        }
        Update: {
          ad_account_id?: string
          created_at?: string
          daily_budget?: number | null
          external_id?: string | null
          firm_id?: string
          id?: string
          lifetime_budget?: number | null
          name?: string
          objective?: string | null
          provider?: string
          start_date?: string | null
          status?: string
          stop_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_ad_campaigns_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "crm_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ad_campaigns_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_ad_insights: {
        Row: {
          ad_account_id: string | null
          ad_id: string | null
          ad_set_id: string | null
          campaign_id: string | null
          clicks: number
          created_at: string
          date: string
          firm_id: string
          frequency: number
          id: string
          impressions: number
          leads: number
          level: string
          link_clicks: number
          platform: string | null
          provider: string
          reach: number
          region: string | null
          spend: number
          video_views: number
        }
        Insert: {
          ad_account_id?: string | null
          ad_id?: string | null
          ad_set_id?: string | null
          campaign_id?: string | null
          clicks?: number
          created_at?: string
          date: string
          firm_id: string
          frequency?: number
          id?: string
          impressions?: number
          leads?: number
          level: string
          link_clicks?: number
          platform?: string | null
          provider?: string
          reach?: number
          region?: string | null
          spend?: number
          video_views?: number
        }
        Update: {
          ad_account_id?: string | null
          ad_id?: string | null
          ad_set_id?: string | null
          campaign_id?: string | null
          clicks?: number
          created_at?: string
          date?: string
          firm_id?: string
          frequency?: number
          id?: string
          impressions?: number
          leads?: number
          level?: string
          link_clicks?: number
          platform?: string | null
          provider?: string
          reach?: number
          region?: string | null
          spend?: number
          video_views?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_ad_insights_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "crm_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ad_insights_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "crm_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ad_insights_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "crm_ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ad_insights_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ad_insights_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_ad_leads: {
        Row: {
          ad_account_id: string | null
          ad_id: string | null
          ad_set_id: string | null
          campaign_id: string | null
          contact_id: string | null
          created_at: string
          crm_lead_id: string | null
          email: string | null
          external_lead_id: string | null
          firm_id: string
          form_id: string | null
          full_name: string | null
          id: string
          phone: string | null
          provider: string
          raw_fields: Json
          received_at: string
          status: string
        }
        Insert: {
          ad_account_id?: string | null
          ad_id?: string | null
          ad_set_id?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          crm_lead_id?: string | null
          email?: string | null
          external_lead_id?: string | null
          firm_id: string
          form_id?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          provider?: string
          raw_fields?: Json
          received_at?: string
          status?: string
        }
        Update: {
          ad_account_id?: string | null
          ad_id?: string | null
          ad_set_id?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          crm_lead_id?: string | null
          email?: string | null
          external_lead_id?: string | null
          firm_id?: string
          form_id?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          provider?: string
          raw_fields?: Json
          received_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_ad_leads_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "crm_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ad_leads_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "crm_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ad_leads_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "crm_ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ad_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ad_leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ad_leads_crm_lead_id_fkey"
            columns: ["crm_lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ad_leads_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_ad_sets: {
        Row: {
          campaign_id: string
          created_at: string
          daily_budget: number | null
          external_id: string | null
          firm_id: string
          id: string
          name: string
          optimization_goal: string | null
          status: string
          targeting: Json
        }
        Insert: {
          campaign_id: string
          created_at?: string
          daily_budget?: number | null
          external_id?: string | null
          firm_id: string
          id?: string
          name: string
          optimization_goal?: string | null
          status?: string
          targeting?: Json
        }
        Update: {
          campaign_id?: string
          created_at?: string
          daily_budget?: number | null
          external_id?: string | null
          firm_id?: string
          id?: string
          name?: string
          optimization_goal?: string | null
          status?: string
          targeting?: Json
        }
        Relationships: [
          {
            foreignKeyName: "crm_ad_sets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ad_sets_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_ads: {
        Row: {
          ad_set_id: string
          campaign_id: string
          created_at: string
          creative: Json
          external_id: string | null
          firm_id: string
          id: string
          name: string
          status: string
        }
        Insert: {
          ad_set_id: string
          campaign_id: string
          created_at?: string
          creative?: Json
          external_id?: string | null
          firm_id: string
          id?: string
          name: string
          status?: string
        }
        Update: {
          ad_set_id?: string
          campaign_id?: string
          created_at?: string
          creative?: Json
          external_id?: string | null
          firm_id?: string
          id?: string
          name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_ads_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "crm_ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ads_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_comm_channels: {
        Row: {
          category: string
          config: Json
          connected_at: string | null
          connected_by: string | null
          created_at: string
          display_name: string | null
          firm_id: string
          id: string
          provider: string
          status: string
        }
        Insert: {
          category: string
          config?: Json
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          display_name?: string | null
          firm_id: string
          id?: string
          provider: string
          status?: string
        }
        Update: {
          category?: string
          config?: Json
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          display_name?: string | null
          firm_id?: string
          id?: string
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_comm_channels_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_comments: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          firm_id: string
          id: string
          is_pinned: boolean
          parent_id: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          firm_id: string
          id: string
          is_pinned?: boolean
          parent_id?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          firm_id?: string
          id?: string
          is_pinned?: boolean
          parent_id?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_comments_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          firm_id: string
          first_seen: string
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          tags: string[]
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          firm_id: string
          first_seen?: string
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          tags?: string[]
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          firm_id?: string
          first_seen?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_cost_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          date: string | null
          description: string | null
          firm_id: string
          id: string
          project_id: string
          receipt_url: string | null
          vendor_name: string | null
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          created_by?: string | null
          date?: string | null
          description?: string | null
          firm_id: string
          id: string
          project_id: string
          receipt_url?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          date?: string | null
          description?: string | null
          firm_id?: string
          id?: string
          project_id?: string
          receipt_url?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_cost_entries_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_feature_flags: {
        Row: {
          created_at: string
          enabled: boolean
          firm_id: string
          id: string
          key: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          firm_id: string
          id?: string
          key: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          firm_id?: string
          id?: string
          key?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_feature_flags_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_interactions: {
        Row: {
          channel: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          direction: string | null
          external_id: string | null
          firm_id: string
          id: string
          lead_id: string
          logged_by: string | null
          next_steps: string | null
          outcome: string | null
          scheduled_at: string | null
          subject: string | null
          type: string
        }
        Insert: {
          channel?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          direction?: string | null
          external_id?: string | null
          firm_id: string
          id: string
          lead_id: string
          logged_by?: string | null
          next_steps?: string | null
          outcome?: string | null
          scheduled_at?: string | null
          subject?: string | null
          type: string
        }
        Update: {
          channel?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          direction?: string | null
          external_id?: string | null
          firm_id?: string
          id?: string
          lead_id?: string
          logged_by?: string | null
          next_steps?: string | null
          outcome?: string | null
          scheduled_at?: string | null
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_interactions_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_quotations: {
        Row: {
          client_response: string | null
          created_at: string
          created_by: string | null
          design_fees: number
          estimated_cost: number
          exclusions: string | null
          firm_id: string
          id: string
          inclusions: string | null
          lead_id: string
          other_charges: number
          quotation_number: string
          scope_of_work: string | null
          sent_at: string | null
          status: string
          supervision_fees: number
          terms_conditions: string | null
          total_amount: number
          updated_at: string
          validity_days: number
          version: number
        }
        Insert: {
          client_response?: string | null
          created_at?: string
          created_by?: string | null
          design_fees?: number
          estimated_cost?: number
          exclusions?: string | null
          firm_id: string
          id: string
          inclusions?: string | null
          lead_id: string
          other_charges?: number
          quotation_number: string
          scope_of_work?: string | null
          sent_at?: string | null
          status?: string
          supervision_fees?: number
          terms_conditions?: string | null
          total_amount?: number
          updated_at?: string
          validity_days?: number
          version?: number
        }
        Update: {
          client_response?: string | null
          created_at?: string
          created_by?: string | null
          design_fees?: number
          estimated_cost?: number
          exclusions?: string | null
          firm_id?: string
          id?: string
          inclusions?: string | null
          lead_id?: string
          other_charges?: number
          quotation_number?: string
          scope_of_work?: string | null
          sent_at?: string | null
          status?: string
          supervision_fees?: number
          terms_conditions?: string | null
          total_amount?: number
          updated_at?: string
          validity_days?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_quotations_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          assigned_to: string | null
          client_company: string | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          client_whatsapp: string | null
          contact_id: string | null
          converted_project_id: string | null
          created_at: string
          created_by: string | null
          estimated_area: number | null
          estimated_budget: number | null
          expected_start_date: string | null
          firm_id: string
          id: string
          inquiry_date: string | null
          last_contact_date: string | null
          lost_reason: string | null
          lost_reason_category: string | null
          next_follow_up: string | null
          notes: string | null
          prev_status: string | null
          priority: string
          project_location: string | null
          project_requirements: string | null
          project_type: string | null
          source: string | null
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_company?: string | null
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          client_whatsapp?: string | null
          contact_id?: string | null
          converted_project_id?: string | null
          created_at?: string
          created_by?: string | null
          estimated_area?: number | null
          estimated_budget?: number | null
          expected_start_date?: string | null
          firm_id: string
          id: string
          inquiry_date?: string | null
          last_contact_date?: string | null
          lost_reason?: string | null
          lost_reason_category?: string | null
          next_follow_up?: string | null
          notes?: string | null
          prev_status?: string | null
          priority?: string
          project_location?: string | null
          project_requirements?: string | null
          project_type?: string | null
          source?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_company?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          client_whatsapp?: string | null
          contact_id?: string | null
          converted_project_id?: string | null
          created_at?: string
          created_by?: string | null
          estimated_area?: number | null
          estimated_budget?: number | null
          expected_start_date?: string | null
          firm_id?: string
          id?: string
          inquiry_date?: string | null
          last_contact_date?: string | null
          lost_reason?: string | null
          lost_reason_category?: string | null
          next_follow_up?: string | null
          notes?: string | null
          prev_status?: string | null
          priority?: string
          project_location?: string | null
          project_requirements?: string | null
          project_type?: string | null
          source?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_marketing_attribution: {
        Row: {
          ad_account_id: string | null
          ad_id: string | null
          ad_lead_id: string | null
          ad_set_id: string | null
          campaign_id: string | null
          converted_project_id: string | null
          created_at: string
          firm_id: string
          first_touch_at: string | null
          id: string
          lead_id: string | null
          provider: string
          quotation_id: string | null
          region: string | null
          revenue: number
          salesperson_id: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          ad_account_id?: string | null
          ad_id?: string | null
          ad_lead_id?: string | null
          ad_set_id?: string | null
          campaign_id?: string | null
          converted_project_id?: string | null
          created_at?: string
          firm_id: string
          first_touch_at?: string | null
          id?: string
          lead_id?: string | null
          provider?: string
          quotation_id?: string | null
          region?: string | null
          revenue?: number
          salesperson_id?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string | null
          ad_id?: string | null
          ad_lead_id?: string | null
          ad_set_id?: string | null
          campaign_id?: string | null
          converted_project_id?: string | null
          created_at?: string
          firm_id?: string
          first_touch_at?: string | null
          id?: string
          lead_id?: string | null
          provider?: string
          quotation_id?: string | null
          region?: string | null
          revenue?: number
          salesperson_id?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_marketing_attribution_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "crm_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_marketing_attribution_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "crm_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_marketing_attribution_ad_lead_id_fkey"
            columns: ["ad_lead_id"]
            isOneToOne: false
            referencedRelation: "crm_ad_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_marketing_attribution_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "crm_ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_marketing_attribution_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_marketing_attribution_converted_project_id_fkey"
            columns: ["converted_project_id"]
            isOneToOne: false
            referencedRelation: "crm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_marketing_attribution_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_marketing_attribution_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_marketing_attribution_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "crm_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_milestones: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          created_at: string
          delay_reason: string | null
          description: string | null
          firm_id: string
          id: string
          name: string
          order_index: number
          planned_end: string | null
          planned_start: string | null
          project_id: string
          status: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          delay_reason?: string | null
          description?: string | null
          firm_id: string
          id: string
          name: string
          order_index?: number
          planned_end?: string | null
          planned_start?: string | null
          project_id: string
          status?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          delay_reason?: string | null
          description?: string | null
          firm_id?: string
          id?: string
          name?: string
          order_index?: number
          planned_end?: string | null
          planned_start?: string | null
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_milestones_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_notifications: {
        Row: {
          created_at: string
          firm_id: string
          id: string
          link: string | null
          message: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          firm_id: string
          id: string
          link?: string | null
          message?: string | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          firm_id?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_notifications_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_payment_plans: {
        Row: {
          client_signed_off: boolean
          created_at: string
          firm_id: string
          id: string
          project_id: string
          signed_off_at: string | null
          split_count: number
          total_amount: number
        }
        Insert: {
          client_signed_off?: boolean
          created_at?: string
          firm_id: string
          id: string
          project_id: string
          signed_off_at?: string | null
          split_count?: number
          total_amount?: number
        }
        Update: {
          client_signed_off?: boolean
          created_at?: string
          firm_id?: string
          id?: string
          project_id?: string
          signed_off_at?: string | null
          split_count?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_payment_plans_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_payment_splits: {
        Row: {
          amount: number
          created_at: string
          firm_id: string
          gst_amount: number
          gst_rate: number
          id: string
          payment_plan_id: string
          project_id: string
          split_number: number
          status: string
          total_with_gst: number
          trigger_date: string | null
          trigger_milestone_id: string | null
          trigger_type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          firm_id: string
          gst_amount?: number
          gst_rate?: number
          id: string
          payment_plan_id: string
          project_id: string
          split_number: number
          status?: string
          total_with_gst?: number
          trigger_date?: string | null
          trigger_milestone_id?: string | null
          trigger_type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          firm_id?: string
          gst_amount?: number
          gst_rate?: number
          id?: string
          payment_plan_id?: string
          project_id?: string
          split_number?: number
          status?: string
          total_with_gst?: number
          trigger_date?: string | null
          trigger_milestone_id?: string | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_payment_splits_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_payments_received: {
        Row: {
          amount: number
          created_at: string
          firm_id: string
          id: string
          marked_by: string | null
          mode: string
          payment_split_id: string
          project_id: string
          received_date: string | null
          reference: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          firm_id: string
          id: string
          marked_by?: string | null
          mode?: string
          payment_split_id: string
          project_id: string
          received_date?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          firm_id?: string
          id?: string
          marked_by?: string | null
          mode?: string
          payment_split_id?: string
          project_id?: string
          received_date?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_payments_received_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipeline_stages: {
        Row: {
          category: string
          color: string | null
          created_at: string
          enabled: boolean
          firm_id: string
          id: string
          is_lost: boolean
          is_won: boolean
          key: string
          label: string
          order_index: number
        }
        Insert: {
          category?: string
          color?: string | null
          created_at?: string
          enabled?: boolean
          firm_id: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          key: string
          label: string
          order_index?: number
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string
          enabled?: boolean
          firm_id?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          key?: string
          label?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipeline_stages_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          firm_id: string
          full_name: string
          id: string
          phone: string | null
          role: string
          role_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          firm_id: string
          full_name: string
          id: string
          phone?: string | null
          role: string
          role_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          firm_id?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: string
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_profiles_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "crm_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_project_assignments: {
        Row: {
          assigned_at: string
          firm_id: string
          id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          firm_id: string
          id: string
          project_id: string
          role: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          firm_id?: string
          id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_project_assignments_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_project_documents: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          firm_id: string
          id: string
          name: string
          project_id: string
          uploaded_by: string | null
          version: number | null
          visible_to_client: boolean
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          firm_id: string
          id: string
          name: string
          project_id: string
          uploaded_by?: string | null
          version?: number | null
          visible_to_client?: boolean
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          firm_id?: string
          id?: string
          name?: string
          project_id?: string
          uploaded_by?: string | null
          version?: number | null
          visible_to_client?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "crm_project_documents_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_project_vendors: {
        Row: {
          added_by: string | null
          category: string
          company_name: string
          contact_person: string | null
          contract_value: number | null
          created_at: string
          email: string | null
          end_date: string | null
          firm_id: string
          gstin: string | null
          id: string
          notes: string | null
          phone: string | null
          project_id: string
          rating: number | null
          scope_of_work: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          category: string
          company_name: string
          contact_person?: string | null
          contract_value?: number | null
          created_at?: string
          email?: string | null
          end_date?: string | null
          firm_id: string
          gstin?: string | null
          id: string
          notes?: string | null
          phone?: string | null
          project_id: string
          rating?: number | null
          scope_of_work?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          category?: string
          company_name?: string
          contact_person?: string | null
          contract_value?: number | null
          created_at?: string
          email?: string | null
          end_date?: string | null
          firm_id?: string
          gstin?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          project_id?: string
          rating?: number | null
          scope_of_work?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_project_vendors_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_projects: {
        Row: {
          actual_end_date: string | null
          address: string | null
          client_id: string | null
          created_at: string
          description: string | null
          estimated_end_date: string | null
          firm_id: string
          id: string
          name: string
          project_value: number
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          address?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          estimated_end_date?: string | null
          firm_id: string
          id: string
          name: string
          project_value?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          address?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          estimated_end_date?: string | null
          firm_id?: string
          id?: string
          name?: string
          project_value?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_projects_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_role_permissions: {
        Row: {
          actions: string[]
          created_at: string
          firm_id: string
          id: string
          module: string
          role_id: string
        }
        Insert: {
          actions?: string[]
          created_at?: string
          firm_id: string
          id: string
          module: string
          role_id: string
        }
        Update: {
          actions?: string[]
          created_at?: string
          firm_id?: string
          id?: string
          module?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_role_permissions_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "crm_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_roles: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          enabled: boolean
          firm_id: string
          id: string
          is_admin: boolean
          is_system: boolean
          key: string
          name: string
          scope: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          firm_id: string
          id: string
          is_admin?: boolean
          is_system?: boolean
          key: string
          name: string
          scope?: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          firm_id?: string
          id?: string
          is_admin?: boolean
          is_system?: boolean
          key?: string
          name?: string
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_roles_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_site_updates: {
        Row: {
          created_at: string
          date: string | null
          firm_id: string
          id: string
          note: string | null
          photo_urls: string[]
          posted_by: string | null
          project_id: string
        }
        Insert: {
          created_at?: string
          date?: string | null
          firm_id: string
          id: string
          note?: string | null
          photo_urls?: string[]
          posted_by?: string | null
          project_id: string
        }
        Update: {
          created_at?: string
          date?: string | null
          firm_id?: string
          id?: string
          note?: string | null
          photo_urls?: string[]
          posted_by?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_site_updates_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_sync_runs: {
        Row: {
          ad_account_id: string | null
          created_at: string
          error: string | null
          finished_at: string | null
          firm_id: string
          id: string
          provider: string
          rows_upserted: number
          started_at: string
          status: string
          trigger: string
        }
        Insert: {
          ad_account_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          firm_id: string
          id?: string
          provider?: string
          rows_upserted?: number
          started_at?: string
          status?: string
          trigger?: string
        }
        Update: {
          ad_account_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          firm_id?: string
          id?: string
          provider?: string
          rows_upserted?: number
          started_at?: string
          status?: string
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_sync_runs_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "crm_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_sync_runs_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_tiers: {
        Row: {
          category_id: string | null
          created_at: string
          discount_pct: number
          firm_id: string
          id: string
          min_qty: number
          sku_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          discount_pct: number
          firm_id: string
          id?: string
          min_qty: number
          sku_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          discount_pct?: number
          firm_id?: string
          id?: string
          min_qty?: number
          sku_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_tiers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_tiers_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_tiers_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_subscriptions: {
        Row: {
          created_at: string
          current_period_ends_at: string | null
          firm_id: string
          id: string
          plan_id: string
          seats_purchased: number
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_ends_at?: string | null
          firm_id: string
          id?: string
          plan_id: string
          seats_purchased?: number
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_ends_at?: string | null
          firm_id?: string
          id?: string
          plan_id?: string
          seats_purchased?: number
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_subscriptions_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firm_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      firms: {
        Row: {
          address: string | null
          blacklist_reason: string | null
          blacklisted_at: string | null
          created_at: string
          deleted_at: string | null
          gstin: string | null
          id: string
          logo_url: string | null
          name: string
          payment_split_default: number
        }
        Insert: {
          address?: string | null
          blacklist_reason?: string | null
          blacklisted_at?: string | null
          created_at?: string
          deleted_at?: string | null
          gstin?: string | null
          id?: string
          logo_url?: string | null
          name: string
          payment_split_default?: number
        }
        Update: {
          address?: string | null
          blacklist_reason?: string | null
          blacklisted_at?: string | null
          created_at?: string
          deleted_at?: string | null
          gstin?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          payment_split_default?: number
        }
        Relationships: []
      }
      labour_activities: {
        Row: {
          base_uom: Database["public"]["Enums"]["uom"]
          code: string
          created_at: string
          firm_id: string | null
          id: string
          name: string
          trade: string | null
        }
        Insert: {
          base_uom: Database["public"]["Enums"]["uom"]
          code: string
          created_at?: string
          firm_id?: string | null
          id?: string
          name: string
          trade?: string | null
        }
        Update: {
          base_uom?: Database["public"]["Enums"]["uom"]
          code?: string
          created_at?: string
          firm_id?: string | null
          id?: string
          name?: string
          trade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "labour_activities_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          client_email: string | null
          client_name: string
          client_phone: string
          converted_project_id: string | null
          created_at: string
          created_by: string | null
          estimated_area: number | null
          estimated_budget: number | null
          firm_id: string
          id: string
          inquiry_date: string
          priority: string | null
          project_location: string | null
          project_type: string | null
          region_id: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_email?: string | null
          client_name: string
          client_phone: string
          converted_project_id?: string | null
          created_at?: string
          created_by?: string | null
          estimated_area?: number | null
          estimated_budget?: number | null
          firm_id: string
          id?: string
          inquiry_date?: string
          priority?: string | null
          project_location?: string | null
          project_type?: string | null
          region_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string
          converted_project_id?: string | null
          created_at?: string
          created_by?: string | null
          estimated_area?: number | null
          estimated_budget?: number | null
          firm_id?: string
          id?: string
          inquiry_date?: string
          priority?: string | null
          project_location?: string | null
          project_type?: string | null
          region_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_project_id_fkey"
            columns: ["converted_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_region_fk"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      margin_policies: {
        Row: {
          category_id: string | null
          created_at: string
          firm_id: string
          grade: Database["public"]["Enums"]["quality_grade"] | null
          id: string
          margin_floor_pct: number
          overhead_pct: number
          target_margin_pct: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          firm_id: string
          grade?: Database["public"]["Enums"]["quality_grade"] | null
          id?: string
          margin_floor_pct?: number
          overhead_pct?: number
          target_margin_pct: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          firm_id?: string
          grade?: Database["public"]["Enums"]["quality_grade"] | null
          id?: string
          margin_floor_pct?: number
          overhead_pct?: number
          target_margin_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "margin_policies_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "margin_policies_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      material_request_items: {
        Row: {
          description: string | null
          firm_id: string
          id: string
          material_id: string | null
          material_name: string
          order_index: number
          quantity: number
          request_id: string
          required_by: string | null
          uom: string | null
        }
        Insert: {
          description?: string | null
          firm_id: string
          id?: string
          material_id?: string | null
          material_name?: string
          order_index?: number
          quantity?: number
          request_id: string
          required_by?: string | null
          uom?: string | null
        }
        Update: {
          description?: string | null
          firm_id?: string
          id?: string
          material_id?: string | null
          material_name?: string
          order_index?: number
          quantity?: number
          request_id?: string
          required_by?: string | null
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      material_requests: {
        Row: {
          client_requirements: Json
          created_at: string
          created_by: string | null
          engineer_id: string | null
          firm_id: string
          id: string
          notes: string | null
          plant_description: string | null
          project_id: string | null
          request_date: string
          request_number: string
          status: string
          total_days: number | null
          updated_at: string
        }
        Insert: {
          client_requirements?: Json
          created_at?: string
          created_by?: string | null
          engineer_id?: string | null
          firm_id: string
          id?: string
          notes?: string | null
          plant_description?: string | null
          project_id?: string | null
          request_date?: string
          request_number: string
          status?: string
          total_days?: number | null
          updated_at?: string
        }
        Update: {
          client_requirements?: Json
          created_at?: string
          created_by?: string | null
          engineer_id?: string | null
          firm_id?: string
          id?: string
          notes?: string | null
          plant_description?: string | null
          project_id?: string | null
          request_date?: string
          request_number?: string
          status?: string
          total_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      module_instances: {
        Row: {
          created_at: string
          created_by: string | null
          firm_id: string
          grade: Database["public"]["Enums"]["quality_grade"]
          id: string
          label: string
          params: Json
          project_id: string
          room_id: string | null
          template_id: string
          template_version: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          firm_id: string
          grade?: Database["public"]["Enums"]["quality_grade"]
          id?: string
          label: string
          params?: Json
          project_id: string
          room_id?: string | null
          template_id: string
          template_version: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          firm_id?: string
          grade?: Database["public"]["Enums"]["quality_grade"]
          id?: string
          label?: string
          params?: Json
          project_id?: string
          room_id?: string | null
          template_id?: string
          template_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_instances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_instances_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_instances_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_instances_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "module_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      module_rules: {
        Row: {
          condition: string | null
          created_at: string
          id: string
          label: string
          labour_activity_id: string | null
          notes: string | null
          output_kind: Database["public"]["Enums"]["module_output_kind"]
          product_id: string | null
          qty_formula: string
          seq: number
          template_id: string
          uom: Database["public"]["Enums"]["uom"]
        }
        Insert: {
          condition?: string | null
          created_at?: string
          id?: string
          label: string
          labour_activity_id?: string | null
          notes?: string | null
          output_kind: Database["public"]["Enums"]["module_output_kind"]
          product_id?: string | null
          qty_formula: string
          seq: number
          template_id: string
          uom: Database["public"]["Enums"]["uom"]
        }
        Update: {
          condition?: string | null
          created_at?: string
          id?: string
          label?: string
          labour_activity_id?: string | null
          notes?: string | null
          output_kind?: Database["public"]["Enums"]["module_output_kind"]
          product_id?: string | null
          qty_formula?: string
          seq?: number
          template_id?: string
          uom?: Database["public"]["Enums"]["uom"]
        }
        Relationships: [
          {
            foreignKeyName: "module_rules_labour_activity_id_fkey"
            columns: ["labour_activity_id"]
            isOneToOne: false
            referencedRelation: "labour_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "module_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      module_templates: {
        Row: {
          category: string
          code: string
          created_at: string
          derived_vars: Json
          description: string | null
          firm_id: string | null
          id: string
          is_active: boolean
          name: string
          param_schema: Json
          updated_at: string
          version: number
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          derived_vars?: Json
          description?: string | null
          firm_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          param_schema?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          derived_vars?: Json
          description?: string | null
          firm_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          param_schema?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "module_templates_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_milestones: {
        Row: {
          amount: number
          created_at: string
          firm_id: string
          gst_amount: number
          gst_rate: number
          id: string
          label: string
          percent: number
          schedule_id: string
          split_number: number
          status: string
          total_with_gst: number
          trigger_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          firm_id: string
          gst_amount?: number
          gst_rate?: number
          id?: string
          label: string
          percent: number
          schedule_id: string
          split_number: number
          status?: string
          total_with_gst: number
          trigger_type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          firm_id?: string
          gst_amount?: number
          gst_rate?: number
          id?: string
          label?: string
          percent?: number
          schedule_id?: string
          split_number?: number
          status?: string
          total_with_gst?: number
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_milestones_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_milestones_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "payment_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_schedules: {
        Row: {
          boq_id: string | null
          client_signed_off: boolean
          created_at: string
          firm_id: string
          id: string
          project_id: string | null
          quotation_id: string | null
          signed_at: string
          signed_name: string | null
          split_count: number
          total_amount: number
        }
        Insert: {
          boq_id?: string | null
          client_signed_off?: boolean
          created_at?: string
          firm_id: string
          id?: string
          project_id?: string | null
          quotation_id?: string | null
          signed_at?: string
          signed_name?: string | null
          split_count: number
          total_amount: number
        }
        Update: {
          boq_id?: string | null
          client_signed_off?: boolean
          created_at?: string
          firm_id?: string
          id?: string
          project_id?: string | null
          quotation_id?: string | null
          signed_at?: string
          signed_name?: string | null
          split_count?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedules_boq_id_fkey"
            columns: ["boq_id"]
            isOneToOne: false
            referencedRelation: "boq_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      po_line_items: {
        Row: {
          amount: number
          boq_line_id: string | null
          created_at: string
          description: string
          firm_id: string
          id: string
          po_id: string
          qty_received: number
          quantity: number
          rate: number
          sku_id: string | null
          uom: Database["public"]["Enums"]["uom"]
        }
        Insert: {
          amount: number
          boq_line_id?: string | null
          created_at?: string
          description: string
          firm_id: string
          id?: string
          po_id: string
          qty_received?: number
          quantity: number
          rate: number
          sku_id?: string | null
          uom: Database["public"]["Enums"]["uom"]
        }
        Update: {
          amount?: number
          boq_line_id?: string | null
          created_at?: string
          description?: string
          firm_id?: string
          id?: string
          po_id?: string
          qty_received?: number
          quantity?: number
          rate?: number
          sku_id?: string | null
          uom?: Database["public"]["Enums"]["uom"]
        }
        Relationships: [
          {
            foreignKeyName: "po_line_items_boq_line_id_fkey"
            columns: ["boq_line_id"]
            isOneToOne: false
            referencedRelation: "boq_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_line_items_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_line_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_line_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      po_payments: {
        Row: {
          amount: number
          created_at: string
          firm_id: string
          id: string
          payment_date: string
          payment_mode: string | null
          po_id: string
          reference_no: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          firm_id: string
          id?: string
          payment_date?: string
          payment_mode?: string | null
          po_id: string
          reference_no?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          firm_id?: string
          id?: string
          payment_date?: string
          payment_mode?: string | null
          po_id?: string
          reference_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_payments_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_alternates: {
        Row: {
          alternate_sku: string
          id: string
          notes: string | null
          relation: Database["public"]["Enums"]["alternate_relation"]
          sku_id: string
          swap_ratio: number
        }
        Insert: {
          alternate_sku: string
          id?: string
          notes?: string | null
          relation: Database["public"]["Enums"]["alternate_relation"]
          sku_id: string
          swap_ratio?: number
        }
        Update: {
          alternate_sku?: string
          id?: string
          notes?: string | null
          relation?: Database["public"]["Enums"]["alternate_relation"]
          sku_id?: string
          swap_ratio?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_alternates_alternate_sku_fkey"
            columns: ["alternate_sku"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_alternates_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      product_skus: {
        Row: {
          attributes: Json
          barcode: string | null
          brand: string | null
          created_at: string
          id: string
          is_active: boolean
          list_price: number | null
          product_id: string
          quality_grade: Database["public"]["Enums"]["quality_grade"]
          size_spec: string | null
          sku_code: string
        }
        Insert: {
          attributes?: Json
          barcode?: string | null
          brand?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          list_price?: number | null
          product_id: string
          quality_grade?: Database["public"]["Enums"]["quality_grade"]
          size_spec?: string | null
          sku_code: string
        }
        Update: {
          attributes?: Json
          barcode?: string | null
          brand?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          list_price?: number | null
          product_id?: string
          quality_grade?: Database["public"]["Enums"]["quality_grade"]
          size_spec?: string | null
          sku_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_uid: string | null
          avatar_url: string | null
          created_at: string
          email: string
          firm_id: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          auth_uid?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          firm_id: string
          full_name: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          auth_uid?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          firm_id?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stock: {
        Row: {
          created_at: string
          current_stock: number
          firm_id: string
          id: string
          last_po_id: string | null
          last_updated: string | null
          material_id: string | null
          material_name: string
          project_id: string | null
          reorder_level: number
          uom: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_stock?: number
          firm_id: string
          id?: string
          last_po_id?: string | null
          last_updated?: string | null
          material_id?: string | null
          material_name?: string
          project_id?: string | null
          reorder_level?: number
          uom?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_stock?: number
          firm_id?: string
          id?: string
          last_po_id?: string | null
          last_updated?: string | null
          material_id?: string | null
          material_name?: string
          project_id?: string | null
          reorder_level?: number
          uom?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          actual_end_date: string | null
          address: string | null
          client_id: string | null
          created_at: string
          description: string | null
          estimated_end_date: string | null
          firm_id: string
          id: string
          name: string
          priority: Database["public"]["Enums"]["project_priority"]
          project_type: string | null
          project_value: number
          region_id: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          address?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          estimated_end_date?: string | null
          firm_id: string
          id?: string
          name: string
          priority?: Database["public"]["Enums"]["project_priority"]
          project_type?: string | null
          project_value?: number
          region_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          address?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          estimated_end_date?: string | null
          firm_id?: string
          id?: string
          name?: string
          priority?: Database["public"]["Enums"]["project_priority"]
          project_type?: string | null
          project_value?: number
          region_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_region_fk"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          additional_terms: string | null
          admin_notes: string | null
          approval_status: string
          boq_id: string | null
          created_at: string
          created_by: string | null
          credit_days: number | null
          delivery_address: string | null
          delivery_contact_id: string | null
          delivery_contact_phone: string | null
          delivery_date: string | null
          firm_id: string
          freight_charges: number
          gst_amount: number
          gst_rate: number
          gst_type: string
          id: string
          issued_at: string | null
          material_request_id: string | null
          material_type: string | null
          notes: string | null
          order_contact_id: string | null
          order_contact_phone: string | null
          payment_status: string
          po_number: string
          project_id: string | null
          received_at: string | null
          required_by: string | null
          rfq_id: string | null
          status: Database["public"]["Enums"]["po_status"]
          subtotal: number
          supplier_quotation_ref: string | null
          total_amount: number
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          additional_terms?: string | null
          admin_notes?: string | null
          approval_status?: string
          boq_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_days?: number | null
          delivery_address?: string | null
          delivery_contact_id?: string | null
          delivery_contact_phone?: string | null
          delivery_date?: string | null
          firm_id: string
          freight_charges?: number
          gst_amount?: number
          gst_rate?: number
          gst_type?: string
          id?: string
          issued_at?: string | null
          material_request_id?: string | null
          material_type?: string | null
          notes?: string | null
          order_contact_id?: string | null
          order_contact_phone?: string | null
          payment_status?: string
          po_number: string
          project_id?: string | null
          received_at?: string | null
          required_by?: string | null
          rfq_id?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          subtotal?: number
          supplier_quotation_ref?: string | null
          total_amount?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          additional_terms?: string | null
          admin_notes?: string | null
          approval_status?: string
          boq_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_days?: number | null
          delivery_address?: string | null
          delivery_contact_id?: string | null
          delivery_contact_phone?: string | null
          delivery_date?: string | null
          firm_id?: string
          freight_charges?: number
          gst_amount?: number
          gst_rate?: number
          gst_type?: string
          id?: string
          issued_at?: string | null
          material_request_id?: string | null
          material_type?: string | null
          notes?: string | null
          order_contact_id?: string | null
          order_contact_phone?: string | null
          payment_status?: string
          po_number?: string
          project_id?: string | null
          received_at?: string | null
          required_by?: string | null
          rfq_id?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          subtotal?: number
          supplier_quotation_ref?: string | null
          total_amount?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_boq_id_fkey"
            columns: ["boq_id"]
            isOneToOne: false
            referencedRelation: "boq_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          accepted_at: string | null
          accepted_by_name: string | null
          boq_id: string | null
          boq_version: number | null
          created_at: string
          created_by: string | null
          design_fees: number
          discount_pct: number
          doc_type: Database["public"]["Enums"]["quotation_doc_type"]
          exclusions: string | null
          firm_id: string
          gst_amount: number
          id: string
          inclusions: string | null
          lead_id: string | null
          other_charges: number
          project_id: string | null
          quotation_number: string
          scope_of_work: string | null
          selected_options: Json
          share_token: string | null
          snapshot: Json | null
          status: string
          subtotal: number
          supervision_fees: number
          terms_conditions: string | null
          total_amount: number
          updated_at: string
          validity_days: number
          version: number
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_name?: string | null
          boq_id?: string | null
          boq_version?: number | null
          created_at?: string
          created_by?: string | null
          design_fees?: number
          discount_pct?: number
          doc_type?: Database["public"]["Enums"]["quotation_doc_type"]
          exclusions?: string | null
          firm_id: string
          gst_amount?: number
          id?: string
          inclusions?: string | null
          lead_id?: string | null
          other_charges?: number
          project_id?: string | null
          quotation_number: string
          scope_of_work?: string | null
          selected_options?: Json
          share_token?: string | null
          snapshot?: Json | null
          status?: string
          subtotal?: number
          supervision_fees?: number
          terms_conditions?: string | null
          total_amount?: number
          updated_at?: string
          validity_days?: number
          version?: number
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by_name?: string | null
          boq_id?: string | null
          boq_version?: number | null
          created_at?: string
          created_by?: string | null
          design_fees?: number
          discount_pct?: number
          doc_type?: Database["public"]["Enums"]["quotation_doc_type"]
          exclusions?: string | null
          firm_id?: string
          gst_amount?: number
          id?: string
          inclusions?: string | null
          lead_id?: string | null
          other_charges?: number
          project_id?: string | null
          quotation_number?: string
          scope_of_work?: string | null
          selected_options?: Json
          share_token?: string | null
          snapshot?: Json | null
          status?: string
          subtotal?: number
          supervision_fees?: number
          terms_conditions?: string | null
          total_amount?: number
          updated_at?: string
          validity_days?: number
          version?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_boq_id_fkey"
            columns: ["boq_id"]
            isOneToOne: false
            referencedRelation: "boq_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_cards: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          firm_id: string
          id: string
          labour_activity_id: string | null
          notes: string | null
          rate: number
          region_id: string | null
          sku_id: string | null
          source: Database["public"]["Enums"]["rate_source"]
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          firm_id: string
          id?: string
          labour_activity_id?: string | null
          notes?: string | null
          rate: number
          region_id?: string | null
          sku_id?: string | null
          source?: Database["public"]["Enums"]["rate_source"]
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          firm_id?: string
          id?: string
          labour_activity_id?: string | null
          notes?: string | null
          rate?: number
          region_id?: string | null
          sku_id?: string | null
          source?: Database["public"]["Enums"]["rate_source"]
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_cards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_cards_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_cards_labour_activity_id_fkey"
            columns: ["labour_activity_id"]
            isOneToOne: false
            referencedRelation: "labour_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_cards_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_cards_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          availability_risk: number
          created_at: string
          firm_id: string | null
          id: string
          is_active: boolean
          labour_index: number
          logistics_index: number
          material_index: number
          name: string
          state: string | null
        }
        Insert: {
          availability_risk?: number
          created_at?: string
          firm_id?: string | null
          id?: string
          is_active?: boolean
          labour_index?: number
          logistics_index?: number
          material_index?: number
          name: string
          state?: string | null
        }
        Update: {
          availability_risk?: number
          created_at?: string
          firm_id?: string | null
          id?: string
          is_active?: boolean
          labour_index?: number
          logistics_index?: number
          material_index?: number
          name?: string
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regions_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_items: {
        Row: {
          firm_id: string
          id: string
          material_id: string | null
          material_name: string
          order_index: number
          quantity: number
          rfq_id: string
          unit_price: number | null
          uom: string | null
        }
        Insert: {
          firm_id: string
          id?: string
          material_id?: string | null
          material_name?: string
          order_index?: number
          quantity?: number
          rfq_id: string
          unit_price?: number | null
          uom?: string | null
        }
        Update: {
          firm_id?: string
          id?: string
          material_id?: string | null
          material_name?: string
          order_index?: number
          quantity?: number
          rfq_id?: string
          unit_price?: number | null
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_items_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_vendors: {
        Row: {
          firm_id: string
          id: string
          mobile: string | null
          order_index: number
          quoted_amount: number | null
          rfq_id: string
          sent_date: string | null
          status: string
          vendor_id: string | null
          vendor_name: string
        }
        Insert: {
          firm_id: string
          id?: string
          mobile?: string | null
          order_index?: number
          quoted_amount?: number | null
          rfq_id: string
          sent_date?: string | null
          status?: string
          vendor_id?: string | null
          vendor_name?: string
        }
        Update: {
          firm_id?: string
          id?: string
          mobile?: string | null
          order_index?: number
          quoted_amount?: number | null
          rfq_id?: string
          sent_date?: string | null
          status?: string
          vendor_id?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_vendors_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          created_at: string
          created_by: string | null
          firm_id: string
          id: string
          material_request_id: string | null
          material_type: string | null
          notes: string | null
          project_id: string | null
          quote_valid_until: string | null
          rfq_date: string
          rfq_number: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          firm_id: string
          id?: string
          material_request_id?: string | null
          material_type?: string | null
          notes?: string | null
          project_id?: string | null
          quote_valid_until?: string | null
          rfq_date?: string
          rfq_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          firm_id?: string
          id?: string
          material_request_id?: string | null
          material_type?: string | null
          notes?: string | null
          project_id?: string | null
          quote_valid_until?: string | null
          rfq_date?: string
          rfq_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          created_at: string
          firm_id: string
          floor_area_sqft: number | null
          height_mm: number | null
          id: string
          length_mm: number | null
          name: string
          notes: string | null
          order_index: number
          project_id: string
          region_id: string | null
          room_type: Database["public"]["Enums"]["room_type"]
          width_mm: number | null
        }
        Insert: {
          created_at?: string
          firm_id: string
          floor_area_sqft?: number | null
          height_mm?: number | null
          id?: string
          length_mm?: number | null
          name: string
          notes?: string | null
          order_index?: number
          project_id: string
          region_id?: string | null
          room_type?: Database["public"]["Enums"]["room_type"]
          width_mm?: number | null
        }
        Update: {
          created_at?: string
          firm_id?: string
          floor_area_sqft?: number | null
          height_mm?: number | null
          id?: string
          length_mm?: number | null
          name?: string
          notes?: string | null
          order_index?: number
          project_id?: string
          region_id?: string | null
          room_type?: Database["public"]["Enums"]["room_type"]
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_projects: number | null
          max_users: number | null
          module_keys: Json
          name: string
          price_annual: number
          price_monthly: number
          storage_gb: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_projects?: number | null
          max_users?: number | null
          module_keys?: Json
          name: string
          price_annual?: number
          price_monthly?: number
          storage_gb?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_projects?: number | null
          max_users?: number | null
          module_keys?: Json
          name?: string
          price_annual?: number
          price_monthly?: number
          storage_gb?: number | null
        }
        Relationships: []
      }
      task_activity: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          created_at: string
          detail: string | null
          firm_id: string
          id: string
          kind: string
          task_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          detail?: string | null
          firm_id: string
          id?: string
          kind: string
          task_id: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          detail?: string | null
          firm_id?: string
          id?: string
          kind?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assign_privileges: {
        Row: {
          firm_id: string
          granted_at: string
          granted_by: string | null
          id: string
          user_id: string
          user_name: string
        }
        Insert: {
          firm_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          user_id: string
          user_name: string
        }
        Update: {
          firm_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assign_privileges_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      task_lists: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          firm_id: string
          icon: string | null
          id: string
          name: string
          order_index: number
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          firm_id: string
          icon?: string | null
          id?: string
          name: string
          order_index?: number
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          firm_id?: string
          icon?: string | null
          id?: string
          name?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_lists_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      task_subtasks: {
        Row: {
          created_at: string
          done: boolean
          firm_id: string
          id: string
          order_index: number
          task_id: string
          title: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          firm_id: string
          id?: string
          order_index?: number
          task_id: string
          title: string
        }
        Update: {
          created_at?: string
          done?: boolean
          firm_id?: string
          id?: string
          order_index?: number
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_subtasks_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archived_at: string | null
          assignee_id: string
          assignee_name: string
          attachments: Json
          completed_at: string | null
          created_at: string
          created_by_id: string
          created_by_name: string
          description: string | null
          due_date: string | null
          firm_id: string
          id: string
          is_followup: boolean
          link_id: string | null
          link_label: string | null
          link_type: string | null
          list_id: string | null
          notes: string | null
          order_index: number
          priority: string
          progress: number
          project_id: string | null
          project_name: string | null
          reminder_at: string | null
          repeat: string
          start_date: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          assignee_id: string
          assignee_name: string
          attachments?: Json
          completed_at?: string | null
          created_at?: string
          created_by_id: string
          created_by_name: string
          description?: string | null
          due_date?: string | null
          firm_id: string
          id?: string
          is_followup?: boolean
          link_id?: string | null
          link_label?: string | null
          link_type?: string | null
          list_id?: string | null
          notes?: string | null
          order_index?: number
          priority?: string
          progress?: number
          project_id?: string | null
          project_name?: string | null
          reminder_at?: string | null
          repeat?: string
          start_date?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          assignee_id?: string
          assignee_name?: string
          attachments?: Json
          completed_at?: string | null
          created_at?: string
          created_by_id?: string
          created_by_name?: string
          description?: string | null
          due_date?: string | null
          firm_id?: string
          id?: string
          is_followup?: boolean
          link_id?: string | null
          link_label?: string | null
          link_type?: string | null
          list_id?: string | null
          notes?: string | null
          order_index?: number
          priority?: string
          progress?: number
          project_id?: string | null
          project_name?: string | null
          reminder_at?: string | null
          repeat?: string
          start_date?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "task_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          firm_id: string
          full_name: string | null
          id: string
          invited_by: string | null
          role_id: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          firm_id: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          role_id?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          firm_id?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          role_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invites_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      vastos_admin_log: {
        Row: {
          action: string
          created_at: string
          details: Json
          firm_id: string | null
          firm_name: string | null
          id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          firm_id?: string | null
          firm_name?: string | null
          id?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          firm_id?: string | null
          firm_name?: string | null
          id?: string
        }
        Relationships: []
      }
      vendor_performance: {
        Row: {
          actual_days: number | null
          firm_id: string
          id: string
          market_price: number | null
          po_id: string | null
          price_at_order: number | null
          promised_days: number | null
          qty_defective: number
          qty_ordered: number | null
          recorded_at: string
          vendor_id: string
        }
        Insert: {
          actual_days?: number | null
          firm_id: string
          id?: string
          market_price?: number | null
          po_id?: string | null
          price_at_order?: number | null
          promised_days?: number | null
          qty_defective?: number
          qty_ordered?: number | null
          recorded_at?: string
          vendor_id: string
        }
        Update: {
          actual_days?: number | null
          firm_id?: string
          id?: string
          market_price?: number | null
          po_id?: string | null
          price_at_order?: number | null
          promised_days?: number | null
          qty_defective?: number
          qty_ordered?: number | null
          recorded_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_perf_po_fk"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_performance_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_performance_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_skus: {
        Row: {
          created_at: string
          firm_id: string
          id: string
          lead_time_days: number
          moq: number | null
          price: number
          sku_id: string
          valid_from: string
          valid_to: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          firm_id: string
          id?: string
          lead_time_days?: number
          moq?: number | null
          price: number
          sku_id: string
          valid_from?: string
          valid_to?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          firm_id?: string
          id?: string
          lead_time_days?: number
          moq?: number | null
          price?: number
          sku_id?: string
          valid_from?: string
          valid_to?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_skus_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_skus_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_skus_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_visibility_grants: {
        Row: {
          firm_id: string
          granted_at: string
          granted_by: string | null
          id: string
          user_id: string
          user_name: string
        }
        Insert: {
          firm_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          user_id: string
          user_name: string
        }
        Update: {
          firm_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_visibility_grants_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          category: string | null
          company_name: string
          contact_person: string | null
          cost_score: number | null
          created_at: string
          created_by: string | null
          credit_days: number | null
          delivery_score: number | null
          email: string | null
          firm_id: string
          gstin: string | null
          id: string
          notes: string | null
          overall_score: number | null
          payment_terms: string | null
          phone: string | null
          quality_score: number | null
          region_ids: string[]
          reliability_score: number | null
          status: Database["public"]["Enums"]["vendor_status"]
          updated_at: string
          vendor_code: string | null
        }
        Insert: {
          category?: string | null
          company_name: string
          contact_person?: string | null
          cost_score?: number | null
          created_at?: string
          created_by?: string | null
          credit_days?: number | null
          delivery_score?: number | null
          email?: string | null
          firm_id: string
          gstin?: string | null
          id?: string
          notes?: string | null
          overall_score?: number | null
          payment_terms?: string | null
          phone?: string | null
          quality_score?: number | null
          region_ids?: string[]
          reliability_score?: number | null
          status?: Database["public"]["Enums"]["vendor_status"]
          updated_at?: string
          vendor_code?: string | null
        }
        Update: {
          category?: string | null
          company_name?: string
          contact_person?: string | null
          cost_score?: number | null
          created_at?: string
          created_by?: string | null
          credit_days?: number | null
          delivery_score?: number | null
          email?: string | null
          firm_id?: string
          gstin?: string | null
          id?: string
          notes?: string | null
          overall_score?: number | null
          payment_terms?: string | null
          phone?: string | null
          quality_score?: number | null
          region_ids?: string[]
          reliability_score?: number | null
          status?: Database["public"]["Enums"]["vendor_status"]
          updated_at?: string
          vendor_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          additional_work: string | null
          amount: number | null
          bank_details: string | null
          contractor_vendor_id: string | null
          created_at: string
          created_by: string | null
          firm_id: string
          id: string
          notes: string | null
          project_id: string | null
          status: string
          terms_conditions: string | null
          terms_of_payment: string | null
          title: string
          updated_at: string
          wo_date: string
          wo_number: string
          work_description: string | null
        }
        Insert: {
          additional_work?: string | null
          amount?: number | null
          bank_details?: string | null
          contractor_vendor_id?: string | null
          created_at?: string
          created_by?: string | null
          firm_id: string
          id?: string
          notes?: string | null
          project_id?: string | null
          status?: string
          terms_conditions?: string | null
          terms_of_payment?: string | null
          title?: string
          updated_at?: string
          wo_date?: string
          wo_number: string
          work_description?: string | null
        }
        Update: {
          additional_work?: string | null
          amount?: number | null
          bank_details?: string | null
          contractor_vendor_id?: string | null
          created_at?: string
          created_by?: string | null
          firm_id?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          status?: string
          terms_conditions?: string | null
          terms_of_payment?: string | null
          title?: string
          updated_at?: string
          wo_date?: string
          wo_number?: string
          work_description?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      crm_current_role_id: { Args: never; Returns: string }
      crm_has_permission: {
        Args: { p_action: string; p_module: string }
        Returns: boolean
      }
      current_firm_id: { Args: never; Returns: string }
      resolve_rate: {
        Args: {
          p_firm: string
          p_labour: string
          p_on?: string
          p_region: string
          p_sku: string
        }
        Returns: number
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      text2ltree: { Args: { "": string }; Returns: unknown }
    }
    Enums: {
      alternate_relation: "upgrade" | "downgrade" | "equivalent"
      approval_decision: "approved" | "rejected" | "changes_requested"
      boq_line_source: "engine" | "ai_suggested" | "manual" | "catalog_pick"
      boq_status:
        | "draft"
        | "in_review"
        | "approved"
        | "sent"
        | "accepted"
        | "rejected"
        | "superseded"
      catalog_kind: "material" | "labour" | "service"
      extraction_status:
        | "pending"
        | "processing"
        | "needs_review"
        | "confirmed"
        | "failed"
      module_output_kind: "material" | "labour" | "hardware" | "service"
      po_status:
        | "draft"
        | "issued"
        | "partially_received"
        | "received"
        | "closed"
        | "cancelled"
      project_priority: "balanced" | "speed" | "margin" | "quality"
      quality_grade: "economy" | "standard" | "premium" | "luxury"
      quotation_doc_type:
        | "customer"
        | "internal_costing"
        | "procurement"
        | "vendor_rfq"
      rate_source:
        | "vendor_quote"
        | "market_survey"
        | "calibrated"
        | "manual"
        | "price_list"
      room_type:
        | "kitchen"
        | "living"
        | "dining"
        | "master_bedroom"
        | "bedroom"
        | "kids_room"
        | "bathroom"
        | "balcony"
        | "study"
        | "pooja"
        | "utility"
        | "foyer"
        | "office"
        | "retail"
        | "other"
      uom:
        | "sqft"
        | "sqm"
        | "rft"
        | "rmt"
        | "nos"
        | "sheet"
        | "set"
        | "pair"
        | "litre"
        | "kg"
        | "box"
        | "bag"
        | "point"
        | "day"
        | "hour"
        | "lumpsum"
        | "cum"
      user_role: "owner" | "architect" | "engineer" | "client"
      vendor_status:
        | "active"
        | "preferred"
        | "probation"
        | "blacklisted"
        | "inactive"
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
      alternate_relation: ["upgrade", "downgrade", "equivalent"],
      approval_decision: ["approved", "rejected", "changes_requested"],
      boq_line_source: ["engine", "ai_suggested", "manual", "catalog_pick"],
      boq_status: [
        "draft",
        "in_review",
        "approved",
        "sent",
        "accepted",
        "rejected",
        "superseded",
      ],
      catalog_kind: ["material", "labour", "service"],
      extraction_status: [
        "pending",
        "processing",
        "needs_review",
        "confirmed",
        "failed",
      ],
      module_output_kind: ["material", "labour", "hardware", "service"],
      po_status: [
        "draft",
        "issued",
        "partially_received",
        "received",
        "closed",
        "cancelled",
      ],
      project_priority: ["balanced", "speed", "margin", "quality"],
      quality_grade: ["economy", "standard", "premium", "luxury"],
      quotation_doc_type: [
        "customer",
        "internal_costing",
        "procurement",
        "vendor_rfq",
      ],
      rate_source: [
        "vendor_quote",
        "market_survey",
        "calibrated",
        "manual",
        "price_list",
      ],
      room_type: [
        "kitchen",
        "living",
        "dining",
        "master_bedroom",
        "bedroom",
        "kids_room",
        "bathroom",
        "balcony",
        "study",
        "pooja",
        "utility",
        "foyer",
        "office",
        "retail",
        "other",
      ],
      uom: [
        "sqft",
        "sqm",
        "rft",
        "rmt",
        "nos",
        "sheet",
        "set",
        "pair",
        "litre",
        "kg",
        "box",
        "bag",
        "point",
        "day",
        "hour",
        "lumpsum",
        "cum",
      ],
      user_role: ["owner", "architect", "engineer", "client"],
      vendor_status: [
        "active",
        "preferred",
        "probation",
        "blacklisted",
        "inactive",
      ],
    },
  },
} as const
