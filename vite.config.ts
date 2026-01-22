import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Ensure public backend config is injected even if the preview environment
  // fails to expose VITE_* vars at runtime.
  const env = loadEnv(mode, process.cwd(), "");

  // In some preview environments, vars are provided via process.env instead of .env files.
  const FALLBACK_SUPABASE_URL = "https://swpjpzsnqpamdchdlkpf.supabase.co";
  const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3cGpwenNucXBhbWRjaGRsa3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxNDMzOTAsImV4cCI6MjA3NTcxOTM5MH0.dKgKJr6sufBjRLg6PAPENkpOPqd24kEJj6AnVTma92g";

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    env.SUPABASE_URL ||
    FALLBACK_SUPABASE_URL;

  const supabasePublishableKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    FALLBACK_SUPABASE_PUBLISHABLE_KEY;

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
      ...(env.VITE_SUPABASE_PROJECT_ID
        ? {
            "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(env.VITE_SUPABASE_PROJECT_ID),
          }
        : {}),
    },
  };
});
