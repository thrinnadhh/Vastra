declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_API_BASE_URL: string | undefined;
    readonly EXPO_PUBLIC_SUPABASE_URL: string | undefined;
    readonly EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string | undefined;
  }
}
