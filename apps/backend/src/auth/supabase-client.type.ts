import type { createClient } from '@supabase/supabase-js';

export type SupabaseClient = ReturnType<typeof createClient>;
