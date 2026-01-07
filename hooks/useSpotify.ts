import { useCallback, useEffect, useRef } from 'react';
import {
  addToQueue,
  getCurrentlyPlaying,
  getDevices,
  getPlaybackState,
  getSpotifyUser,
  getValidSpotifyToken,
  pause,
  play,
  searchTracks,
  skipToNext,
  skipToPrevious
} from '../lib/spotify';
import { authenticateSpotify } from '../lib/spotify-sdk';
import { updateProfile } from '../lib/supabase';
import { useRunStore } from '../stores/runStore';
import { useAuth } from './useAuth';

export function useSpotify() {
  const { user, refreshProfile } = useAuth();
  const {
    spotifyConnected,
    spotifyIsPremium,
    playbackState,
    setSpotifyConnected,
    setPlaybackState,
  } = useRunStore();

  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const pollErrorCount = useRef(0);

  // Poll for playback state
  const startPolling = useCallback(async () => {
    if (!user || !spotifyConnected) return;

    const poll = async () => {
      try {
        const token = await getValidSpotifyToken(user.id);
        if (token) {
          const state = await getPlaybackState(token);
          setPlaybackState(state);
          pollErrorCount.current = 0; // Reset error count on success
        } else {
          // No valid token, stop polling
          if (pollInterval.current) {
            clearInterval(pollInterval.current);
            pollInterval.current = null;
          }
          setSpotifyConnected(false, false);
        }
      } catch (error) {
        pollErrorCount.current++;

        // Only log every 5th error to avoid spam
        if (pollErrorCount.current % 5 === 1) {
          console.warn('Spotify polling failed, will retry...', error);
        }

        // Stop polling after 10 consecutive failures
        if (pollErrorCount.current >= 10) {
          console.error('Spotify polling failed 10 times, stopping. Please reconnect Spotify.');
          if (pollInterval.current) {
            clearInterval(pollInterval.current);
            pollInterval.current = null;
          }
          setSpotifyConnected(false, false);
        }
      }
    };

    // Reset error count when starting
    pollErrorCount.current = 0;

    // Poll immediately, then every 3 seconds
    await poll();
    pollInterval.current = setInterval(poll, 3000);
  }, [user, spotifyConnected, setPlaybackState]);

  const stopPolling = useCallback(() => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  }, []);

  // Start polling when connected
  useEffect(() => {
    if (spotifyConnected) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [spotifyConnected, startPolling, stopPolling]);

  // Connect to Spotify using native SDK
  const connectSpotify = async () => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      // Authenticate via native SDK
      const session = await authenticateSpotify();

      // Get user info and check premium status
      const spotifyUser = await getSpotifyUser(session.accessToken);
      const isPremium = spotifyUser.product === 'premium';

      // Store in Supabase
      await updateProfile(user.id, {
        spotify_user_id: spotifyUser.id,
        spotify_access_token: session.accessToken,
        spotify_refresh_token: session.refreshToken || null,
        spotify_is_premium: isPremium,
      });

      // Update local state
      setSpotifyConnected(true, isPremium);
      await refreshProfile();

      return { success: true, isPremium };
    } catch (error) {
      console.error('Spotify authentication failed:', error);
      throw error;
    }
  };

  // Handle Spotify SDK authentication callback
  // This is called from the native Spotify SDK
  const handleSpotifyAuth = async (accessToken: string, refreshToken: string) => {
    if (!user) return;

    try {
      // Get user info and check premium status
      const spotifyUser = await getSpotifyUser(accessToken);
      const isPremium = spotifyUser.product === 'premium';

      // Update profile
      await updateProfile(user.id, {
        spotify_user_id: spotifyUser.id,
        spotify_access_token: accessToken,
        spotify_refresh_token: refreshToken,
        spotify_is_premium: isPremium,
      });

      setSpotifyConnected(true, isPremium);
      await refreshProfile();
    } catch (error) {
      console.error('Error handling Spotify auth:', error);
      throw error;
    }
  };

  // Disconnect Spotify
  const disconnectSpotify = async () => {
    if (!user) return;

    await updateProfile(user.id, {
      spotify_user_id: null,
      spotify_access_token: null,
      spotify_refresh_token: null,
      spotify_is_premium: false,
    });

    setSpotifyConnected(false, false);
    setPlaybackState(null);
    stopPolling();
    await refreshProfile();
  };

  /**
   * Helper to perform an action, optionally retrying with device activation
   * if a 404 (No active device) is encountered.
   */
  const performWithRetry = async (
    action: (token: string, deviceId?: string) => Promise<void>
  ) => {
    if (!user || !spotifyIsPremium) return;

    const token = await getValidSpotifyToken(user.id);
    if (!token) return;

    try {
      // First try: simple attempt
      await action(token);
    } catch (error: any) {
      // Check for 404 (No active device)
      if (error.message && error.message.includes('404')) {
        console.log('No active device, attempting to wake up a device...');
        try {
          // Get available devices
          const devicesResponse = await getDevices(token);
          const devices = devicesResponse.devices || [];

          if (devices.length > 0) {
            // Find best device (active > smartphone > computer > first)
            // Ideally we want something that can wake up
            const targetDevice =
              devices.find((d: any) => d.is_active) ||
              devices.find((d: any) => d.type === 'Smartphone') ||
              devices.find((d: any) => d.type === 'Computer') ||
              devices[0];

            if (targetDevice) {
              console.log(`Activating device: ${targetDevice.name} (${targetDevice.id})`);

              // We can pass the device ID to the action directly if supported,
              // but transferPlayback ensures it's active.
              // Ideally, just passing deviceId to play/next is enough.

              // Second try: with deviceId
              await action(token, targetDevice.id);

              // Force refresh state
              setTimeout(async () => {
                const state = await getPlaybackState(token);
                setPlaybackState(state);
              }, 500);
              return;
            }
          }
          throw new Error('No available Spotify devices found. Please open Spotify on a device.');
        } catch (retryError) {
          console.error('Error processing retry with device activation:', retryError);
          // throw original error if we couldn't fix it
          throw error;
        }
      }
      // Re-throw if not 404 or retry failed
      throw error;
    }
  };

  // Playback controls (only work for Premium users)
  const togglePlayback = async () => {
    try {
      await performWithRetry(async (token, deviceId) => {
        if (playbackState?.is_playing) {
          // Pause doesn't strictly need deviceId usually, but we keep signature consistent
          await pause(token);
        } else {
          await play(token, deviceId);
        }
      });

      // Update state optimistic/delayed
      setTimeout(async () => {
        if (!user) return;
        const token = await getValidSpotifyToken(user.id);
        if (token) {
          const state = await getPlaybackState(token);
          setPlaybackState(state);
        }
      }, 300);

    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  };

  const nextTrack = async () => {
    try {
      await performWithRetry(async (token, deviceId) => {
        await skipToNext(token, deviceId);
      });

      // Refresh playback state after a short delay
      setTimeout(async () => {
        if (!user) return;
        const token = await getValidSpotifyToken(user.id);
        if (token) {
          const state = await getPlaybackState(token);
          setPlaybackState(state);
        }
      }, 300);

    } catch (error) {
      console.error('Error skipping track:', error);
    }
  };

  const previousTrack = async () => {
    try {
      await performWithRetry(async (token, deviceId) => {
        await skipToPrevious(token, deviceId);
      });

      // Refresh playback state after a short delay
      setTimeout(async () => {
        if (!user) return;
        const token = await getValidSpotifyToken(user.id);
        if (token) {
          const state = await getPlaybackState(token);
          setPlaybackState(state);
        }
      }, 300);
    } catch (error) {
      console.error('Error going to previous track:', error);
    }
  };

  const queueTrack = async (trackUri: string) => {
    // Queue endpoint doesn't support device_id really, but we can try basic way
    // For now we assume if queue fails with 404 we can't easily fix it without starting playback first
    // So we leave this as is or implement similar logic if needed.
    // Usually queueing is fine if a device exists even if not playing?
    // Actually queue requires active device too.
    if (!user || !spotifyIsPremium) return;

    const token = await getValidSpotifyToken(user.id);
    if (!token) return;

    try {
      await addToQueue(token, trackUri);
    } catch (error) {
      console.error('Error adding to queue:', error);
    }
  };

  const search = async (query: string) => {
    if (!user) return [];

    const token = await getValidSpotifyToken(user.id);
    if (!token) return [];

    try {
      return await searchTracks(token, query);
    } catch (error) {
      console.error('Error searching:', error);
      return [];
    }
  };

  // Get current track info (works for all users)
  const getCurrentTrack = async () => {
    if (!user || !spotifyConnected) return null;

    const token = await getValidSpotifyToken(user.id);
    if (!token) return null;

    try {
      return await getCurrentlyPlaying(token);
    } catch (error) {
      console.error('Error getting current track:', error);
      return null;
    }
  };

  return {
    spotifyConnected,
    spotifyIsPremium,
    playbackState,
    currentTrack: playbackState?.item ?? null,
    isPlaying: playbackState?.is_playing ?? false,

    // Auth
    connectSpotify,
    handleSpotifyAuth,
    disconnectSpotify,

    // Controls (Premium only)
    togglePlayback,
    nextTrack,
    previousTrack,
    queueTrack,
    search,

    // Info (all users)
    getCurrentTrack,
    startPolling,
    stopPolling,
  };
}
