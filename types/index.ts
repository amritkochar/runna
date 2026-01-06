// Database types matching our Supabase schema

export interface Profile {
  id: string;
  strava_athlete_id: string | null;
  strava_access_token: string | null;
  strava_refresh_token: string | null;
  strava_token_expires_at: string | null;
  spotify_user_id: string | null;
  spotify_access_token: string | null;
  spotify_refresh_token: string | null;
  spotify_is_premium: boolean;
  runner_persona: RunnerPersona | null;
  created_at: string;
}

export interface RunnerPersona {
  typical_distance_km: number;
  average_pace_min_per_km: number;
  preferred_run_time: string; // e.g., "morning", "evening"
  heart_rate_zones: {
    easy: [number, number];
    tempo: [number, number];
    threshold: [number, number];
  };
  recent_accomplishments: string[];
  running_frequency: number; // runs per week
  total_runs: number;
}

export interface Activity {
  id: string;
  user_id: string;
  strava_activity_id: number;
  name: string;
  type: string;
  distance_meters: number;
  moving_time_seconds: number;
  elapsed_time_seconds: number;
  start_date: string;
  average_speed: number;
  max_speed: number;
  average_heartrate: number | null;
  max_heartrate: number | null;
  calories: number | null;
  elevation_gain: number | null;
  raw_data: Record<string, unknown>;
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  content: string;
  transcription: string | null;
  activity_id: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  activity_id: string | null;
  messages: ConversationMessage[];
  created_at: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

// Strava API types
export interface StravaAthlete {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  profile: string;
  city: string;
  country: string;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  start_date: string;
  start_date_local: string;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  total_elevation_gain: number;
  has_heartrate: boolean;
}

// Spotify types
export interface SpotifyUser {
  id: string;
  display_name: string;
  product: 'free' | 'open' | 'premium';
  images: { url: string }[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  duration_ms: number;
}

export interface SpotifyPlaybackState {
  is_playing: boolean;
  progress_ms: number;
  item: SpotifyTrack | null;
  device: {
    id: string;
    name: string;
    type: string;
  };
}

// Voice companion types
export interface VoiceCommand {
  type: 'control_music' | 'get_stats' | 'save_note' | 'get_news' | 'tell_joke' | 'general';
  action?: string;
  payload?: Record<string, unknown>;
}

export interface AIFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
