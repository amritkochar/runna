import { create } from 'zustand';
import type { Profile, Activity, SpotifyPlaybackState, RunnerPersona } from '../types';

interface RunState {
  // User state
  profile: Profile | null;
  isLoading: boolean;

  // Connection status
  stravaConnected: boolean;
  spotifyConnected: boolean;
  spotifyIsPremium: boolean;

  // Running data
  activities: Activity[];
  runnerPersona: RunnerPersona | null;

  // Current run session
  isRunning: boolean;
  runStartTime: Date | null;
  runDistance: number;
  runDuration: number;

  // Spotify state
  playbackState: SpotifyPlaybackState | null;

  // Voice companion
  isListening: boolean;
  isSpeaking: boolean;
  voiceEnabled: boolean;

  // Actions
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  setStravaConnected: (connected: boolean) => void;
  setSpotifyConnected: (connected: boolean, isPremium: boolean) => void;
  setActivities: (activities: Activity[]) => void;
  setRunnerPersona: (persona: RunnerPersona | null) => void;
  setPlaybackState: (state: SpotifyPlaybackState | null) => void;

  // Run session actions
  startRun: () => void;
  endRun: () => void;
  updateRunStats: (distance: number, duration: number) => void;

  // Voice actions
  setListening: (listening: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  setVoiceEnabled: (enabled: boolean) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  profile: null,
  isLoading: true,
  stravaConnected: false,
  spotifyConnected: false,
  spotifyIsPremium: false,
  activities: [],
  runnerPersona: null,
  isRunning: false,
  runStartTime: null,
  runDistance: 0,
  runDuration: 0,
  playbackState: null,
  isListening: false,
  isSpeaking: false,
  voiceEnabled: true,
};

export const useRunStore = create<RunState>((set) => ({
  ...initialState,

  setProfile: (profile) =>
    set({
      profile,
      stravaConnected: !!profile?.strava_access_token,
      spotifyConnected: !!profile?.spotify_access_token,
      spotifyIsPremium: profile?.spotify_is_premium ?? false,
      runnerPersona: profile?.runner_persona ?? null,
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setStravaConnected: (stravaConnected) => set({ stravaConnected }),

  setSpotifyConnected: (spotifyConnected, spotifyIsPremium) =>
    set({ spotifyConnected, spotifyIsPremium }),

  setActivities: (activities) => set({ activities }),

  setRunnerPersona: (runnerPersona) => set({ runnerPersona }),

  setPlaybackState: (playbackState) => set({ playbackState }),

  startRun: () =>
    set({
      isRunning: true,
      runStartTime: new Date(),
      runDistance: 0,
      runDuration: 0,
    }),

  endRun: () =>
    set({
      isRunning: false,
      runStartTime: null,
    }),

  updateRunStats: (runDistance, runDuration) =>
    set({ runDistance, runDuration }),

  setListening: (isListening) => set({ isListening }),

  setSpeaking: (isSpeaking) => set({ isSpeaking }),

  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),

  reset: () => set(initialState),
}));
