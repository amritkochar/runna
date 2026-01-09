import { create } from 'zustand';
import type { Profile, Activity, SpotifyPlaybackState, RunnerPersona, LocationPoint, GPSMetrics, LocationPermissionStatus } from '../types';

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

  // GPS tracking
  gpsMetrics: GPSMetrics;
  routePoints: LocationPoint[];
  locationPermission: LocationPermissionStatus;
  gpsError: string | null;

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

  // GPS actions
  setGPSMetrics: (metrics: GPSMetrics) => void;
  addRoutePoint: (point: LocationPoint) => void;
  setLocationPermission: (status: LocationPermissionStatus) => void;
  setGPSError: (error: string | null) => void;
  clearRoute: () => void;

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
  gpsMetrics: {
    currentSpeed: 0,
    currentPace: 0,
    averageSpeed: 0,
    averagePace: 0,
    totalDistance: 0,
    currentLocation: null,
  },
  routePoints: [],
  locationPermission: 'undetermined' as LocationPermissionStatus,
  gpsError: null,
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

  setGPSMetrics: (gpsMetrics) => set({ gpsMetrics }),

  addRoutePoint: (point) =>
    set((state) => ({
      routePoints: [...state.routePoints, point],
    })),

  setLocationPermission: (locationPermission) => set({ locationPermission }),

  setGPSError: (gpsError) => set({ gpsError }),

  clearRoute: () =>
    set({
      routePoints: [],
      gpsMetrics: {
        currentSpeed: 0,
        currentPace: 0,
        averageSpeed: 0,
        averagePace: 0,
        totalDistance: 0,
        currentLocation: null,
      },
    }),

  setListening: (isListening) => set({ isListening }),

  setSpeaking: (isSpeaking) => set({ isSpeaking }),

  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),

  reset: () => set(initialState),
}));
