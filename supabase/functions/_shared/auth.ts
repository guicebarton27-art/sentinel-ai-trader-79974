import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireEnv } from "./env.ts";

// Standard CORS headers for all edge functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// User type with guaranteed email string
export interface AuthUser {
  id: string;
  email: string;
}

// Role types
export type AppRole = 'admin' | 'trader' | 'viewer';

// Authentication result
export interface AuthResult {
  user: AuthUser;
  role: AppRole;
  supabaseClient: SupabaseClient;
}

// Simple auth result without role check
export interface SimpleAuthResult {
  user: AuthUser;
  supabaseClient: SupabaseClient;
}

/**
 * Authenticate user from request and get their role.
 * Throws if authentication fails or user doesn't have required role.
 * 
 * @param req - The incoming request
 * @param requiredRoles - Optional array of roles that are allowed (defaults to all authenticated users)
 * @returns AuthResult with user info, role, and supabase client
 */
export async function authenticateUser(
  req: Request,
  requiredRoles?: AppRole[]
): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing authorization header');
  }

  const supabaseClient = createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_ANON_KEY'),
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) {
    throw new Error('Invalid or expired token');
  }

  // Get user role
  const { data: roleData } = await supabaseClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  const role = (roleData?.role as AppRole) || 'viewer';

  // Check if user has required role
  if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(role)) {
    throw new Error(`Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`);
  }

  return {
    user: {
      id: user.id,
      email: user.email ?? 'unknown',
    },
    role,
    supabaseClient,
  };
}

/**
 * Simple authentication without role checking.
 * Use this for endpoints that any authenticated user can access.
 * 
 * @param req - The incoming request
 * @returns SimpleAuthResult with user info and supabase client
 */
export async function authenticateUserSimple(req: Request): Promise<SimpleAuthResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing authorization header');
  }

  const supabaseClient = createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_ANON_KEY'),
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) {
    throw new Error('Invalid or expired token');
  }

  return {
    user: {
      id: user.id,
      email: user.email ?? 'unknown',
    },
    supabaseClient,
  };
}

/**
 * Get a service client for admin operations that bypass RLS.
 * Use with caution - only for operations that need elevated privileges.
 * 
 * @returns SupabaseClient with service role key
 */
export function getServiceClient(): SupabaseClient {
  return createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  );
}

/**
 * Helper to create an error response with CORS headers.
 * 
 * @param message - Error message
 * @param status - HTTP status code (default 500)
 * @returns Response object with error JSON
 */
export function errorResponse(message: string, status: number = 500): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Helper to create a success response with CORS headers.
 * 
 * @param data - Data to return
 * @param status - HTTP status code (default 200)
 * @returns Response object with success JSON
 */
export function successResponse(data: unknown, status: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Handle CORS preflight request.
 * 
 * @returns Response with CORS headers for OPTIONS request
 */
export function handleCors(): Response {
  return new Response(null, { headers: corsHeaders });
}

/**
 * Check if request is a CORS preflight request.
 * 
 * @param req - The incoming request
 * @returns boolean
 */
export function isCorsRequest(req: Request): boolean {
  return req.method === 'OPTIONS';
}
