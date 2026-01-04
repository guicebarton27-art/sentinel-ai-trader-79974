import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple encryption using Web Crypto API
async function encryptSecret(plaintext: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  // Combine IV and ciphertext
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

async function decryptSecret(ciphertext: string, key: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

async function getEncryptionKey(): Promise<CryptoKey> {
  // Use a secret from environment for key derivation
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret.slice(0, 32).padEnd(32, '0')),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
  return keyMaterial;
}

// Authenticate user
async function authenticateUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing authorization header');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Invalid or expired token');
  }

  return { user, supabase };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user } = await authenticateUser(req);
    const { action, ...params } = await req.json();
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const encryptionKey = await getEncryptionKey();

    console.log(`User ${user.id} performing ${action} on API keys`);

    switch (action) {
      case 'list': {
        const { data: keys, error } = await supabaseAdmin
          .from('api_keys')
          .select('id, exchange, key_name, is_active, created_at, updated_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, keys }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'add': {
        const { exchange, key_name, api_key, api_secret } = params;

        if (!exchange || !key_name || !api_key || !api_secret) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate input lengths
        if (key_name.length > 100 || exchange.length > 50) {
          return new Response(
            JSON.stringify({ error: 'Field length exceeds maximum' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Encrypt the sensitive data
        const encryptedKey = await encryptSecret(api_key, encryptionKey);
        const encryptedSecret = await encryptSecret(api_secret, encryptionKey);

        const { data: newKey, error } = await supabaseAdmin
          .from('api_keys')
          .insert({
            user_id: user.id,
            exchange,
            key_name,
            encrypted_key: encryptedKey,
            encrypted_secret: encryptedSecret,
            is_active: true,
          })
          .select('id, exchange, key_name, is_active, created_at')
          .single();

        if (error) {
          console.error('Error inserting API key:', error);
          throw error;
        }

        console.log(`API key ${newKey.id} added for user ${user.id}`);

        return new Response(
          JSON.stringify({ success: true, key: newKey }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        const { key_id } = params;

        if (!key_id) {
          return new Response(
            JSON.stringify({ error: 'Missing key_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify ownership before deletion
        const { data: existingKey } = await supabaseAdmin
          .from('api_keys')
          .select('id')
          .eq('id', key_id)
          .eq('user_id', user.id)
          .single();

        if (!existingKey) {
          return new Response(
            JSON.stringify({ error: 'API key not found or access denied' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabaseAdmin
          .from('api_keys')
          .delete()
          .eq('id', key_id)
          .eq('user_id', user.id);

        if (error) throw error;

        console.log(`API key ${key_id} deleted for user ${user.id}`);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'toggle': {
        const { key_id, is_active } = params;

        if (!key_id || typeof is_active !== 'boolean') {
          return new Response(
            JSON.stringify({ error: 'Missing key_id or is_active' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: updatedKey, error } = await supabaseAdmin
          .from('api_keys')
          .update({ is_active })
          .eq('id', key_id)
          .eq('user_id', user.id)
          .select('id, is_active')
          .single();

        if (error) throw error;

        console.log(`API key ${key_id} toggled to ${is_active} for user ${user.id}`);

        return new Response(
          JSON.stringify({ success: true, key: updatedKey }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_decrypted': {
        // This action should only be used internally by the trading bot
        const { key_id } = params;

        if (!key_id) {
          return new Response(
            JSON.stringify({ error: 'Missing key_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: keyData, error } = await supabaseAdmin
          .from('api_keys')
          .select('*')
          .eq('id', key_id)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (error || !keyData) {
          return new Response(
            JSON.stringify({ error: 'API key not found or inactive' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Decrypt the keys
        const decryptedKey = await decryptSecret(keyData.encrypted_key, encryptionKey);
        const decryptedSecret = await decryptSecret(keyData.encrypted_secret, encryptionKey);

        // Log access for audit trail
        console.log(`API key ${key_id} decrypted for user ${user.id} at ${new Date().toISOString()}`);

        return new Response(
          JSON.stringify({
            success: true,
            exchange: keyData.exchange,
            api_key: decryptedKey,
            api_secret: decryptedSecret,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('Error in manage-api-keys:', error);
    
    const isAuthError = error.message?.includes('authorization') || 
                        error.message?.includes('token');
    
    return new Response(
      JSON.stringify({ error: isAuthError ? error.message : 'Failed to process request' }),
      { status: isAuthError ? 401 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
