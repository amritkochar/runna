import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useRunStore } from '../stores/runStore';
import {
  getValidSpotifyToken,
  getPlaybackState,
  getCurrentlyPlaying,
  play,
  pause,
  skipToNext,
  skipToPrevious,
  addToQueue,
  searchTracks,
  checkPremiumStatus,
  getSpotifyUser,
} from '../lib/spotify';
import { updateProfile } from '../lib/supabase';

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

  // Poll for playback state
  const startPolling = useCallback(async () => {
    if (!user || !spotifyConnected) return;

    const poll = async () => {
      try {
        const token = await getValidSpotifyToken(user.id);
        if (token) {
          const state = await getPlaybackState(token);
          setPlaybackState(state);
        }
      } catch (error) {
        console.error('Error polling playback:', error);
      }
    };

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

  // Playback controls (only work for Premium users)
  const togglePlayback = async () => {
    if (!user || !spotifyIsPremium) return;

    const token = await getValidSpotifyToken(user.id);
    if (!token) return;

    try {
      if (playbackState?.is_playing) {
        await pause(token);
      } else {
        await play(token);
      }

      // Update state immediately for responsiveness
      setPlaybackState(
        playbackState
          ? { ...playbackState, is_playing: !playbackState.is_playing }
          : null
      );
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  };

  const nextTrack = async () => {
    if (!user || !spotifyIsPremium) return;

    const token = await getValidSpotifyToken(user.id);
    if (!token) return;

    try {
      await skipToNext(token);

      // Refresh playback state after a short delay
      setTimeout(async () => {
        const state = await getPlaybackState(token);
        setPlaybackState(state);
      }, 300);
    } catch (error) {
      console.error('Error skipping track:', error);
    }
  };

  const previousTrack = async () => {
    if (!user || !spotifyIsPremium) return;

    const token = await getValidSpotifyToken(user.id);
    if (!token) return;

    try {
      await skipToPrevious(token);

      // Refresh playback state after a short delay
      setTimeout(async () => {
        const state = await getPlaybackState(token);
        setPlaybackState(state);
      }, 300);
    } catch (error) {
      console.error('Error going to previous track:', error);
    }
  };

  const queueTrack = async (trackUri: string) => {
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
