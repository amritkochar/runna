import { useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
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

  // Load activities from database on mount
  useEffect(() => {
    if (user && stravaConnected) {
      console.log('📊 [Strava] Loading existing activities from database...');
      loadActivitiesFromDatabase();
    }
  }, [user, stravaConnected]);

  // Load activities from database
  const loadActivitiesFromDatabase = async () => {
    if (!user) return;

    try {
      const { supabase } = await import('../lib/supabase');

      // Load activities
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false })
        .limit(100);

      if (error) {
        console.error('❌ [Strava] Error loading activities:', error);
        return;
      }

      if (data && data.length > 0) {
        console.log(`✅ [Strava] Loaded ${data.length} activities from database`);
        setActivities(data);

        // Load runner persona from profile first (it's already in the profile)
        // If it doesn't exist, calculate it
        const { data: profile } = await supabase
          .from('profiles')
          .select('runner_persona')
          .eq('id', user.id)
          .single();

        if (profile?.runner_persona) {
          console.log('✅ [Strava] Loaded runner persona from profile');
          setRunnerPersona(profile.runner_persona);
        } else {
          console.log('🔄 [Strava] No runner persona found, calculating...');
          const { calculateRunnerPersona } = await import('../lib/strava');
          const persona = await calculateRunnerPersona(user.id);
          if (persona) {
            console.log('✅ [Strava] Calculated and saved runner persona');
            setRunnerPersona(persona);
          }
        }
      } else {
        console.log('ℹ️ [Strava] No activities found in database');
        setActivities([]);
      }
    } catch (error) {
      console.error('❌ [Strava] Error loading activities:', error);
    }
  };

  // Handle OAuth response
  useEffect(() => {
    if (response?.type === 'error') {
      Alert.alert(
        'Strava Connection Failed',
        response.error?.message || 'Could not connect to Strava. Please try again.',
        [{ text: 'OK' }]
      );
      return;
    }

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

          // Show success message
          Alert.alert(
            'Connected!',
            `Connected to Strava as ${tokens.athlete.firstname} ${tokens.athlete.lastname}`,
            [{ text: 'OK' }]
          );

          // Sync activities after connecting
          await syncActivities();
        } catch (error: any) {
          console.error('Error connecting Strava:', error);
          Alert.alert(
            'Connection Failed',
            error.message || 'Could not complete Strava connection. Please try again.',
            [{ text: 'OK' }]
          );
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
    if (!user || !stravaConnected) return 0;

    try {
      console.log('🔄 [Strava] Starting sync...');
      const newCount = await syncStravaActivities(user.id);
      console.log(`✅ [Strava] Synced ${newCount} new activities`);

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
        console.log(`📊 [Strava] Loaded ${data.length} total activities after sync`);
        setActivities(data);
      }

      // Update runner persona after syncing new activities
      console.log('🔄 [Strava] Updating runner persona...');
      const persona = await calculateRunnerPersona(user.id);
      if (persona) {
        console.log('✅ [Strava] Runner persona updated');
        setRunnerPersona(persona);

        // Also refresh the profile to keep it in sync
        await refreshProfile();
        console.log('✅ [Strava] Profile refreshed with updated runner persona');
      }

      return newCount;
    } catch (error: any) {
      console.error('Error syncing activities:', error);

      // Show user-friendly error message
      let errorMessage = 'Failed to sync activities. ';

      if (error.message?.includes('Token refresh failed')) {
        errorMessage += 'Your Strava connection has expired. Please reconnect your Strava account in Settings.';
      } else if (error.message?.includes('Server configuration error')) {
        errorMessage += 'Server configuration issue. Please contact support.';
      } else if (error.message?.includes('No valid Strava token')) {
        errorMessage += 'Please reconnect your Strava account in Settings.';
      } else {
        errorMessage += error.message || 'Please try again later.';
      }

      Alert.alert(
        'Sync Failed',
        errorMessage,
        [{ text: 'OK' }]
      );

      throw error;
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
