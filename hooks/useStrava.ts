import { useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useRunStore } from '../stores/runStore';
import {
  useStravaAuth,
  exchangeStravaCode,
  syncStravaActivities,
  calculateRunnerPersona,
  getValidStravaToken,
} from '../lib/strava';
import { updateProfile } from '../lib/supabase';

export function useStrava() {
  const { user, refreshProfile } = useAuth();
  const {
    stravaConnected,
    activities,
    runnerPersona,
    setActivities,
    setRunnerPersona,
    setStravaConnected,
  } = useRunStore();

  const { request, response, promptAsync } = useStravaAuth();

  // Handle OAuth response
  useEffect(() => {
    if (response?.type === 'success' && user) {
      const { code } = response.params;

      (async () => {
        try {
          const tokens = await exchangeStravaCode(code);

          // Update profile with Strava credentials
          await updateProfile(user.id, {
            strava_athlete_id: tokens.athlete.id.toString(),
            strava_access_token: tokens.access_token,
            strava_refresh_token: tokens.refresh_token,
            strava_token_expires_at: new Date(tokens.expires_at * 1000).toISOString(),
          });

          setStravaConnected(true);
          await refreshProfile();

          // Sync activities after connecting
          await syncActivities();
        } catch (error) {
          console.error('Error connecting Strava:', error);
        }
      })();
    }
  }, [response, user]);

  // Connect Strava account
  const connectStrava = async () => {
    if (!request) {
      console.error('Auth request not ready');
      return;
    }
    await promptAsync();
  };

  // Disconnect Strava
  const disconnectStrava = async () => {
    if (!user) return;

    await updateProfile(user.id, {
      strava_athlete_id: null,
      strava_access_token: null,
      strava_refresh_token: null,
      strava_token_expires_at: null,
    });

    setStravaConnected(false);
    setActivities([]);
    setRunnerPersona(null);
    await refreshProfile();
  };

  // Sync activities from Strava
  const syncActivities = useCallback(async () => {
    if (!user || !stravaConnected) return;

    try {
      const newCount = await syncStravaActivities(user.id);
      console.log(`Synced ${newCount} new activities`);

      // Refresh activities from database
      const { data } = await import('../lib/supabase').then(({ supabase }) =>
        supabase
          .from('activities')
          .select('*')
          .eq('user_id', user.id)
          .order('start_date', { ascending: false })
          .limit(100)
      );

      if (data) {
        setActivities(data);
      }

      // Update runner persona
      const persona = await calculateRunnerPersona(user.id);
      if (persona) {
        setRunnerPersona(persona);
      }
    } catch (error) {
      console.error('Error syncing activities:', error);
    }
  }, [user, stravaConnected, setActivities, setRunnerPersona]);

  // Check if token is valid
  const checkConnection = useCallback(async () => {
    if (!user) return false;

    try {
      const token = await getValidStravaToken(user.id);
      return !!token;
    } catch {
      return false;
    }
  }, [user]);

  return {
    stravaConnected,
    activities,
    runnerPersona,
    connectStrava,
    disconnectStrava,
    syncActivities,
    checkConnection,
    isAuthReady: !!request,
  };
}
