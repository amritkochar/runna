// Supabase Edge Function: Refresh Strava access token
// Deploy with: supabase functions deploy strava-refresh

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID');
const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check if environment variables are set
    if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
      console.error('❌ Missing Strava credentials in environment variables');
      console.error('STRAVA_CLIENT_ID:', STRAVA_CLIENT_ID ? 'Set' : 'Not set');
      console.error('STRAVA_CLIENT_SECRET:', STRAVA_CLIENT_SECRET ? 'Set' : 'Not set');
      return new Response(
        JSON.stringify({
          error: 'Server configuration error: Missing Strava credentials',
          details: 'STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET not configured'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { refresh_token } = await req.json();

    if (!refresh_token) {
      console.error('❌ Missing refresh token in request');
      return new Response(
        JSON.stringify({ error: 'Missing refresh token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔄 Attempting to refresh Strava token...');

    // Refresh the token
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Strava token refresh error:', errorText);
      console.error('❌ Status:', response.status);

      let errorMessage = 'Failed to refresh token';
      let errorDetails = errorText;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          errorMessage = errorJson.message;
        }
        errorDetails = JSON.stringify(errorJson);
      } catch {
        // Error text is not JSON, use as-is
      }

      return new Response(
        JSON.stringify({
          error: errorMessage,
          details: errorDetails,
          status: response.status
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('✅ Token refreshed successfully');

    return new Response(
      JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
