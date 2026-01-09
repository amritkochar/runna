import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import type { Activity, StravaActivity, StravaAthlete } from '../types';
import { supabase, updateProfile } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const STRAVA_CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID!;
const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

// OAuth scopes we need
const STRAVA_SCOPES = ['activity:read_all,read'];

// Discovery document for Strava OAuth
const discovery = {
  authorizationEndpoint: STRAVA_AUTH_URL,
  tokenEndpoint: STRAVA_TOKEN_URL,
};

// Get redirect URI for OAuth
export function getStravaRedirectUri() {
  return AuthSession.makeRedirectUri({
    scheme: 'runna',
    path: 'strava-callback',
  });
}

// Create auth request
export function useStravaAuth() {
  const redirectUri = getStravaRedirectUri();

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: STRAVA_CLIENT_ID,
      scopes: STRAVA_SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
    },
    discovery
  );

  return { request, response, promptAsync };
}

// Exchange code for tokens (call from your backend/edge function for security)
export async function exchangeStravaCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: StravaAthlete;
}> {
  // In production, this should go through your backend to protect client_secret
  // For now, we'll call the Supabase Edge Function
  const redirectUri = getStravaRedirectUri();

  const { data, error } = await supabase.functions.invoke('strava-exchange', {
    body: {
      code,
      redirect_uri: redirectUri,
    },
  });

  if (error) throw error;
  return data;
}

// Refresh Strava token
export async function refreshStravaToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: number;
}> {
  console.log('🔄 [Strava] Refreshing token...');

  const { data, error } = await supabase.functions.invoke('strava-refresh', {
    body: { refresh_token: refreshToken },
  });

  if (error) {
    console.error('❌ [Strava] Token refresh error:', error);
    throw new Error(`Failed to refresh Strava token: ${error.message}`);
  }

  if (!data) {
    console.error('❌ [Strava] No data returned from token refresh');
    throw new Error('No data returned from token refresh');
  }

  console.log('✅ [Strava] Token refreshed successfully');
  return data;
}

// Get valid access token (refresh if needed)
export async function getValidStravaToken(userId: string): Promise<string | null> {
  console.log('🔑 [Strava] Getting valid token for user:', userId);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('strava_access_token, strava_refresh_token, strava_token_expires_at')
    .eq('id', userId)
    .single();

  if (profileError) {
    console.error('❌ [Strava] Error fetching profile:', profileError);
    throw new Error(`Failed to fetch profile: ${profileError.message}`);
  }

  if (!profile?.strava_access_token || !profile?.strava_refresh_token) {
    console.warn('⚠️ [Strava] No Strava credentials found');
    return null;
  }

  const expiresAt = new Date(profile.strava_token_expires_at).getTime();
  const now = Date.now();

  console.log('⏰ [Strava] Token expires at:', new Date(expiresAt).toISOString());
  console.log('⏰ [Strava] Current time:', new Date(now).toISOString());
  console.log('⏰ [Strava] Time until expiry (minutes):', Math.round((expiresAt - now) / 60000));

  // Refresh if token expires in less than 5 minutes
  if (expiresAt - now < 5 * 60 * 1000) {
    console.log('🔄 [Strava] Token expired or expiring soon, refreshing...');

    try {
      const tokens = await refreshStravaToken(profile.strava_refresh_token);

      await updateProfile(userId, {
        strava_access_token: tokens.access_token,
        strava_refresh_token: tokens.refresh_token,
        strava_token_expires_at: new Date(tokens.expires_at * 1000).toISOString(),
      });

      console.log('✅ [Strava] Token refreshed and profile updated');
      return tokens.access_token;
    } catch (error: any) {
      console.error('❌ [Strava] Failed to refresh token:', error);
      throw new Error(`Token refresh failed: ${error.message}. You may need to reconnect your Strava account.`);
    }
  }

  console.log('✅ [Strava] Using existing token');
  return profile.strava_access_token;
}

// Fetch athlete profile
export async function getStravaAthlete(accessToken: string): Promise<StravaAthlete> {
  const response = await fetch(`${STRAVA_API_BASE}/athlete`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Strava API error: ${response.status}`);
  }

  return response.json();
}

// Fetch activities with pagination
export async function getStravaActivities(
  accessToken: string,
  page: number = 1,
  perPage: number = 50
): Promise<StravaActivity[]> {
  const response = await fetch(
    `${STRAVA_API_BASE}/athlete/activities?page=${page}&per_page=${perPage}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Strava API error: ${response.status}`);
  }

  return response.json();
}

// Fetch single activity with more details
export async function getStravaActivity(
  accessToken: string,
  activityId: number
): Promise<StravaActivity> {
  const response = await fetch(`${STRAVA_API_BASE}/activities/${activityId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Strava API error: ${response.status}`);
  }

  return response.json();
}

// Sync activities to Supabase
export async function syncStravaActivities(userId: string): Promise<number> {
  console.log('🔄 [Strava] Starting activity sync for user:', userId);

  let accessToken: string | null;
  try {
    accessToken = await getValidStravaToken(userId);
  } catch (error: any) {
    console.error('❌ [Strava] Failed to get valid token:', error);
    throw error;
  }

  if (!accessToken) {
    const error = new Error('No valid Strava token. Please reconnect your Strava account.');
    console.error('❌ [Strava]', error.message);
    throw error;
  }

  console.log('✅ [Strava] Got valid access token');

  // Get the most recent activity we have
  const { data: latestActivity } = await supabase
    .from('activities')
    .select('start_date')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })
    .limit(1)
    .single();

  console.log('📊 [Strava] Latest activity date:', latestActivity?.start_date || 'None');

  let page = 1;
  let newActivitiesCount = 0;
  let hasMore = true;

  while (hasMore) {
    console.log(`📥 [Strava] Fetching page ${page}...`);

    let activities;
    try {
      activities = await getStravaActivities(accessToken, page);
    } catch (error: any) {
      console.error(`❌ [Strava] Error fetching activities (page ${page}):`, error);
      throw new Error(`Failed to fetch activities from Strava: ${error.message}`);
    }

    console.log(`📥 [Strava] Retrieved ${activities.length} activities from page ${page}`);

    if (activities.length === 0) {
      hasMore = false;
      break;
    }

    // Filter to only running activities
    const runActivities = activities.filter(
      (a) => a.type === 'Run' || a.sport_type === 'Run'
    );

    console.log(`🏃 [Strava] Found ${runActivities.length} running activities in page ${page}`);

    for (const activity of runActivities) {
      // Skip if we've already synced this activity
      if (
        latestActivity &&
        new Date(activity.start_date) <= new Date(latestActivity.start_date)
      ) {
        console.log('✋ [Strava] Reached already-synced activities, stopping');
        hasMore = false;
        break;
      }

      // Insert into database
      const activityRecord: Omit<Activity, 'id' | 'created_at'> = {
        user_id: userId,
        strava_activity_id: activity.id,
        name: activity.name,
        type: activity.type,
        distance_meters: activity.distance,
        moving_time_seconds: activity.moving_time,
        elapsed_time_seconds: activity.elapsed_time,
        start_date: activity.start_date,
        average_speed: activity.average_speed,
        max_speed: activity.max_speed,
        average_heartrate: activity.average_heartrate || null,
        max_heartrate: activity.max_heartrate || null,
        calories: activity.calories || null,
        elevation_gain: activity.total_elevation_gain,
        raw_data: activity as unknown as Record<string, unknown>,
      };

      const { error } = await supabase
        .from('activities')
        .upsert(activityRecord, { onConflict: 'strava_activity_id' });

      if (error) {
        console.error(`❌ [Strava] Error inserting activity ${activity.id}:`, error);
      } else {
        newActivitiesCount++;
        console.log(`✅ [Strava] Synced activity: ${activity.name}`);
      }
    }

    page++;

    // Rate limit: Strava allows 200 requests per 15 minutes
    // Add a small delay between pages
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`✅ [Strava] Sync complete! Synced ${newActivitiesCount} new activities`);
  return newActivitiesCount;
}

// Calculate running stats for AI persona
export async function calculateRunnerPersona(userId: string) {
  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'Run')
    .order('start_date', { ascending: false });

  if (!activities || activities.length === 0) {
    return null;
  }

  // Calculate averages
  const totalDistance = activities.reduce((sum, a) => sum + a.distance_meters, 0);
  const totalTime = activities.reduce((sum, a) => sum + a.moving_time_seconds, 0);
  const avgDistanceKm = totalDistance / activities.length / 1000;
  const avgPaceMinPerKm = totalTime / totalDistance * 1000 / 60;

  // Determine preferred run time
  const hourCounts: Record<number, number> = {};
  activities.forEach((a) => {
    const hour = new Date(a.start_date).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const preferredTime =
    parseInt(peakHour) < 12 ? 'morning' : parseInt(peakHour) < 17 ? 'afternoon' : 'evening';

  // Calculate heart rate zones (if available)
  const activitiesWithHR = activities.filter((a) => a.average_heartrate);
  const avgHR =
    activitiesWithHR.length > 0
      ? activitiesWithHR.reduce((sum, a) => sum + a.average_heartrate!, 0) / activitiesWithHR.length
      : null;

  // Recent accomplishments (PRs, milestones)
  const recentAccomplishments: string[] = [];
  const recentActivities = activities.slice(0, 10);
  const longestRun = Math.max(...recentActivities.map((a) => a.distance_meters));
  const fastestPace = Math.min(
    ...recentActivities.map((a) => a.moving_time_seconds / a.distance_meters)
  );

  if (longestRun > avgDistanceKm * 1000 * 1.5) {
    recentAccomplishments.push(`Long run of ${(longestRun / 1000).toFixed(1)}km`);
  }

  // Calculate runs per week (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentRuns = activities.filter((a) => new Date(a.start_date) > thirtyDaysAgo);
  const runsPerWeek = (recentRuns.length / 30) * 7;

  const persona = {
    typical_distance_km: Math.round(avgDistanceKm * 10) / 10,
    average_pace_min_per_km: Math.round(avgPaceMinPerKm * 10) / 10,
    preferred_run_time: preferredTime,
    heart_rate_zones: avgHR
      ? {
        easy: [Math.round(avgHR * 0.6), Math.round(avgHR * 0.7)],
        tempo: [Math.round(avgHR * 0.8), Math.round(avgHR * 0.9)],
        threshold: [Math.round(avgHR * 0.9), Math.round(avgHR * 1.0)],
      }
      : null,
    recent_accomplishments: recentAccomplishments,
    running_frequency: Math.round(runsPerWeek * 10) / 10,
    total_runs: activities.length,
  };

  // Update profile with persona
  await updateProfile(userId, { runner_persona: persona });

  return persona;
}
