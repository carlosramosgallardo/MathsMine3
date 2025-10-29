import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:');
  if (!supabaseUrl) console.error('→ NEXT_PUBLIC_SUPABASE_URL is not set.');
  if (!supabaseAnonKey) console.error('→ NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.');
  throw new Error('❌ Supabase environment configuration is incomplete.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
