export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Project {
  id: string
  name: string
  author: string
  start_date: string | null
  duration: string
  notes: string
  base_area: number
  tasks: RemodelingTask[]
  images: UploadedImage[]
  created_at: string
}

export type RemodelingTask = {
  id: string
  isChecked: boolean
  category: TaskCategory
  item_name: string
  description: string
  unit_price: number
  area: number
}

export type UploadedImage = {
  url: string
  path: string
  category: ImageCategory
}

// Fixed Categories
export const TASK_CATEGORIES = [
  "설계",
  "가설 및 철거",
  "파사드",
  "바닥",
  "벽",
  "천장",
  "전기/통신",
  "설비",
  "소방",
  "사인/가구/주방/위생",
  "기타"
] as const;

export type TaskCategory = typeof TASK_CATEGORIES[number];

export const IMAGE_CATEGORIES = [
  "설계",
  "가설 및 철거",
  "파사드",
  "바닥",
  "벽",
  "천장",
  "전기/통신",
  "설비",
  "소방",
  "사인/가구/주방/위생",
  "기타"
] as const;
export type ImageCategory = typeof IMAGE_CATEGORIES[number];

export interface Database {
  public: {
    // ... existing database types ...
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
