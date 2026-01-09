# Strava Sync Error Fix

## Problem
Getting `FunctionsHttpError: Edge Function returned a non-2xx status code` when trying to sync Strava activities.

## Changes Made

### 1. Enhanced Error Logging
- Added comprehensive logging throughout the Strava sync flow
- Console logs with emoji indicators (🔄 ✅ ❌ ⏰ 📊) for easy tracking
- Detailed diagnostics for token expiry and refresh process

### 2. Improved Edge Function Error Handling
Updated `supabase/functions/strava-refresh/index.ts`:
- Now checks if environment variables are set
- Returns detailed error messages
- Better Strava API error parsing

### 3. User-Friendly Error Messages
- Alert dialogs guide users to reconnect Strava when needed
- Specific error messages for different failure scenarios

## Required: Deploy Edge Function

**IMPORTANT:** You must redeploy the updated Edge Function for the fixes to take effect:

```bash
# From project root
supabase functions deploy strava-refresh
```

## Required: Check Environment Variables

The Edge Function needs these secrets configured in Supabase:

1. Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Verify these are set:
   - `STRAVA_CLIENT_ID` - Your Strava app client ID
   - `STRAVA_CLIENT_SECRET` - Your Strava app client secret

If these are missing, the Edge Function will now return a clear error message.

## Testing the Fix

After deploying:

1. Open the app and go to History tab
2. Pull down to refresh/sync Strava activities
3. Check Metro console for detailed logs:
   - Look for 🔑 [Strava] messages showing token status
   - Look for 🔄 [Strava] messages showing sync progress
   - Any ❌ errors will show exactly what failed

### Common Error Scenarios

**"Token refresh failed"**
- Your Strava token has expired
- Solution: Go to Settings → Disconnect Strava → Reconnect Strava

**"Server configuration error: Missing Strava credentials"**
- Environment variables not set in Supabase
- Solution: Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in Supabase Dashboard

**"Failed to fetch activities from Strava: 401"**
- Token is invalid or revoked in Strava
- Solution: Reconnect your Strava account

## Monitoring

With the new logging, you'll see detailed console output like:

```
🔑 [Strava] Getting valid token for user: abc-123
⏰ [Strava] Token expires at: 2026-01-10T12:00:00.000Z
⏰ [Strava] Current time: 2026-01-09T10:00:00.000Z
⏰ [Strava] Time until expiry (minutes): 1560
✅ [Strava] Using existing token
🔄 [Strava] Starting activity sync for user: abc-123
📥 [Strava] Fetching page 1...
📥 [Strava] Retrieved 30 activities from page 1
🏃 [Strava] Found 25 running activities in page 1
✅ [Strava] Synced activity: Morning Run
✅ [Strava] Sync complete! Synced 25 new activities
```

This makes it much easier to diagnose any issues.
