import type { SupabaseClient as SupabaseJsClient } from '@supabase/supabase-js';

interface GenericTable {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
}

interface GenericView {
  Row: Record<string, unknown>;
  Relationships: [];
}

/**
 * Transitional schema shape used until generated Supabase database types are
 * introduced. It keeps all table names available while preserving safe,
 * non-any read and write payloads.
 */
export interface VastraDatabase {
  public: {
    Tables: Record<string, GenericTable>;
    Views: Record<string, GenericView>;
    Functions: Record<
      string,
      {
        Args: Record<string, unknown>;
        Returns: unknown;
      }
    >;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, Record<string, unknown>>;
  };
}

export type SupabaseClient = SupabaseJsClient<VastraDatabase>;
