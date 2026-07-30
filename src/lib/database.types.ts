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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
            foreignKeyName: "boq_actual_variance_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products_effective"
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
            foreignKeyName: "boq_line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products_effective"
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
            foreignKeyName: "calibration_runs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products_effective"
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
          {
            foreignKeyName: "catalog_embeddings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "catalog_products_effective"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_product_overrides: {
        Row: {
          attributes: Json | null
          category_id: string | null
          created_at: string
          firm_id: string
          gst_rate: number | null
          hsn_code: string | null
          id: string
          install_loss: number | null
          is_active: boolean | null
          name: string | null
          packaging_loss: number | null
          product_id: string
          updated_at: string
          waste_factor: number | null
        }
        Insert: {
          attributes?: Json | null
          category_id?: string | null
          created_at?: string
          firm_id: string
          gst_rate?: number | null
          hsn_code?: string | null
          id?: string
          install_loss?: number | null
          is_active?: boolean | null
          name?: string | null
          packaging_loss?: number | null
          product_id: string
          updated_at?: string
          waste_factor?: number | null
        }
        Update: {
          attributes?: Json | null
          category_id?: string | null
          created_at?: string
          firm_id?: string
          gst_rate?: number | null
          hsn_code?: string | null
          id?: string
          install_loss?: number | null
          is_active?: boolean | null
          name?: string | null
          packaging_loss?: number | null
          product_id?: string
          updated_at?: string
          waste_factor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_product_overrides_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalog_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_product_overrides_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_product_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_product_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products_effective"
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
      crm_dashboard_layouts: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          firm_id: string
          id: string
          is_default: boolean
          module: string
          name: string
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          firm_id: string
          id?: string
          is_default?: boolean
          module?: string
          name: string
          scope?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          firm_id?: string
          id?: string
          is_default?: boolean
          module?: string
          name?: string
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      crm_oauth_states: {
        Row: {
          actor_email: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          firm_id: string
          id: string
          provider: string
          redirect_uri: string
          state_hash: string
        }
        Insert: {
          actor_email: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          firm_id: string
          id?: string
          provider?: string
          redirect_uri: string
          state_hash: string
        }
        Update: {
          actor_email?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          firm_id?: string
          id?: string
          provider?: string
          redirect_uri?: string
          state_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_oauth_states_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_oauth_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          firm_id: string
          id: string
          provider: string
          secret_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          firm_id: string
          id?: string
          provider?: string
          secret_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          firm_id?: string
          id?: string
          provider?: string
          secret_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_oauth_tokens_firm_id_fkey"
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
      crm_telephony_calls: {
        Row: {
          call_sid: string | null
          created_at: string
          error: string | null
          firm_id: string
          from_number: string | null
          id: string
          lead_id: string
          provider: string | null
          requested_by: string
          settled_at: string | null
          status: string
          to_number: string
        }
        Insert: {
          call_sid?: string | null
          created_at?: string
          error?: string | null
          firm_id: string
          from_number?: string | null
          id?: string
          lead_id: string
          provider?: string | null
          requested_by: string
          settled_at?: string | null
          status?: string
          to_number: string
        }
        Update: {
          call_sid?: string | null
          created_at?: string
          error?: string | null
          firm_id?: string
          from_number?: string | null
          id?: string
          lead_id?: string
          provider?: string | null
          requested_by?: string
          settled_at?: string | null
          status?: string
          to_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_telephony_calls_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_webhook_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          firm_id: string
          id: string
          kind: string
          label: string | null
          last_used_at: string | null
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          firm_id: string
          id?: string
          kind?: string
          label?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          firm_id?: string
          id?: string
          kind?: string
          label?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_webhook_tokens_firm_id_fkey"
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
      goods_receipt_items: {
        Row: {
          accepted_qty: number
          batch_ref: string | null
          damaged_qty: number
          delivered_qty: number
          firm_id: string
          grn_id: string
          id: string
          material_name: string
          order_index: number
          ordered_qty: number
          po_line_id: string | null
          prev_received_qty: number
          quality_notes: string | null
          rejected_qty: number
          rejection_reason: string | null
          sku_id: string | null
          unit_cost: number | null
          uom: Database["public"]["Enums"]["uom"] | null
        }
        Insert: {
          accepted_qty?: number
          batch_ref?: string | null
          damaged_qty?: number
          delivered_qty?: number
          firm_id: string
          grn_id: string
          id?: string
          material_name?: string
          order_index?: number
          ordered_qty?: number
          po_line_id?: string | null
          prev_received_qty?: number
          quality_notes?: string | null
          rejected_qty?: number
          rejection_reason?: string | null
          sku_id?: string | null
          unit_cost?: number | null
          uom?: Database["public"]["Enums"]["uom"] | null
        }
        Update: {
          accepted_qty?: number
          batch_ref?: string | null
          damaged_qty?: number
          delivered_qty?: number
          firm_id?: string
          grn_id?: string
          id?: string
          material_name?: string
          order_index?: number
          ordered_qty?: number
          po_line_id?: string | null
          prev_received_qty?: number
          quality_notes?: string | null
          rejected_qty?: number
          rejection_reason?: string | null
          sku_id?: string | null
          unit_cost?: number | null
          uom?: Database["public"]["Enums"]["uom"] | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_po_line_id_fkey"
            columns: ["po_line_id"]
            isOneToOne: false
            referencedRelation: "po_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          challan_no: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          crm_project_id: string | null
          delivery_date: string
          firm_id: string
          grn_number: string
          id: string
          location: string | null
          notes: string | null
          po_id: string | null
          posted_at: string | null
          received_by: string | null
          received_by_name: string | null
          status: Database["public"]["Enums"]["grn_status"]
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          challan_no?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          crm_project_id?: string | null
          delivery_date?: string
          firm_id: string
          grn_number: string
          id?: string
          location?: string | null
          notes?: string | null
          po_id?: string | null
          posted_at?: string | null
          received_by?: string | null
          received_by_name?: string | null
          status?: Database["public"]["Enums"]["grn_status"]
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          challan_no?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          crm_project_id?: string | null
          delivery_date?: string
          firm_id?: string
          grn_number?: string
          id?: string
          location?: string | null
          notes?: string | null
          po_id?: string | null
          posted_at?: string | null
          received_by?: string | null
          received_by_name?: string | null
          status?: Database["public"]["Enums"]["grn_status"]
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_crm_project_id_fkey"
            columns: ["crm_project_id"]
            isOneToOne: false
            referencedRelation: "crm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_alerts: {
        Row: {
          alert_type: string
          created_at: string
          dedupe_key: string | null
          firm_id: string
          id: string
          link: string | null
          message: string | null
          project_id: string | null
          ref_id: string | null
          ref_type: string | null
          resolved_at: string | null
          severity: string
          sku_id: string | null
          status: string
          title: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          dedupe_key?: string | null
          firm_id: string
          id?: string
          link?: string | null
          message?: string | null
          project_id?: string | null
          ref_id?: string | null
          ref_type?: string | null
          resolved_at?: string | null
          severity?: string
          sku_id?: string | null
          status?: string
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          dedupe_key?: string | null
          firm_id?: string
          id?: string
          link?: string | null
          message?: string | null
          project_id?: string | null
          ref_id?: string | null
          ref_type?: string | null
          resolved_at?: string | null
          severity?: string
          sku_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_alerts_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "crm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_alerts_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_item_settings: {
        Row: {
          firm_id: string
          id: string
          lead_time_days: number | null
          max_level: number | null
          notes: string | null
          preferred_vendor_id: string | null
          project_id: string | null
          reorder_level: number
          safety_stock: number
          sku_id: string
          updated_at: string
        }
        Insert: {
          firm_id: string
          id?: string
          lead_time_days?: number | null
          max_level?: number | null
          notes?: string | null
          preferred_vendor_id?: string | null
          project_id?: string | null
          reorder_level?: number
          safety_stock?: number
          sku_id: string
          updated_at?: string
        }
        Update: {
          firm_id?: string
          id?: string
          lead_time_days?: number | null
          max_level?: number | null
          notes?: string | null
          preferred_vendor_id?: string | null
          project_id?: string | null
          reorder_level?: number
          safety_stock?: number
          sku_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_item_settings_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_item_settings_preferred_vendor_id_fkey"
            columns: ["preferred_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_item_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "crm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_item_settings_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_number_seq: {
        Row: {
          doc_type: string
          firm_id: string
          next_val: number
        }
        Insert: {
          doc_type: string
          firm_id: string
          next_val?: number
        }
        Update: {
          doc_type?: string
          firm_id?: string
          next_val?: number
        }
        Relationships: []
      }
      inventory_outbox: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          event_type: string
          firm_id: string
          id: string
          payload: Json
          processed_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          event_type: string
          firm_id: string
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          event_type?: string
          firm_id?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_outbox_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
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
          approved_qty: number | null
          available_qty: number
          boq_line_id: string | null
          firm_id: string
          id: string
          material_name: string
          on_order_qty: number
          order_index: number
          ordered_qty: number
          request_id: string
          required_by: string | null
          required_qty: number
          sku_id: string | null
          specification: string | null
          suggested_qty: number
          uom: Database["public"]["Enums"]["uom"] | null
        }
        Insert: {
          approved_qty?: number | null
          available_qty?: number
          boq_line_id?: string | null
          firm_id: string
          id?: string
          material_name?: string
          on_order_qty?: number
          order_index?: number
          ordered_qty?: number
          request_id: string
          required_by?: string | null
          required_qty?: number
          sku_id?: string | null
          specification?: string | null
          suggested_qty?: number
          uom?: Database["public"]["Enums"]["uom"] | null
        }
        Update: {
          approved_qty?: number | null
          available_qty?: number
          boq_line_id?: string | null
          firm_id?: string
          id?: string
          material_name?: string
          on_order_qty?: number
          order_index?: number
          ordered_qty?: number
          request_id?: string
          required_by?: string | null
          required_qty?: number
          sku_id?: string | null
          specification?: string | null
          suggested_qty?: number
          uom?: Database["public"]["Enums"]["uom"] | null
        }
        Relationships: [
          {
            foreignKeyName: "material_request_items_boq_line_id_fkey"
            columns: ["boq_line_id"]
            isOneToOne: false
            referencedRelation: "boq_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_request_items_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_request_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      material_requests: {
        Row: {
          approved_at: string | null
          approver_id: string | null
          approver_name: string | null
          boq_id: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          firm_id: string
          id: string
          location: string | null
          milestone_id: string | null
          notes: string | null
          priority: string
          project_id: string
          rejected_reason: string | null
          request_number: string
          requester_id: string | null
          requester_name: string | null
          required_by: string | null
          source: string
          status: Database["public"]["Enums"]["mr_status"]
          submitted_at: string | null
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approver_id?: string | null
          approver_name?: string | null
          boq_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          firm_id: string
          id?: string
          location?: string | null
          milestone_id?: string | null
          notes?: string | null
          priority?: string
          project_id: string
          rejected_reason?: string | null
          request_number: string
          requester_id?: string | null
          requester_name?: string | null
          required_by?: string | null
          source?: string
          status?: Database["public"]["Enums"]["mr_status"]
          submitted_at?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approver_id?: string | null
          approver_name?: string | null
          boq_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          firm_id?: string
          id?: string
          location?: string | null
          milestone_id?: string | null
          notes?: string | null
          priority?: string
          project_id?: string
          rejected_reason?: string | null
          request_number?: string
          requester_id?: string | null
          requester_name?: string | null
          required_by?: string | null
          source?: string
          status?: Database["public"]["Enums"]["mr_status"]
          submitted_at?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_requests_boq_id_fkey"
            columns: ["boq_id"]
            isOneToOne: false
            referencedRelation: "boq_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "crm_projects"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "module_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "module_templates_effective"
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
            foreignKeyName: "module_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products_effective"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "module_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "module_templates_effective"
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
      physical_count_items: {
        Row: {
          count_id: string
          counted_qty: number
          firm_id: string
          id: string
          note: string | null
          order_index: number
          sku_id: string
          system_qty: number
          uom: Database["public"]["Enums"]["uom"]
          variance_qty: number
        }
        Insert: {
          count_id: string
          counted_qty?: number
          firm_id: string
          id?: string
          note?: string | null
          order_index?: number
          sku_id: string
          system_qty?: number
          uom: Database["public"]["Enums"]["uom"]
          variance_qty?: number
        }
        Update: {
          count_id?: string
          counted_qty?: number
          firm_id?: string
          id?: string
          note?: string | null
          order_index?: number
          sku_id?: string
          system_qty?: number
          uom?: Database["public"]["Enums"]["uom"]
          variance_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "physical_count_items_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "physical_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physical_count_items_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physical_count_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      physical_counts: {
        Row: {
          count_number: string
          counted_at: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          crm_project_id: string
          firm_id: string
          id: string
          location: string | null
          note: string | null
          posted_at: string | null
          status: Database["public"]["Enums"]["count_status"]
          updated_at: string
        }
        Insert: {
          count_number: string
          counted_at?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          crm_project_id: string
          firm_id: string
          id?: string
          location?: string | null
          note?: string | null
          posted_at?: string | null
          status?: Database["public"]["Enums"]["count_status"]
          updated_at?: string
        }
        Update: {
          count_number?: string
          counted_at?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          crm_project_id?: string
          firm_id?: string
          id?: string
          location?: string | null
          note?: string | null
          posted_at?: string | null
          status?: Database["public"]["Enums"]["count_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "physical_counts_crm_project_id_fkey"
            columns: ["crm_project_id"]
            isOneToOne: false
            referencedRelation: "crm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physical_counts_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
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
          mr_item_id: string | null
          po_id: string
          qty_base: number | null
          qty_received: number
          qty_received_base: number
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
          mr_item_id?: string | null
          po_id: string
          qty_base?: number | null
          qty_received?: number
          qty_received_base?: number
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
          mr_item_id?: string | null
          po_id?: string
          qty_base?: number | null
          qty_received?: number
          qty_received_base?: number
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
            foreignKeyName: "po_line_items_mr_item_id_fkey"
            columns: ["mr_item_id"]
            isOneToOne: false
            referencedRelation: "material_request_items"
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
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products_effective"
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
      purchase_material_request_items: {
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
            foreignKeyName: "purchase_material_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "purchase_material_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_material_requests: {
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
      purchase_orders: {
        Row: {
          additional_terms: string | null
          admin_notes: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          boq_id: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          created_by_crm: string | null
          credit_days: number | null
          crm_project_id: string | null
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
          milestone_id: string | null
          notes: string | null
          order_contact_id: string | null
          order_contact_phone: string | null
          payment_status: string
          po_number: string
          project_id: string | null
          purchase_material_request_id: string | null
          purchase_rfq_id: string | null
          received_at: string | null
          required_by: string | null
          rfq_id: string | null
          status: Database["public"]["Enums"]["po_status"]
          submitted_at: string | null
          subtotal: number
          supplier_quotation_ref: string | null
          total_amount: number
          updated_at: string
          vendor_id: string | null
          version: number
        }
        Insert: {
          additional_terms?: string | null
          admin_notes?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          boq_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_crm?: string | null
          credit_days?: number | null
          crm_project_id?: string | null
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
          milestone_id?: string | null
          notes?: string | null
          order_contact_id?: string | null
          order_contact_phone?: string | null
          payment_status?: string
          po_number: string
          project_id?: string | null
          purchase_material_request_id?: string | null
          purchase_rfq_id?: string | null
          received_at?: string | null
          required_by?: string | null
          rfq_id?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          submitted_at?: string | null
          subtotal?: number
          supplier_quotation_ref?: string | null
          total_amount?: number
          updated_at?: string
          vendor_id?: string | null
          version?: number
        }
        Update: {
          additional_terms?: string | null
          admin_notes?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          boq_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_crm?: string | null
          credit_days?: number | null
          crm_project_id?: string | null
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
          milestone_id?: string | null
          notes?: string | null
          order_contact_id?: string | null
          order_contact_phone?: string | null
          payment_status?: string
          po_number?: string
          project_id?: string | null
          purchase_material_request_id?: string | null
          purchase_rfq_id?: string | null
          received_at?: string | null
          required_by?: string | null
          rfq_id?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          submitted_at?: string | null
          subtotal?: number
          supplier_quotation_ref?: string | null
          total_amount?: number
          updated_at?: string
          vendor_id?: string | null
          version?: number
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
            foreignKeyName: "purchase_orders_crm_project_id_fkey"
            columns: ["crm_project_id"]
            isOneToOne: false
            referencedRelation: "crm_projects"
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
            foreignKeyName: "purchase_orders_mr_fk"
            columns: ["material_request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
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
            foreignKeyName: "purchase_orders_purchase_material_request_id_fkey"
            columns: ["purchase_material_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_material_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_purchase_rfq_id_fkey"
            columns: ["purchase_rfq_id"]
            isOneToOne: false
            referencedRelation: "purchase_rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_rfq_fk"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
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
      purchase_rfq_items: {
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
            foreignKeyName: "purchase_rfq_items_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "purchase_rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_rfq_vendors: {
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
            foreignKeyName: "purchase_rfq_vendors_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "purchase_rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_rfqs: {
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
          boq_line_id: string | null
          firm_id: string
          id: string
          material_name: string
          order_index: number
          quantity: number
          required_by: string | null
          rfq_id: string
          sku_id: string | null
          uom: Database["public"]["Enums"]["uom"] | null
        }
        Insert: {
          boq_line_id?: string | null
          firm_id: string
          id?: string
          material_name?: string
          order_index?: number
          quantity?: number
          required_by?: string | null
          rfq_id: string
          sku_id?: string | null
          uom?: Database["public"]["Enums"]["uom"] | null
        }
        Update: {
          boq_line_id?: string | null
          firm_id?: string
          id?: string
          material_name?: string
          order_index?: number
          quantity?: number
          required_by?: string | null
          rfq_id?: string
          sku_id?: string | null
          uom?: Database["public"]["Enums"]["uom"] | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_items_boq_line_id_fkey"
            columns: ["boq_line_id"]
            isOneToOne: false
            referencedRelation: "boq_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_items_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_items_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_quote_items: {
        Row: {
          awarded_qty: number
          firm_id: string
          id: string
          is_awarded: boolean
          moq: number | null
          note: string | null
          rfq_id: string
          rfq_item_id: string
          rfq_vendor_id: string
          tax_pct: number
          unit_price: number | null
        }
        Insert: {
          awarded_qty?: number
          firm_id: string
          id?: string
          is_awarded?: boolean
          moq?: number | null
          note?: string | null
          rfq_id: string
          rfq_item_id: string
          rfq_vendor_id: string
          tax_pct?: number
          unit_price?: number | null
        }
        Update: {
          awarded_qty?: number
          firm_id?: string
          id?: string
          is_awarded?: boolean
          moq?: number | null
          note?: string | null
          rfq_id?: string
          rfq_item_id?: string
          rfq_vendor_id?: string
          tax_pct?: number
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_quote_items_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_quote_items_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_quote_items_rfq_item_id_fkey"
            columns: ["rfq_item_id"]
            isOneToOne: false
            referencedRelation: "rfq_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_quote_items_rfq_vendor_id_fkey"
            columns: ["rfq_vendor_id"]
            isOneToOne: false
            referencedRelation: "rfq_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_vendors: {
        Row: {
          credit_terms: string | null
          firm_id: string
          freight: number
          id: string
          lead_time_days: number | null
          notes: string | null
          order_index: number
          promised_date: string | null
          quote_valid_until: string | null
          rfq_id: string
          sent_at: string | null
          status: string
          vendor_id: string | null
          vendor_name: string
        }
        Insert: {
          credit_terms?: string | null
          firm_id: string
          freight?: number
          id?: string
          lead_time_days?: number | null
          notes?: string | null
          order_index?: number
          promised_date?: string | null
          quote_valid_until?: string | null
          rfq_id: string
          sent_at?: string | null
          status?: string
          vendor_id?: string | null
          vendor_name?: string
        }
        Update: {
          credit_terms?: string | null
          firm_id?: string
          freight?: number
          id?: string
          lead_time_days?: number | null
          notes?: string | null
          order_index?: number
          promised_date?: string | null
          quote_valid_until?: string | null
          rfq_id?: string
          sent_at?: string | null
          status?: string
          vendor_id?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_vendors_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_vendors_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_vendors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          awarded_at: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          firm_id: string
          id: string
          material_request_id: string | null
          notes: string | null
          priority: string
          project_id: string | null
          required_by: string | null
          rfq_number: string
          status: Database["public"]["Enums"]["rfq_status"]
          updated_at: string
        }
        Insert: {
          awarded_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          firm_id: string
          id?: string
          material_request_id?: string | null
          notes?: string | null
          priority?: string
          project_id?: string | null
          required_by?: string | null
          rfq_number: string
          status?: Database["public"]["Enums"]["rfq_status"]
          updated_at?: string
        }
        Update: {
          awarded_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          firm_id?: string
          id?: string
          material_request_id?: string | null
          notes?: string | null
          priority?: string
          project_id?: string | null
          required_by?: string | null
          rfq_number?: string
          status?: Database["public"]["Enums"]["rfq_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfqs_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_material_request_id_fkey"
            columns: ["material_request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "crm_projects"
            referencedColumns: ["id"]
          },
        ]
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
      stock_adjustment_items: {
        Row: {
          adjustment_id: string
          firm_id: string
          id: string
          note: string | null
          order_index: number
          quantity: number
          sku_id: string
          unit_cost: number | null
          uom: Database["public"]["Enums"]["uom"]
        }
        Insert: {
          adjustment_id: string
          firm_id: string
          id?: string
          note?: string | null
          order_index?: number
          quantity?: number
          sku_id: string
          unit_cost?: number | null
          uom: Database["public"]["Enums"]["uom"]
        }
        Update: {
          adjustment_id?: string
          firm_id?: string
          id?: string
          note?: string | null
          order_index?: number
          quantity?: number
          sku_id?: string
          unit_cost?: number | null
          uom?: Database["public"]["Enums"]["uom"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustment_items_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "stock_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          adjustment_number: string
          approved_at: string | null
          approved_by: string | null
          approved_by_name: string | null
          created_at: string
          crm_project_id: string
          evidence_url: string | null
          firm_id: string
          id: string
          kind: string
          location: string | null
          note: string | null
          posted_at: string | null
          reason: string | null
          requested_by: string | null
          requested_by_name: string | null
          status: Database["public"]["Enums"]["adjustment_status"]
          updated_at: string
        }
        Insert: {
          adjustment_number: string
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          created_at?: string
          crm_project_id: string
          evidence_url?: string | null
          firm_id: string
          id?: string
          kind?: string
          location?: string | null
          note?: string | null
          posted_at?: string | null
          reason?: string | null
          requested_by?: string | null
          requested_by_name?: string | null
          status?: Database["public"]["Enums"]["adjustment_status"]
          updated_at?: string
        }
        Update: {
          adjustment_number?: string
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          created_at?: string
          crm_project_id?: string
          evidence_url?: string | null
          firm_id?: string
          id?: string
          kind?: string
          location?: string | null
          note?: string | null
          posted_at?: string | null
          reason?: string | null
          requested_by?: string | null
          requested_by_name?: string | null
          status?: Database["public"]["Enums"]["adjustment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_crm_project_id_fkey"
            columns: ["crm_project_id"]
            isOneToOne: false
            referencedRelation: "crm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_consumption_items: {
        Row: {
          boq_line_id: string | null
          consumption_id: string
          firm_id: string
          id: string
          order_index: number
          quantity: number
          sku_id: string
          unit_cost: number | null
          uom: Database["public"]["Enums"]["uom"]
        }
        Insert: {
          boq_line_id?: string | null
          consumption_id: string
          firm_id: string
          id?: string
          order_index?: number
          quantity?: number
          sku_id: string
          unit_cost?: number | null
          uom: Database["public"]["Enums"]["uom"]
        }
        Update: {
          boq_line_id?: string | null
          consumption_id?: string
          firm_id?: string
          id?: string
          order_index?: number
          quantity?: number
          sku_id?: string
          unit_cost?: number | null
          uom?: Database["public"]["Enums"]["uom"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_consumption_items_boq_line_id_fkey"
            columns: ["boq_line_id"]
            isOneToOne: false
            referencedRelation: "boq_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_consumption_items_consumption_id_fkey"
            columns: ["consumption_id"]
            isOneToOne: false
            referencedRelation: "stock_consumptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_consumption_items_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_consumption_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_consumptions: {
        Row: {
          consumed_at: string
          consumption_number: string
          created_at: string
          crm_project_id: string
          entered_by: string | null
          entered_by_name: string | null
          firm_id: string
          id: string
          location: string | null
          milestone_id: string | null
          note: string | null
          photo_url: string | null
          posted_at: string | null
          status: Database["public"]["Enums"]["consumption_status"]
          task_id: string | null
          updated_at: string
        }
        Insert: {
          consumed_at?: string
          consumption_number: string
          created_at?: string
          crm_project_id: string
          entered_by?: string | null
          entered_by_name?: string | null
          firm_id: string
          id?: string
          location?: string | null
          milestone_id?: string | null
          note?: string | null
          photo_url?: string | null
          posted_at?: string | null
          status?: Database["public"]["Enums"]["consumption_status"]
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          consumed_at?: string
          consumption_number?: string
          created_at?: string
          crm_project_id?: string
          entered_by?: string | null
          entered_by_name?: string | null
          firm_id?: string
          id?: string
          location?: string | null
          milestone_id?: string | null
          note?: string | null
          photo_url?: string | null
          posted_at?: string | null
          status?: Database["public"]["Enums"]["consumption_status"]
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_consumptions_crm_project_id_fkey"
            columns: ["crm_project_id"]
            isOneToOne: false
            referencedRelation: "crm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_consumptions_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_ref: string | null
          counterparty_project: string | null
          created_at: string
          firm_id: string
          id: string
          idempotency_key: string | null
          location: string | null
          movement_class: Database["public"]["Enums"]["movement_class"]
          movement_type: Database["public"]["Enums"]["movement_type"]
          note: string | null
          posted_by: string | null
          posted_by_name: string | null
          project_id: string
          qty: number
          qty_base: number
          ref_id: string | null
          ref_line_id: string | null
          ref_type: string | null
          reverses_id: string | null
          sku_id: string
          unit_cost: number | null
          uom: Database["public"]["Enums"]["uom"]
        }
        Insert: {
          batch_ref?: string | null
          counterparty_project?: string | null
          created_at?: string
          firm_id: string
          id?: string
          idempotency_key?: string | null
          location?: string | null
          movement_class: Database["public"]["Enums"]["movement_class"]
          movement_type: Database["public"]["Enums"]["movement_type"]
          note?: string | null
          posted_by?: string | null
          posted_by_name?: string | null
          project_id: string
          qty: number
          qty_base: number
          ref_id?: string | null
          ref_line_id?: string | null
          ref_type?: string | null
          reverses_id?: string | null
          sku_id: string
          unit_cost?: number | null
          uom: Database["public"]["Enums"]["uom"]
        }
        Update: {
          batch_ref?: string | null
          counterparty_project?: string | null
          created_at?: string
          firm_id?: string
          id?: string
          idempotency_key?: string | null
          location?: string | null
          movement_class?: Database["public"]["Enums"]["movement_class"]
          movement_type?: Database["public"]["Enums"]["movement_type"]
          note?: string | null
          posted_by?: string | null
          posted_by_name?: string | null
          project_id?: string
          qty?: number
          qty_base?: number
          ref_id?: string | null
          ref_line_id?: string | null
          ref_type?: string | null
          reverses_id?: string | null
          sku_id?: string
          unit_cost?: number | null
          uom?: Database["public"]["Enums"]["uom"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_counterparty_project_fkey"
            columns: ["counterparty_project"]
            isOneToOne: false
            referencedRelation: "crm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "crm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          dispatched_qty: number
          firm_id: string
          id: string
          order_index: number
          quantity: number
          received_qty: number
          sku_id: string
          transfer_id: string
          uom: Database["public"]["Enums"]["uom"]
        }
        Insert: {
          dispatched_qty?: number
          firm_id: string
          id?: string
          order_index?: number
          quantity?: number
          received_qty?: number
          sku_id: string
          transfer_id: string
          uom: Database["public"]["Enums"]["uom"]
        }
        Update: {
          dispatched_qty?: number
          firm_id?: string
          id?: string
          order_index?: number
          quantity?: number
          received_qty?: number
          sku_id?: string
          transfer_id?: string
          uom?: Database["public"]["Enums"]["uom"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_name: string | null
          dispatched_at: string | null
          firm_id: string
          from_location: string | null
          from_project: string
          id: string
          note: string | null
          received_at: string | null
          status: Database["public"]["Enums"]["transfer_status"]
          to_location: string | null
          to_project: string
          transfer_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          dispatched_at?: string | null
          firm_id: string
          from_location?: string | null
          from_project: string
          id?: string
          note?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_location?: string | null
          to_project: string
          transfer_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          dispatched_at?: string | null
          firm_id?: string
          from_location?: string | null
          from_project?: string
          id?: string
          note?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_location?: string | null
          to_project?: string
          transfer_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_from_project_fkey"
            columns: ["from_project"]
            isOneToOne: false
            referencedRelation: "crm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_project_fkey"
            columns: ["to_project"]
            isOneToOne: false
            referencedRelation: "crm_projects"
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
      catalog_products_effective: {
        Row: {
          attributes: Json | null
          base_uom: Database["public"]["Enums"]["uom"] | null
          category_id: string | null
          created_at: string | null
          firm_id: string | null
          gst_rate: number | null
          hsn_code: string | null
          id: string | null
          install_loss: number | null
          is_active: boolean | null
          is_overridden: boolean | null
          name: string | null
          packaging_loss: number | null
          secondary_uom: Database["public"]["Enums"]["uom"] | null
          uom_conversion: number | null
          updated_at: string | null
          waste_factor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_products_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      module_templates_effective: {
        Row: {
          category: string | null
          code: string | null
          created_at: string | null
          derived_vars: Json | null
          description: string | null
          firm_id: string | null
          id: string | null
          is_active: boolean | null
          is_fork: boolean | null
          name: string | null
          param_schema: Json | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          category?: string | null
          code?: string | null
          created_at?: string | null
          derived_vars?: Json | null
          description?: string | null
          firm_id?: string | null
          id?: string | null
          is_active?: boolean | null
          is_fork?: never
          name?: string | null
          param_schema?: Json | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          category?: string | null
          code?: string | null
          created_at?: string | null
          derived_vars?: Json | null
          description?: string | null
          firm_id?: string | null
          id?: string | null
          is_active?: boolean | null
          is_fork?: never
          name?: string | null
          param_schema?: Json | null
          updated_at?: string | null
          version?: number | null
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
      stock_balances: {
        Row: {
          available: number | null
          firm_id: string | null
          last_movement_at: string | null
          on_hand: number | null
          project_id: string | null
          reserved: number | null
          sku_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "crm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_position: {
        Row: {
          approved_demand: number | null
          available: number | null
          firm_id: string | null
          last_movement_at: string | null
          on_hand: number | null
          on_order: number | null
          project_id: string | null
          projected: number | null
          reserved: number | null
          sku_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_quote: {
        Args: { p_name: string; p_selected: string[]; p_token: string }
        Returns: Json
      }
      approve_purchase_order: {
        Args: { p_decision: string; p_notes?: string; p_po_id: string }
        Returns: Json
      }
      catalog_product_override_clear: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      catalog_product_override_set: {
        Args: { p_patch: Json; p_product_id: string }
        Returns: Json
      }
      create_invite: {
        Args: {
          p_email: string
          p_full_name: string
          p_phone?: string
          p_role_id?: string
        }
        Returns: Json
      }
      create_lead_intake_token: { Args: { p_label?: string }; Returns: Json }
      crm_actor_is_admin: { Args: never; Returns: boolean }
      crm_current_role_id: { Args: never; Returns: string }
      crm_has_permission: {
        Args: { p_action: string; p_module: string }
        Returns: boolean
      }
      crm_oauth_state_hash: { Args: { p_state: string }; Returns: string }
      crm_webhook_token_hash: { Args: { p_token: string }; Returns: string }
      current_firm_id: { Args: never; Returns: string }
      inv_alert: {
        Args: {
          p_dedupe: string
          p_firm: string
          p_link: string
          p_msg: string
          p_project: string
          p_ref_id: string
          p_ref_type: string
          p_sev: string
          p_sku: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      inv_available: {
        Args: { p_firm: string; p_project: string; p_sku: string }
        Returns: number
      }
      inv_award_rfq: {
        Args: { p_awards: Json; p_id: string }
        Returns: undefined
      }
      inv_base_uom: {
        Args: { p_sku: string }
        Returns: Database["public"]["Enums"]["uom"]
      }
      inv_cancel_material_request: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      inv_create_task: {
        Args: {
          p_assignee: string
          p_assignee_name: string
          p_due: string
          p_firm: string
          p_link_id: string
          p_link_label: string
          p_link_type: string
          p_priority: string
          p_project: string
          p_title: string
        }
        Returns: undefined
      }
      inv_current_actor: {
        Args: never
        Returns: {
          firm_id: string
          full_name: string
          is_admin: boolean
          profile_id: string
          role_id: string
        }[]
      }
      inv_decide_adjustment: {
        Args: { p_decision: string; p_id: string; p_notes: string }
        Returns: undefined
      }
      inv_decide_material_request: {
        Args: {
          p_decision: string
          p_id: string
          p_item_approvals: Json
          p_notes: string
        }
        Returns: undefined
      }
      inv_decide_po: {
        Args: { p_decision: string; p_id: string; p_notes: string }
        Returns: undefined
      }
      inv_dispatch_transfer: { Args: { p_id: string }; Returns: undefined }
      inv_emit: {
        Args: { p_event: string; p_firm: string; p_payload: Json }
        Returns: undefined
      }
      inv_first_admin: {
        Args: { p_firm: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      inv_issue_po: { Args: { p_id: string }; Returns: undefined }
      inv_log: {
        Args: {
          p_action: string
          p_actor: string
          p_details: string
          p_eid: string
          p_ename: string
          p_etype: string
          p_firm: string
          p_label: string
          p_module: string
        }
        Returns: undefined
      }
      inv_next_number: {
        Args: { p_doc: string; p_firm: string; p_prefix: string }
        Returns: string
      }
      inv_notify: {
        Args: {
          p_firm: string
          p_link: string
          p_message: string
          p_title: string
          p_type: string
          p_user: string
        }
        Returns: undefined
      }
      inv_notify_admins: {
        Args: {
          p_firm: string
          p_link: string
          p_msg: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      inv_notify_team: {
        Args: {
          p_firm: string
          p_link: string
          p_msg: string
          p_project: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      inv_post_consumption: { Args: { p_id: string }; Returns: undefined }
      inv_post_count: { Args: { p_id: string }; Returns: undefined }
      inv_post_goods_receipt: { Args: { p_id: string }; Returns: undefined }
      inv_post_movement: {
        Args: {
          p_actor: string
          p_actor_name: string
          p_batch: string
          p_counterparty: string
          p_firm: string
          p_idem: string
          p_location: string
          p_note: string
          p_project: string
          p_qty: number
          p_ref_id: string
          p_ref_line: string
          p_ref_type: string
          p_sku: string
          p_type: Database["public"]["Enums"]["movement_type"]
          p_unit_cost: number
          p_uom: Database["public"]["Enums"]["uom"]
        }
        Returns: string
      }
      inv_process_outbox: { Args: { p_limit?: number }; Returns: number }
      inv_receive_transfer: {
        Args: { p_id: string; p_received: Json }
        Returns: undefined
      }
      inv_record_quote: {
        Args: { p_quote_items: Json; p_rfq_vendor_id: string; p_terms: Json }
        Returns: undefined
      }
      inv_refresh_alerts: { Args: never; Returns: number }
      inv_release_reservation: {
        Args: {
          p_note: string
          p_project: string
          p_qty: number
          p_ref_id: string
          p_ref_type: string
          p_sku: string
          p_uom: Database["public"]["Enums"]["uom"]
        }
        Returns: string
      }
      inv_require: {
        Args: { p_action: string; p_module: string }
        Returns: undefined
      }
      inv_reserve_stock: {
        Args: {
          p_note: string
          p_project: string
          p_qty: number
          p_ref_id: string
          p_ref_type: string
          p_sku: string
          p_uom: Database["public"]["Enums"]["uom"]
        }
        Returns: string
      }
      inv_reverse_movement: {
        Args: { p_movement_id: string; p_note: string }
        Returns: string
      }
      inv_save_adjustment: {
        Args: { p_items: Json; p_payload: Json }
        Returns: string
      }
      inv_save_consumption: {
        Args: { p_items: Json; p_payload: Json }
        Returns: string
      }
      inv_save_count: {
        Args: { p_items: Json; p_payload: Json }
        Returns: string
      }
      inv_save_goods_receipt: {
        Args: { p_items: Json; p_payload: Json }
        Returns: string
      }
      inv_save_item_setting: {
        Args: {
          p_lead: number
          p_max: number
          p_notes: string
          p_project: string
          p_reorder: number
          p_safety: number
          p_sku: string
          p_vendor: string
        }
        Returns: string
      }
      inv_save_material_request: {
        Args: { p_items: Json; p_payload: Json }
        Returns: string
      }
      inv_save_purchase_order: {
        Args: { p_items: Json; p_payload: Json }
        Returns: string
      }
      inv_save_rfq: {
        Args: { p_items: Json; p_payload: Json; p_vendors: Json }
        Returns: string
      }
      inv_save_transfer: {
        Args: { p_items: Json; p_payload: Json }
        Returns: string
      }
      inv_send_rfq: { Args: { p_id: string }; Returns: undefined }
      inv_submit_adjustment: { Args: { p_id: string }; Returns: undefined }
      inv_submit_material_request: {
        Args: { p_expected_version: number; p_id: string }
        Returns: undefined
      }
      inv_submit_po: {
        Args: { p_expected_version: number; p_id: string }
        Returns: undefined
      }
      inv_to_base: {
        Args: {
          p_qty: number
          p_sku: string
          p_uom: Database["public"]["Enums"]["uom"]
        }
        Returns: number
      }
      invite_claim: { Args: { p_token: string }; Returns: Json }
      invite_finalize: {
        Args: { p_auth_uid: string; p_invite_id: string }
        Returns: Json
      }
      invite_release: { Args: { p_invite_id: string }; Returns: undefined }
      lead_intake_capture: {
        Args: {
          p_email?: string
          p_message?: string
          p_name: string
          p_phone?: string
          p_project_type?: string
          p_token: string
        }
        Returns: Json
      }
      list_invites: {
        Args: never
        Returns: {
          accepted_at: string
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          role_id: string
        }[]
      }
      list_lead_intake_tokens: {
        Args: never
        Returns: {
          created_at: string
          id: string
          label: string
          last_used_at: string
          revoked_at: string
        }[]
      }
      meta_oauth_begin: { Args: { p_redirect_uri: string }; Returns: Json }
      meta_oauth_consume: { Args: { p_state: string }; Returns: Json }
      meta_oauth_link_accounts: {
        Args: { p_accounts: Json; p_firm_id: string }
        Returns: number
      }
      meta_oauth_store_token: {
        Args: { p_expires_at?: string; p_firm_id: string; p_token: string }
        Returns: Json
      }
      module_rule_delete: { Args: { p_rule_id: string }; Returns: Json }
      module_rule_save: {
        Args: { p_data: Json; p_rule_id: string; p_template_id: string }
        Returns: Json
      }
      module_template_fork: { Args: { p_template_id: string }; Returns: string }
      module_template_set_meta: {
        Args: { p_patch: Json; p_template_id: string }
        Returns: string
      }
      quote_compute_totals: {
        Args: {
          p_boq_id: string
          p_design: number
          p_disc: number
          p_other: number
          p_selected: string[]
          p_super: number
        }
        Returns: {
          discount: number
          fees: number
          grand_total: number
          gst: number
          items_subtotal: number
          optionals_subtotal: number
          taxable: number
        }[]
      }
      quote_public_view: { Args: { p_token: string }; Returns: Json }
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
      revoke_invite: { Args: { p_invite_id: string }; Returns: undefined }
      revoke_lead_intake_token: { Args: { p_id: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      telephony_request_call: { Args: { p_lead_id: string }; Returns: Json }
      telephony_settle_call: {
        Args: {
          p_call_sid?: string
          p_error?: string
          p_id: string
          p_status: string
        }
        Returns: undefined
      }
      text2ltree: { Args: { "": string }; Returns: unknown }
      validate_invite: { Args: { p_token: string }; Returns: Json }
    }
    Enums: {
      adjustment_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "posted"
        | "rejected"
        | "cancelled"
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
      consumption_status: "draft" | "posted" | "cancelled"
      count_status: "draft" | "counting" | "posted" | "cancelled"
      extraction_status:
        | "pending"
        | "processing"
        | "needs_review"
        | "confirmed"
        | "failed"
      grn_status: "draft" | "posted" | "cancelled"
      module_output_kind: "material" | "labour" | "hardware" | "service"
      movement_class: "physical" | "reserved"
      movement_type:
        | "opening_balance"
        | "purchase_receipt"
        | "site_consumption"
        | "reservation"
        | "reservation_release"
        | "transfer_out"
        | "transfer_in"
        | "supplier_return"
        | "write_off"
        | "positive_adjustment"
        | "negative_adjustment"
        | "reversal"
      mr_status:
        | "draft"
        | "submitted"
        | "approved"
        | "in_procurement"
        | "partially_ordered"
        | "ordered"
        | "fulfilled"
        | "rejected"
        | "cancelled"
      po_status:
        | "draft"
        | "issued"
        | "partially_received"
        | "received"
        | "closed"
        | "cancelled"
        | "pending_approval"
        | "approved"
        | "needs_changes"
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
      rfq_status:
        | "draft"
        | "sent"
        | "quotes_received"
        | "evaluated"
        | "awarded"
        | "closed"
        | "cancelled"
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
      transfer_status: "draft" | "dispatched" | "received" | "cancelled"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      adjustment_status: [
        "draft",
        "pending_approval",
        "approved",
        "posted",
        "rejected",
        "cancelled",
      ],
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
      consumption_status: ["draft", "posted", "cancelled"],
      count_status: ["draft", "counting", "posted", "cancelled"],
      extraction_status: [
        "pending",
        "processing",
        "needs_review",
        "confirmed",
        "failed",
      ],
      grn_status: ["draft", "posted", "cancelled"],
      module_output_kind: ["material", "labour", "hardware", "service"],
      movement_class: ["physical", "reserved"],
      movement_type: [
        "opening_balance",
        "purchase_receipt",
        "site_consumption",
        "reservation",
        "reservation_release",
        "transfer_out",
        "transfer_in",
        "supplier_return",
        "write_off",
        "positive_adjustment",
        "negative_adjustment",
        "reversal",
      ],
      mr_status: [
        "draft",
        "submitted",
        "approved",
        "in_procurement",
        "partially_ordered",
        "ordered",
        "fulfilled",
        "rejected",
        "cancelled",
      ],
      po_status: [
        "draft",
        "issued",
        "partially_received",
        "received",
        "closed",
        "cancelled",
        "pending_approval",
        "approved",
        "needs_changes",
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
      rfq_status: [
        "draft",
        "sent",
        "quotes_received",
        "evaluated",
        "awarded",
        "closed",
        "cancelled",
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
      transfer_status: ["draft", "dispatched", "received", "cancelled"],
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
