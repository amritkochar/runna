# Spotify Integration Setup Guide

This guide helps you configure Spotify OAuth integration for Runna.

## Issue Fixed

The Spotify token refresh error has been resolved with improved error handling and logging. If you're still seeing errors, follow the setup steps below.

## Required Supabase Secrets

The `spotify-refresh` Edge Function requires two secrets to be set in your Supabase project:

### 1. Set Secrets via Supabase CLI

```bash
# Set the Spotify Client ID
supabase secrets set SPOTIFY_CLIENT_ID=your_spotify_client_id_here

# Set the Spotify Client Secret
supabase secrets set SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
```

### 2. Verify Secrets

```bash
# List all secrets to verify they're set
supabase secrets list
```

You should see both `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in the output.

## Deploy the Updated Edge Function

After setting the secrets, deploy the updated Edge Function:

```bash
# From project root
supabase functions deploy spotify-refresh
```

## Common Issues & Solutions

### Error: "Server configuration error"

**Cause:** Missing `SPOTIFY_CLIENT_ID` or `SPOTIFY_CLIENT_SECRET` in Supabase secrets.

**Solution:** Run the secret commands above and redeploy the function.

### Error: "Token refresh failed" on app startup

**Cause:** Your refresh token may be invalid or expired.

**Solution:**
1. Go to Settings in the app
2. Disconnect Spotify
3. Reconnect Spotify to get fresh tokens

### No Refresh Token (Android)

**Note:** The Spotify native SDK on Android sometimes doesn't provide refresh tokens. This is expected behavior.

**Solution:** The app will now gracefully handle this by clearing invalid tokens and prompting you to reconnect when needed.

## Testing

After deploying:

1. Start your app
2. Check the console logs for detailed Spotify authentication flow
3. If you see "Token refresh successful", the fix is working
4. If you see errors, check the Edge Function logs:

```bash
supabase functions logs spotify-refresh --tail
```

## Getting Your Spotify Credentials

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Select your app
3. Copy the **Client ID** and **Client Secret**
4. Set them as Supabase secrets using the commands above

## Environment Variables

Make sure your `.env` file has:

```env
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=your_client_id_here
```

This is used for client-side OAuth flow initialization.

## References

- [Spotify OAuth Documentation](https://developer.spotify.com/documentation/web-api/tutorials/code-flow)
- [Refreshing Tokens](https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens)
- [Supabase Edge Functions Secrets](https://supabase.com/docs/guides/functions/secrets)
