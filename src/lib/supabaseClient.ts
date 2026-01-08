import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ycncymbshtnvohgawsdh.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljbmN5bWJzaHRudm9oZ2F3c2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MjI1MzUsImV4cCI6MjA4MzM5ODUzNX0.lx7i1bqm1OuOl1nIVe3HPas0DtBbtMttM_ZwdWNdtvQ";

/* 
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase 환경 변수가 누락되었습니다. .env.local을 확인하세요.');
} 
*/

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
