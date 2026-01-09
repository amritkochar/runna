// Supabase Edge Function: Refresh Spotify access token
// Deploy with: supabase functions deploy spotify-refresh
// Handles both form-encoded (from Spotify SDK) and JSON (from app) requests

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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
    // Get credentials from environment
    const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID') || Deno.env.get('EXPO_PUBLIC_SPOTIFY_CLIENT_ID');
    const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET');

    // Validate environment variables
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      console.error('Missing Spotify credentials:', {
        hasClientId: !!SPOTIFY_CLIENT_ID,
        hasClientSecret: !!SPOTIFY_CLIENT_SECRET,
      });
      return new Response(
        JSON.stringify({
          error: 'Server configuration error',
          details: 'Missing Spotify API credentials'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle both form-encoded (from SDK) and JSON (from app) requests
    const contentType = req.headers.get('content-type') || '';
    let refresh_token: string | null = null;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.text();
      const params = new URLSearchParams(formData);
      refresh_token = params.get('refresh_token');
    } else if (contentType.includes('application/json')) {
      const json = await req.json();
      refresh_token = json.refresh_token;
    }

    if (!refresh_token) {
      console.error('Missing refresh token in request');
      return new Response(
        JSON.stringify({
          error: 'Missing refresh token',
          details: 'No refresh_token provided in request body'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Attempting to refresh Spotify token...');

    // Prepare credentials
    const credentials = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);

    // Refresh the token
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token,
      }).toString(),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('Spotify API error response:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText,
      });

      // Try to parse error details
      let errorDetails = 'Failed to refresh token';
      try {
        const errorJson = JSON.parse(responseText);
        errorDetails = errorJson.error_description || errorJson.error || errorDetails;
      } catch {
        // Response wasn't JSON, use raw text
        errorDetails = responseText || errorDetails;
      }

      return new Response(
        JSON.stringify({
          error: 'Spotify token refresh failed',
          details: errorDetails,
          status: response.status
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse successful response
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse Spotify response:', responseText);
      return new Response(
        JSON.stringify({
          error: 'Invalid response from Spotify',
          details: 'Could not parse token response'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Token refresh successful');

    // Return tokens in the format expected by Spotify SDK and app
    return new Response(
      JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token || null, // May be null if Spotify doesn't return a new one
        expires_in: data.expires_in || 3600,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Token refresh error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
