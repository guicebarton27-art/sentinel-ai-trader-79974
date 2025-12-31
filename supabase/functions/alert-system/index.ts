import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';

interface AlertRequest {
  alert_type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  channels?: ('database' | 'webhook' | 'email')[];
}

// Authenticate user and check role - Trader/Admin for alert system
async function authenticateUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw { status: 401, message: 'Missing authorization header' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw { status: 401, message: 'Invalid or expired token' };
  }

  // Check user role - traders and admins can use alert system
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  const role = roleData?.role || 'viewer';
  if (!['admin', 'trader'].includes(role)) {
    throw { status: 403, message: 'Trader or admin role required for alert system access' };
  }

  return { user, role };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user and verify role
    const { user, role } = await authenticateUser(req);
    console.log(`User ${user.id} (${role}) accessing alert system`);

    const { action, ...params } = await req.json();
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log('Alert System:', action, params);

    // Handle different actions
    switch (action) {
      case 'create': {
        const alert: AlertRequest = params.alert;
        const channels = alert.channels || ['database'];

        // Store in database
        if (channels.includes('database')) {
          const { data, error } = await supabase
            .from('alerts')
            .insert({
              alert_type: alert.alert_type,
              severity: alert.severity,
              title: alert.title,
              message: alert.message,
              metadata: alert.metadata,
            })
            .select()
            .single();

          if (error) throw error;

          console.log('Alert created:', data.id);

          // For critical/emergency alerts, we could send webhooks
          if (channels.includes('webhook') && (alert.severity === 'critical' || alert.severity === 'emergency')) {
            // Webhook integration would go here
            console.log('Would send webhook for critical alert:', alert.title);
          }

          return new Response(
            JSON.stringify({ success: true, alert: data }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        break;
      }

      case 'acknowledge': {
        const { alert_id } = params;
        
        const { data, error } = await supabase
          .from('alerts')
          .update({ 
            acknowledged: true, 
            acknowledged_at: new Date().toISOString() 
          })
          .eq('id', alert_id)
          .select()
          .single();

        if (error) throw error;

        console.log('Alert acknowledged:', alert_id);

        return new Response(
          JSON.stringify({ success: true, alert: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list': {
        const { severity, acknowledged, limit = 50 } = params;
        
        let query = supabase
          .from('alerts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (severity) {
          query = query.eq('severity', severity);
        }

        if (acknowledged !== undefined) {
          query = query.eq('acknowledged', acknowledged);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Group by severity for dashboard
        const grouped = {
          emergency: data?.filter(a => a.severity === 'emergency') || [],
          critical: data?.filter(a => a.severity === 'critical') || [],
          warning: data?.filter(a => a.severity === 'warning') || [],
          info: data?.filter(a => a.severity === 'info') || [],
        };

        const unacknowledgedCount = data?.filter(a => !a.acknowledged).length || 0;

        return new Response(
          JSON.stringify({ 
            success: true, 
            alerts: data, 
            grouped,
            total: data?.length || 0,
            unacknowledged: unacknowledgedCount,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'stats': {
        const { data: alerts } = await supabase
          .from('alerts')
          .select('severity, acknowledged, created_at')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        const stats = {
          total_24h: alerts?.length || 0,
          by_severity: {
            emergency: alerts?.filter(a => a.severity === 'emergency').length || 0,
            critical: alerts?.filter(a => a.severity === 'critical').length || 0,
            warning: alerts?.filter(a => a.severity === 'warning').length || 0,
            info: alerts?.filter(a => a.severity === 'info').length || 0,
          },
          unacknowledged: alerts?.filter(a => !a.acknowledged).length || 0,
          acknowledged: alerts?.filter(a => a.acknowledged).length || 0,
        };

        return new Response(
          JSON.stringify({ success: true, stats }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'clear': {
        const { before_date, severity } = params;
        
        let query = supabase
          .from('alerts')
          .delete()
          .eq('acknowledged', true);

        if (before_date) {
          query = query.lt('created_at', before_date);
        }

        if (severity) {
          query = query.eq('severity', severity);
        }

        const { error, count } = await query;

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, deleted: count }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Error in alert system:', error);
    
    const isAuthError = error.status === 401 || error.status === 403;
    
    return new Response(
      JSON.stringify({ error: isAuthError ? error.message : 'Internal server error' }),
      { status: error.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
