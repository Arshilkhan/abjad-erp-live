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
      backup_history: {
        Row: {
          created_by: string | null
          drive_file_id: string | null
          drive_link: string | null
          error: string | null
          file_name: string | null
          file_size: number | null
          finished_at: string | null
          id: string
          invoice_count: number | null
          started_at: string
          status: string
          trigger_source: string
        }
        Insert: {
          created_by?: string | null
          drive_file_id?: string | null
          drive_link?: string | null
          error?: string | null
          file_name?: string | null
          file_size?: number | null
          finished_at?: string | null
          id?: string
          invoice_count?: number | null
          started_at?: string
          status?: string
          trigger_source?: string
        }
        Update: {
          created_by?: string | null
          drive_file_id?: string | null
          drive_link?: string | null
          error?: string | null
          file_name?: string | null
          file_size?: number | null
          finished_at?: string | null
          id?: string
          invoice_count?: number | null
          started_at?: string
          status?: string
          trigger_source?: string
        }
        Relationships: []
      }
      backup_settings: {
        Row: {
          created_at: string
          frequency: string
          hour_utc: number
          id: string
          last_run_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          frequency?: string
          hour_utc?: number
          id?: string
          last_run_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          frequency?: string
          hour_utc?: number
          id?: string
          last_run_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      challan: {
        Row: {
          amount_in_words: string | null
          amount_paid: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cgst_amount: number | null
          challan_date: string | null
          challan_dates: string[]
          challan_number: string | null
          contact_mobile: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          customer_address_snapshot: string | null
          customer_gst_snapshot: string | null
          customer_id: string | null
          customer_name_snapshot: string | null
          delivery_charges: number
          delivery_mode: string | null
          discount_amount: number | null
          freight: number | null
          grand_total: number | null
          gst_arn: string | null
          id: string
          igst_amount: number | null
          import_source: string | null
          invoice_date: string
          invoice_number: string
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          is_igst: boolean | null
          is_imported: boolean
          movement_reason: string | null
          net_value: number | null
          notes: string | null
          other_charges: number | null
          packing_charges: number | null
          payment_terms: string | null
          place_of_delivery: string | null
          place_of_dispatch: string | null
          place_of_supply: string | null
          po_date: string | null
          po_number: string | null
          round_off: number | null
          sgst_amount: number | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number | null
          transportation_charges: number
          transporter_name: string | null
          updated_at: string
          work_order_number: string | null
        }
        Insert: {
          amount_in_words?: string | null
          amount_paid?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cgst_amount?: number | null
          challan_date?: string | null
          challan_dates?: string[]
          challan_number?: string | null
          contact_mobile?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_address_snapshot?: string | null
          customer_gst_snapshot?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          delivery_charges?: number
          delivery_mode?: string | null
          discount_amount?: number | null
          freight?: number | null
          grand_total?: number | null
          gst_arn?: string | null
          id?: string
          igst_amount?: number | null
          import_source?: string | null
          invoice_date?: string
          invoice_number: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          is_igst?: boolean | null
          is_imported?: boolean
          movement_reason?: string | null
          net_value?: number | null
          notes?: string | null
          other_charges?: number | null
          packing_charges?: number | null
          payment_terms?: string | null
          place_of_delivery?: string | null
          place_of_dispatch?: string | null
          place_of_supply?: string | null
          po_date?: string | null
          po_number?: string | null
          round_off?: number | null
          sgst_amount?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          transportation_charges?: number
          transporter_name?: string | null
          updated_at?: string
          work_order_number?: string | null
        }
        Update: {
          amount_in_words?: string | null
          amount_paid?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cgst_amount?: number | null
          challan_date?: string | null
          challan_dates?: string[]
          challan_number?: string | null
          contact_mobile?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_address_snapshot?: string | null
          customer_gst_snapshot?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          delivery_charges?: number
          delivery_mode?: string | null
          discount_amount?: number | null
          freight?: number | null
          grand_total?: number | null
          gst_arn?: string | null
          id?: string
          igst_amount?: number | null
          import_source?: string | null
          invoice_date?: string
          invoice_number?: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          is_igst?: boolean | null
          is_imported?: boolean
          movement_reason?: string | null
          net_value?: number | null
          notes?: string | null
          other_charges?: number | null
          packing_charges?: number | null
          payment_terms?: string | null
          place_of_delivery?: string | null
          place_of_dispatch?: string | null
          place_of_supply?: string | null
          po_date?: string | null
          po_number?: string | null
          round_off?: number | null
          sgst_amount?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          transportation_charges?: number
          transporter_name?: string | null
          updated_at?: string
          work_order_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challan_customer_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      challan_items: {
        Row: {
          accepted_quantity: number | null
          description: string
          discount_amount: number | null
          discount_pct: number | null
          hsn_code: string | null
          id: string
          invoice_id: string
          product_id: string | null
          quantity: number
          rejected_quantity: number
          serial_batch_number: string | null
          sr_no: number
          tax_amount: number | null
          tax_pct: number | null
          total_amount: number
          unit_rate: number
          uom: string | null
        }
        Insert: {
          accepted_quantity?: number | null
          description: string
          discount_amount?: number | null
          discount_pct?: number | null
          hsn_code?: string | null
          id?: string
          invoice_id: string
          product_id?: string | null
          quantity?: number
          rejected_quantity?: number
          serial_batch_number?: string | null
          sr_no: number
          tax_amount?: number | null
          tax_pct?: number | null
          total_amount?: number
          unit_rate?: number
          uom?: string | null
        }
        Update: {
          accepted_quantity?: number | null
          description?: string
          discount_amount?: number | null
          discount_pct?: number | null
          hsn_code?: string | null
          id?: string
          invoice_id?: string
          product_id?: string | null
          quantity?: number
          rejected_quantity?: number
          serial_batch_number?: string | null
          sr_no?: number
          tax_amount?: number | null
          tax_pct?: number | null
          total_amount?: number
          unit_rate?: number
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challan_items_parent_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "challan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challan_items_product_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      company_profile: {
        Row: {
          address: string | null
          alt_mobile: string | null
          bank_account: string | null
          bank_branch: string | null
          bank_branch_code: string | null
          bank_ifsc: string | null
          bank_name: string | null
          city: string | null
          created_at: string
          currency: string | null
          declaration: string | null
          email: string | null
          financial_year: string | null
          gst_number: string | null
          id: string
          invoice_prefix: string | null
          logo_url: string | null
          mobile: string | null
          name: string
          pan_number: string | null
          pincode: string | null
          po_prefix: string | null
          quotation_prefix: string | null
          state: string | null
          state_code: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          alt_mobile?: string | null
          bank_account?: string | null
          bank_branch?: string | null
          bank_branch_code?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string
          currency?: string | null
          declaration?: string | null
          email?: string | null
          financial_year?: string | null
          gst_number?: string | null
          id?: string
          invoice_prefix?: string | null
          logo_url?: string | null
          mobile?: string | null
          name?: string
          pan_number?: string | null
          pincode?: string | null
          po_prefix?: string | null
          quotation_prefix?: string | null
          state?: string | null
          state_code?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          alt_mobile?: string | null
          bank_account?: string | null
          bank_branch?: string | null
          bank_branch_code?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          created_at?: string
          currency?: string | null
          declaration?: string | null
          email?: string | null
          financial_year?: string | null
          gst_number?: string | null
          id?: string
          invoice_prefix?: string | null
          logo_url?: string | null
          mobile?: string | null
          name?: string
          pan_number?: string | null
          pincode?: string | null
          po_prefix?: string | null
          quotation_prefix?: string | null
          state?: string | null
          state_code?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      customer_credits: {
        Row: {
          created_at: string
          credit_amount: number
          customer_id: string | null
          id: string
          notes: string | null
          source_invoice_id: string | null
          source_rejection_id: string | null
          status: string
          updated_at: string
          used_amount: number
        }
        Insert: {
          created_at?: string
          credit_amount?: number
          customer_id?: string | null
          id?: string
          notes?: string | null
          source_invoice_id?: string | null
          source_rejection_id?: string | null
          status?: string
          updated_at?: string
          used_amount?: number
        }
        Update: {
          created_at?: string
          credit_amount?: number
          customer_id?: string | null
          id?: string
          notes?: string | null
          source_invoice_id?: string | null
          source_rejection_id?: string | null
          status?: string
          updated_at?: string
          used_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_credits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_source_invoice_id_fkey"
            columns: ["source_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_source_rejection_id_fkey"
            columns: ["source_rejection_id"]
            isOneToOne: false
            referencedRelation: "invoice_rejections"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          billing_address: string | null
          company_name: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          customer_name: string
          email: string | null
          gst_number: string | null
          id: string
          mobile: string | null
          notes: string | null
          pan_number: string | null
          payment_terms: string | null
          place_of_supply: string | null
          shipping_address: string | null
          state: string | null
          state_code: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          customer_name: string
          email?: string | null
          gst_number?: string | null
          id?: string
          mobile?: string | null
          notes?: string | null
          pan_number?: string | null
          payment_terms?: string | null
          place_of_supply?: string | null
          shipping_address?: string | null
          state?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          customer_name?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          mobile?: string | null
          notes?: string | null
          pan_number?: string | null
          payment_terms?: string | null
          place_of_supply?: string | null
          shipping_address?: string | null
          state?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      f_year: {
        Row: {
          id: string;
          year_label: string;
          start_date: string;
          end_date: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          year_label: string;
          start_date: string;
          end_date: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          year_label?: string;
          start_date?: string;
          end_date?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      google_drive_credentials: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          account_email: string | null
          connected_by: string | null
          created_at: string
          folder_id: string | null
          id: string
          refresh_token: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          account_email?: string | null
          connected_by?: string | null
          created_at?: string
          folder_id?: string | null
          id?: string
          refresh_token: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          account_email?: string | null
          connected_by?: string | null
          created_at?: string
          folder_id?: string | null
          id?: string
          refresh_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_configuration: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          id: string
          is_editable: boolean
          is_mandatory: boolean
          is_read_only: boolean
          is_visible: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          id?: string
          is_editable?: boolean
          is_mandatory?: boolean
          is_read_only?: boolean
          is_visible?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          id?: string
          is_editable?: boolean
          is_mandatory?: boolean
          is_read_only?: boolean
          is_visible?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      invoice_history: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          created_at: string
          description: string | null
          event_type: string
          id: string
          invoice_id: string
          metadata: Json | null
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          invoice_id: string
          metadata?: Json | null
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          invoice_id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          accepted_quantity: number | null
          description: string
          discount_amount: number | null
          discount_pct: number | null
          hsn_code: string | null
          id: string
          invoice_id: string
          product_id: string | null
          quantity: number
          rejected_quantity: number
          serial_batch_number: string | null
          sr_no: number
          tax_amount: number | null
          tax_pct: number | null
          total_amount: number
          unit_rate: number
          uom: string | null
        }
        Insert: {
          accepted_quantity?: number | null
          description: string
          discount_amount?: number | null
          discount_pct?: number | null
          hsn_code?: string | null
          id?: string
          invoice_id: string
          product_id?: string | null
          quantity?: number
          rejected_quantity?: number
          serial_batch_number?: string | null
          sr_no: number
          tax_amount?: number | null
          tax_pct?: number | null
          total_amount?: number
          unit_rate?: number
          uom?: string | null
        }
        Update: {
          accepted_quantity?: number | null
          description?: string
          discount_amount?: number | null
          discount_pct?: number | null
          hsn_code?: string | null
          id?: string
          invoice_id?: string
          product_id?: string | null
          quantity?: number
          rejected_quantity?: number
          serial_batch_number?: string | null
          sr_no?: number
          tax_amount?: number | null
          tax_pct?: number | null
          total_amount?: number
          unit_rate?: number
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_rejections: {
        Row: {
          actor_id: string | null
          created_at: string
          disposition: string
          gst_deduction: number
          id: string
          invoice_id: string
          invoice_item_id: string
          reason_notes: string | null
          rejected_quantity: number
          rejected_value: number
          rejection_reason: string
          tax_pct: number
          total_deduction: number
          unit_rate: number
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          disposition?: string
          gst_deduction?: number
          id?: string
          invoice_id: string
          invoice_item_id: string
          reason_notes?: string | null
          rejected_quantity: number
          rejected_value?: number
          rejection_reason: string
          tax_pct?: number
          total_deduction?: number
          unit_rate?: number
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          disposition?: string
          gst_deduction?: number
          id?: string
          invoice_id?: string
          invoice_item_id?: string
          reason_notes?: string | null
          rejected_quantity?: number
          rejected_value?: number
          rejection_reason?: string
          tax_pct?: number
          total_deduction?: number
          unit_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_rejections_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_rejections_invoice_item_id_fkey"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_settings: {
        Row: {
          id: string
          mandatory_challan_number: boolean | null
          mandatory_contact_person: boolean | null
          mandatory_delivery: boolean | null
          mandatory_discount: boolean | null
          mandatory_freight: boolean | null
          mandatory_gst_number: boolean | null
          mandatory_packing_charges: boolean | null
          mandatory_pan_number: boolean | null
          mandatory_po_number: boolean | null
          show_bank_details: boolean | null
          show_challan_number: boolean | null
          show_company_seal: boolean | null
          show_contact_person: boolean | null
          show_declaration: boolean | null
          show_delivery: boolean | null
          show_discount: boolean | null
          show_freight: boolean | null
          show_gst_arn: boolean | null
          show_gst_number: boolean | null
          show_packing_charges: boolean | null
          show_pan_number: boolean | null
          show_po_number: boolean | null
          show_signature: boolean | null
          show_work_order: boolean | null
          updated_at: string
        }
        Insert: {
          id?: string
          mandatory_challan_number?: boolean | null
          mandatory_contact_person?: boolean | null
          mandatory_delivery?: boolean | null
          mandatory_discount?: boolean | null
          mandatory_freight?: boolean | null
          mandatory_gst_number?: boolean | null
          mandatory_packing_charges?: boolean | null
          mandatory_pan_number?: boolean | null
          mandatory_po_number?: boolean | null
          show_bank_details?: boolean | null
          show_challan_number?: boolean | null
          show_company_seal?: boolean | null
          show_contact_person?: boolean | null
          show_declaration?: boolean | null
          show_delivery?: boolean | null
          show_discount?: boolean | null
          show_freight?: boolean | null
          show_gst_arn?: boolean | null
          show_gst_number?: boolean | null
          show_packing_charges?: boolean | null
          show_pan_number?: boolean | null
          show_po_number?: boolean | null
          show_signature?: boolean | null
          show_work_order?: boolean | null
          updated_at?: string
        }
        Update: {
          id?: string
          mandatory_challan_number?: boolean | null
          mandatory_contact_person?: boolean | null
          mandatory_delivery?: boolean | null
          mandatory_discount?: boolean | null
          mandatory_freight?: boolean | null
          mandatory_gst_number?: boolean | null
          mandatory_packing_charges?: boolean | null
          mandatory_pan_number?: boolean | null
          mandatory_po_number?: boolean | null
          show_bank_details?: boolean | null
          show_challan_number?: boolean | null
          show_company_seal?: boolean | null
          show_contact_person?: boolean | null
          show_declaration?: boolean | null
          show_delivery?: boolean | null
          show_discount?: boolean | null
          show_freight?: boolean | null
          show_gst_arn?: boolean | null
          show_gst_number?: boolean | null
          show_packing_charges?: boolean | null
          show_pan_number?: boolean | null
          show_po_number?: boolean | null
          show_signature?: boolean | null
          show_work_order?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_in_words: string | null
          amount_paid: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cgst_amount: number | null
          challan_date: string | null
          challan_dates: string[]
          challan_number: string | null
          contact_mobile: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          customer_address_snapshot: string | null
          customer_gst_snapshot: string | null
          customer_id: string | null
          customer_name_snapshot: string | null
          delivery_charges: number
          delivery_mode: string | null
          discount_amount: number | null
          freight: number | null
          financial_year_id: string | null
          grand_total: number | null
          gst_arn: string | null
          id: string
          igst_amount: number | null
          import_source: string | null
          invoice_date: string
          invoice_number: string
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          is_igst: boolean | null
          is_imported: boolean
          movement_reason: string | null
          net_value: number | null
          notes: string | null
          other_charges: number | null
          packing_charges: number | null
          payment_terms: string | null
          place_of_delivery: string | null
          place_of_dispatch: string | null
          place_of_supply: string | null
          po_date: string | null
          po_number: string | null
          round_off: number | null
          sgst_amount: number | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number | null
          transportation_charges: number
          transporter_name: string | null
          updated_at: string
          work_order_number: string | null
        }
        Insert: {
          amount_in_words?: string | null
          amount_paid?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cgst_amount?: number | null
          challan_date?: string | null
          challan_dates?: string[]
          challan_number?: string | null
          contact_mobile?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_address_snapshot?: string | null
          customer_gst_snapshot?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          delivery_charges?: number
          delivery_mode?: string | null
          discount_amount?: number | null
          freight?: number | null
          financial_year_id?: string | null
          grand_total?: number | null
          gst_arn?: string | null
          id?: string
          igst_amount?: number | null
          import_source?: string | null
          invoice_date?: string
          invoice_number: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          is_igst?: boolean | null
          is_imported?: boolean
          movement_reason?: string | null
          net_value?: number | null
          notes?: string | null
          other_charges?: number | null
          packing_charges?: number | null
          payment_terms?: string | null
          place_of_delivery?: string | null
          place_of_dispatch?: string | null
          place_of_supply?: string | null
          po_date?: string | null
          po_number?: string | null
          round_off?: number | null
          sgst_amount?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          transportation_charges?: number
          transporter_name?: string | null
          updated_at?: string
          work_order_number?: string | null
        }
        Update: {
          amount_in_words?: string | null
          amount_paid?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cgst_amount?: number | null
          challan_date?: string | null
          challan_dates?: string[]
          challan_number?: string | null
          contact_mobile?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_address_snapshot?: string | null
          customer_gst_snapshot?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          delivery_charges?: number
          delivery_mode?: string | null
          discount_amount?: number | null
          freight?: number | null
          financial_year_id?: string | null
          grand_total?: number | null
          gst_arn?: string | null
          id?: string
          igst_amount?: number | null
          import_source?: string | null
          invoice_date?: string
          invoice_number?: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          is_igst?: boolean | null
          is_imported?: boolean
          movement_reason?: string | null
          net_value?: number | null
          notes?: string | null
          other_charges?: number | null
          packing_charges?: number | null
          payment_terms?: string | null
          place_of_delivery?: string | null
          place_of_dispatch?: string | null
          place_of_supply?: string | null
          po_date?: string | null
          po_number?: string | null
          round_off?: number | null
          sgst_amount?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          transportation_charges?: number
          transporter_name?: string | null
          updated_at?: string
          work_order_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_financial_year_id_fkey";
            columns: ["financial_year_id"];
            isOneToOne: false;
            referencedRelation: "f_year";
            referencedColumns: ["id"];
          }
        ];
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          mode: string
          notes: string | null
          payment_date: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          mode?: string
          notes?: string | null
          payment_date?: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          mode?: string
          notes?: string | null
          payment_date?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      performa: {
        Row: {
          amount_in_words: string | null
          amount_paid: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cgst_amount: number | null
          challan_date: string | null
          challan_dates: string[]
          challan_number: string | null
          contact_mobile: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          customer_address_snapshot: string | null
          customer_gst_snapshot: string | null
          customer_id: string | null
          customer_name_snapshot: string | null
          delivery_charges: number
          delivery_mode: string | null
          discount_amount: number | null
          freight: number | null
          grand_total: number | null
          gst_arn: string | null
          id: string
          igst_amount: number | null
          import_source: string | null
          invoice_date: string
          invoice_number: string
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          is_igst: boolean | null
          is_imported: boolean
          movement_reason: string | null
          net_value: number | null
          notes: string | null
          other_charges: number | null
          packing_charges: number | null
          payment_terms: string | null
          place_of_delivery: string | null
          place_of_dispatch: string | null
          place_of_supply: string | null
          po_date: string | null
          po_number: string | null
          round_off: number | null
          sgst_amount: number | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number | null
          transportation_charges: number
          transporter_name: string | null
          updated_at: string
          work_order_number: string | null
        }
        Insert: {
          amount_in_words?: string | null
          amount_paid?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cgst_amount?: number | null
          challan_date?: string | null
          challan_dates?: string[]
          challan_number?: string | null
          contact_mobile?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_address_snapshot?: string | null
          customer_gst_snapshot?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          delivery_charges?: number
          delivery_mode?: string | null
          discount_amount?: number | null
          freight?: number | null
          grand_total?: number | null
          gst_arn?: string | null
          id?: string
          igst_amount?: number | null
          import_source?: string | null
          invoice_date?: string
          invoice_number: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          is_igst?: boolean | null
          is_imported?: boolean
          movement_reason?: string | null
          net_value?: number | null
          notes?: string | null
          other_charges?: number | null
          packing_charges?: number | null
          payment_terms?: string | null
          place_of_delivery?: string | null
          place_of_dispatch?: string | null
          place_of_supply?: string | null
          po_date?: string | null
          po_number?: string | null
          round_off?: number | null
          sgst_amount?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          transportation_charges?: number
          transporter_name?: string | null
          updated_at?: string
          work_order_number?: string | null
        }
        Update: {
          amount_in_words?: string | null
          amount_paid?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cgst_amount?: number | null
          challan_date?: string | null
          challan_dates?: string[]
          challan_number?: string | null
          contact_mobile?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_address_snapshot?: string | null
          customer_gst_snapshot?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          delivery_charges?: number
          delivery_mode?: string | null
          discount_amount?: number | null
          freight?: number | null
          grand_total?: number | null
          gst_arn?: string | null
          id?: string
          igst_amount?: number | null
          import_source?: string | null
          invoice_date?: string
          invoice_number?: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          is_igst?: boolean | null
          is_imported?: boolean
          movement_reason?: string | null
          net_value?: number | null
          notes?: string | null
          other_charges?: number | null
          packing_charges?: number | null
          payment_terms?: string | null
          place_of_delivery?: string | null
          place_of_dispatch?: string | null
          place_of_supply?: string | null
          po_date?: string | null
          po_number?: string | null
          round_off?: number | null
          sgst_amount?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          transportation_charges?: number
          transporter_name?: string | null
          updated_at?: string
          work_order_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performa_customer_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      performa_items: {
        Row: {
          accepted_quantity: number | null
          description: string
          discount_amount: number | null
          discount_pct: number | null
          hsn_code: string | null
          id: string
          invoice_id: string
          product_id: string | null
          quantity: number
          rejected_quantity: number
          serial_batch_number: string | null
          sr_no: number
          tax_amount: number | null
          tax_pct: number | null
          total_amount: number
          unit_rate: number
          uom: string | null
        }
        Insert: {
          accepted_quantity?: number | null
          description: string
          discount_amount?: number | null
          discount_pct?: number | null
          hsn_code?: string | null
          id?: string
          invoice_id: string
          product_id?: string | null
          quantity?: number
          rejected_quantity?: number
          serial_batch_number?: string | null
          sr_no: number
          tax_amount?: number | null
          tax_pct?: number | null
          total_amount?: number
          unit_rate?: number
          uom?: string | null
        }
        Update: {
          accepted_quantity?: number | null
          description?: string
          discount_amount?: number | null
          discount_pct?: number | null
          hsn_code?: string | null
          id?: string
          invoice_id?: string
          product_id?: string | null
          quantity?: number
          rejected_quantity?: number
          serial_batch_number?: string | null
          sr_no?: number
          tax_amount?: number | null
          tax_pct?: number | null
          total_amount?: number
          unit_rate?: number
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performa_items_parent_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "performa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performa_items_product_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          dimensions: string | null
          drawing_number: string | null
          gst_percentage: number | null
          hsn_code: string | null
          id: string
          image_url: string | null
          material: string | null
          maximum_stock: number | null
          minimum_stock: number | null
          product_code: string | null
          product_name: string
          purchase_price: number | null
          selling_price: number | null
          stock_quantity: number | null
          unit: string | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          dimensions?: string | null
          drawing_number?: string | null
          gst_percentage?: number | null
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          material?: string | null
          maximum_stock?: number | null
          minimum_stock?: number | null
          product_code?: string | null
          product_name: string
          purchase_price?: number | null
          selling_price?: number | null
          stock_quantity?: number | null
          unit?: string | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          dimensions?: string | null
          drawing_number?: string | null
          gst_percentage?: number | null
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          material?: string | null
          maximum_stock?: number | null
          minimum_stock?: number | null
          product_code?: string | null
          product_name?: string
          purchase_price?: number | null
          selling_price?: number | null
          stock_quantity?: number | null
          unit?: string | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          description: string
          hsn_code: string | null
          id: string
          product_id: string | null
          purchase_order_id: string
          quantity: number
          sr_no: number
          tax_amount: number
          tax_pct: number
          total_amount: number
          unit_rate: number
          uom: string | null
        }
        Insert: {
          created_at?: string
          description: string
          hsn_code?: string | null
          id?: string
          product_id?: string | null
          purchase_order_id: string
          quantity?: number
          sr_no?: number
          tax_amount?: number
          tax_pct?: number
          total_amount?: number
          unit_rate?: number
          uom?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          hsn_code?: string | null
          id?: string
          product_id?: string | null
          purchase_order_id?: string
          quantity?: number
          sr_no?: number
          tax_amount?: number
          tax_pct?: number
          total_amount?: number
          unit_rate?: number
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          cgst_amount: number
          created_at: string
          created_by: string | null
          discount_amount: number
          expected_date: string | null
          freight: number
          grand_total: number
          id: string
          igst_amount: number
          is_igst: boolean
          net_value: number
          notes: string | null
          packing_charges: number
          po_date: string
          po_number: string
          round_off: number
          sgst_amount: number
          status: string
          sub_total: number
          updated_at: string
          vendor_address_snapshot: string | null
          vendor_gst_snapshot: string | null
          vendor_id: string | null
          vendor_name_snapshot: string | null
        }
        Insert: {
          cgst_amount?: number
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          expected_date?: string | null
          freight?: number
          grand_total?: number
          id?: string
          igst_amount?: number
          is_igst?: boolean
          net_value?: number
          notes?: string | null
          packing_charges?: number
          po_date?: string
          po_number: string
          round_off?: number
          sgst_amount?: number
          status?: string
          sub_total?: number
          updated_at?: string
          vendor_address_snapshot?: string | null
          vendor_gst_snapshot?: string | null
          vendor_id?: string | null
          vendor_name_snapshot?: string | null
        }
        Update: {
          cgst_amount?: number
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          expected_date?: string | null
          freight?: number
          grand_total?: number
          id?: string
          igst_amount?: number
          is_igst?: boolean
          net_value?: number
          notes?: string | null
          packing_charges?: number
          po_date?: string
          po_number?: string
          round_off?: number
          sgst_amount?: number
          status?: string
          sub_total?: number
          updated_at?: string
          vendor_address_snapshot?: string | null
          vendor_gst_snapshot?: string | null
          vendor_id?: string | null
          vendor_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation: {
        Row: {
          amount_in_words: string | null
          amount_paid: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cgst_amount: number | null
          challan_date: string | null
          challan_dates: string[]
          challan_number: string | null
          contact_mobile: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          customer_address_snapshot: string | null
          customer_gst_snapshot: string | null
          customer_id: string | null
          customer_name_snapshot: string | null
          delivery_charges: number
          delivery_mode: string | null
          discount_amount: number | null
          freight: number | null
          grand_total: number | null
          gst_arn: string | null
          id: string
          igst_amount: number | null
          import_source: string | null
          invoice_date: string
          invoice_number: string
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          is_igst: boolean | null
          is_imported: boolean
          movement_reason: string | null
          net_value: number | null
          notes: string | null
          other_charges: number | null
          packing_charges: number | null
          payment_terms: string | null
          place_of_delivery: string | null
          place_of_dispatch: string | null
          place_of_supply: string | null
          po_date: string | null
          po_number: string | null
          round_off: number | null
          sgst_amount: number | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number | null
          transportation_charges: number
          transporter_name: string | null
          updated_at: string
          work_order_number: string | null
        }
        Insert: {
          amount_in_words?: string | null
          amount_paid?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cgst_amount?: number | null
          challan_date?: string | null
          challan_dates?: string[]
          challan_number?: string | null
          contact_mobile?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_address_snapshot?: string | null
          customer_gst_snapshot?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          delivery_charges?: number
          delivery_mode?: string | null
          discount_amount?: number | null
          freight?: number | null
          grand_total?: number | null
          gst_arn?: string | null
          id?: string
          igst_amount?: number | null
          import_source?: string | null
          invoice_date?: string
          invoice_number: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          is_igst?: boolean | null
          is_imported?: boolean
          movement_reason?: string | null
          net_value?: number | null
          notes?: string | null
          other_charges?: number | null
          packing_charges?: number | null
          payment_terms?: string | null
          place_of_delivery?: string | null
          place_of_dispatch?: string | null
          place_of_supply?: string | null
          po_date?: string | null
          po_number?: string | null
          round_off?: number | null
          sgst_amount?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          transportation_charges?: number
          transporter_name?: string | null
          updated_at?: string
          work_order_number?: string | null
        }
        Update: {
          amount_in_words?: string | null
          amount_paid?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cgst_amount?: number | null
          challan_date?: string | null
          challan_dates?: string[]
          challan_number?: string | null
          contact_mobile?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_address_snapshot?: string | null
          customer_gst_snapshot?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          delivery_charges?: number
          delivery_mode?: string | null
          discount_amount?: number | null
          freight?: number | null
          grand_total?: number | null
          gst_arn?: string | null
          id?: string
          igst_amount?: number | null
          import_source?: string | null
          invoice_date?: string
          invoice_number?: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          is_igst?: boolean | null
          is_imported?: boolean
          movement_reason?: string | null
          net_value?: number | null
          notes?: string | null
          other_charges?: number | null
          packing_charges?: number | null
          payment_terms?: string | null
          place_of_delivery?: string | null
          place_of_dispatch?: string | null
          place_of_supply?: string | null
          po_date?: string | null
          po_number?: string | null
          round_off?: number | null
          sgst_amount?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          transportation_charges?: number
          transporter_name?: string | null
          updated_at?: string
          work_order_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_customer_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          accepted_quantity: number | null
          description: string
          discount_amount: number | null
          discount_pct: number | null
          hsn_code: string | null
          id: string
          invoice_id: string
          product_id: string | null
          quantity: number
          rejected_quantity: number
          serial_batch_number: string | null
          sr_no: number
          tax_amount: number | null
          tax_pct: number | null
          total_amount: number
          unit_rate: number
          uom: string | null
        }
        Insert: {
          accepted_quantity?: number | null
          description: string
          discount_amount?: number | null
          discount_pct?: number | null
          hsn_code?: string | null
          id?: string
          invoice_id: string
          product_id?: string | null
          quantity?: number
          rejected_quantity?: number
          serial_batch_number?: string | null
          sr_no: number
          tax_amount?: number | null
          tax_pct?: number | null
          total_amount?: number
          unit_rate?: number
          uom?: string | null
        }
        Update: {
          accepted_quantity?: number | null
          description?: string
          discount_amount?: number | null
          discount_pct?: number | null
          hsn_code?: string | null
          id?: string
          invoice_id?: string
          product_id?: string | null
          quantity?: number
          rejected_quantity?: number
          serial_batch_number?: string | null
          sr_no?: number
          tax_amount?: number | null
          tax_pct?: number | null
          total_amount?: number
          unit_rate?: number
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_parent_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "quotation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_product_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          created_at: string
          id: string
          identifier: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: string
          identifier: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      rejected_inventory: {
        Row: {
          created_at: string
          description: string | null
          disposition: string
          id: string
          invoice_id: string | null
          product_id: string | null
          quantity: number
          reason: string | null
          rejection_id: string | null
          uom: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          disposition?: string
          id?: string
          invoice_id?: string | null
          product_id?: string | null
          quantity?: number
          reason?: string | null
          rejection_id?: string | null
          uom?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          disposition?: string
          id?: string
          invoice_id?: string | null
          product_id?: string | null
          quantity?: number
          reason?: string | null
          rejection_id?: string | null
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rejected_inventory_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rejected_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rejected_inventory_rejection_id_fkey"
            columns: ["rejection_id"]
            isOneToOne: false
            referencedRelation: "invoice_rejections"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          notes: string | null
          product_id: string
          quantity: number
          reference: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          notes?: string | null
          product_id: string
          quantity: number
          reference?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          notes?: string | null
          product_id?: string
          quantity?: number
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_panel_permissions: {
        Row: {
          created_at: string
          id: string
          panel: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          panel: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          panel?: string
          user_id?: string
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
      vendors: {
        Row: {
          address: string | null
          bank_account: string | null
          bank_ifsc: string | null
          bank_name: string | null
          city: string | null
          company_name: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          gst_number: string | null
          id: string
          mobile: string | null
          notes: string | null
          pan_number: string | null
          payment_terms: string | null
          pincode: string | null
          state: string | null
          state_code: string | null
          updated_at: string
          vendor_name: string
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          mobile?: string | null
          notes?: string | null
          pan_number?: string | null
          payment_terms?: string | null
          pincode?: string | null
          state?: string | null
          state_code?: string | null
          updated_at?: string
          vendor_name: string
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          mobile?: string | null
          notes?: string | null
          pan_number?: string | null
          payment_terms?: string | null
          pincode?: string | null
          state?: string | null
          state_code?: string | null
          updated_at?: string
          vendor_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bulk_import_tax_invoice: {
        Args: {
          p_invoice: Json;
          p_items: Json;
        };
        Returns: string;
      };
      amount_in_words: { Args: { amount: number }; Returns: string }
      can_edit_panel: { Args: { _panel: string }; Returns: boolean }
      can_write: { Args: { _user_id?: string }; Returns: boolean }
      has_panel: {
        Args: { _panel: string; _user_id?: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id?: string }; Returns: boolean }
      num_words_below_hundred: { Args: { n: number }; Returns: string }
      recalc_invoice_totals: {
        Args: { _invoice_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
      | "super_admin"
      | "admin"
      | "accountant"
      | "sales_executive"
      | "viewer"
      invoice_status: "draft" | "sent" | "paid" | "partial" | "cancelled"
      invoice_type:
      | "tax_invoice"
      | "proforma"
      | "quotation"
      | "purchase_order"
      | "delivery_challan"
      | "credit_note"
      | "debit_note"
      stock_movement_type:
      | "stock_in"
      | "stock_out"
      | "consumption"
      | "manufacturing"
      | "adjustment"
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
    Enums: {
      app_role: [
        "super_admin",
        "admin",
        "accountant",
        "sales_executive",
        "viewer",
      ],
      invoice_status: ["draft", "sent", "paid", "partial", "cancelled"],
      invoice_type: [
        "tax_invoice",
        "proforma",
        "quotation",
        "purchase_order",
        "delivery_challan",
        "credit_note",
        "debit_note",
      ],
      stock_movement_type: [
        "stock_in",
        "stock_out",
        "consumption",
        "manufacturing",
        "adjustment",
      ],
    },
  },
} as const
