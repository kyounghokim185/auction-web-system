export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      properties: {
        Row: {
          id: string
          case_number: string
          address: string
          area: number | null
          min_bid_price: number | null
          market_value: number | null
          created_at: string
        }
        Insert: {
          id?: string
          case_number: string
          address: string
          area?: number | null
          min_bid_price?: number | null
          market_value?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          case_number?: string
          address?: string
          area?: number | null
          min_bid_price?: number | null
          market_value?: number | null
          created_at?: string
        }
      }
      remodeling_tasks: {
        Row: {
          id: string
          category: string
          item_name: string
          unit: string
          unit_price: number
          created_at: string
        }
        Insert: {
          id?: string
          category: string
          item_name: string
          unit: string
          unit_price: number
          created_at?: string
        }
        Update: {
          id?: string
          category?: string
          item_name?: string
          unit?: string
          unit_price?: number
          created_at?: string
        }
      }
      simulations: {
        Row: {
          id: string
          property_id: string
          total_remodeling_cost: number
          expected_sell_price: number
          auction_bid_price: number
          acquisition_tax: number
          expected_roi: number | null
          created_at: string
        }
        Insert: {
          id?: string
          property_id: string
          total_remodeling_cost: number
          expected_sell_price: number
          auction_bid_price: number
          acquisition_tax: number
          // expected_roi is generated/stored, usually not inserted directly if using 'generated always' 
          // but Supabase types might imply read-only. We'll leave it optional/omitted in insert.
          created_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          total_remodeling_cost?: number
          expected_sell_price?: number
          auction_bid_price?: number
          acquisition_tax?: number
          created_at?: string
        }
      }
    }
  }
}
