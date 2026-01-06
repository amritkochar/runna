import { supabase, updateProfile } from './supabase';
import type { SpotifyUser, SpotifyTrack, SpotifyPlaybackState } from '../types';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Spotify scopes we need
export const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'user-read-private',
  'user-read-email',
];

// Get current user profile
export async function getSpotifyUser(accessToken: string): Promise<SpotifyUser> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }

  return response.json();
}

// Get current playback state
export async function getPlaybackState(accessToken: string): Promise<SpotifyPlaybackState | null> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 204) {
    return null; // No active playback
  }

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }

  return response.json();
}

// Get currently playing track
export async function getCurrentlyPlaying(accessToken: string): Promise<SpotifyTrack | null> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/currently-playing`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }

  const data = await response.json();
  return data.item;
}

// Play/Resume playback
export async function play(accessToken: string, deviceId?: string): Promise<void> {
  const url = deviceId
    ? `${SPOTIFY_API_BASE}/me/player/play?device_id=${deviceId}`
    : `${SPOTIFY_API_BASE}/me/player/play`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Spotify API error: ${response.status}`);
  }
}

// Pause playback
export async function pause(accessToken: string): Promise<void> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/pause`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Spotify API error: ${response.status}`);
  }
}

// Skip to next track
export async function skipToNext(accessToken: string): Promise<void> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/next`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Spotify API error: ${response.status}`);
  }
}

// Skip to previous track
export async function skipToPrevious(accessToken: string): Promise<void> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/previous`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Spotify API error: ${response.status}`);
  }
}

// Set volume (0-100)
export async function setVolume(accessToken: string, volumePercent: number): Promise<void> {
  const response = await fetch(
    `${SPOTIFY_API_BASE}/me/player/volume?volume_percent=${volumePercent}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok && response.status !== 204) {
    throw new Error(`Spotify API error: ${response.status}`);
  }
}

// Get user's playlists
export async function getPlaylists(accessToken: string, limit: number = 50) {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/playlists?limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }

  return response.json();
}

// Start playback of a specific context (playlist, album, etc.)
export async function playContext(
  accessToken: string,
  contextUri: string,
  deviceId?: string
): Promise<void> {
  const url = deviceId
    ? `${SPOTIFY_API_BASE}/me/player/play?device_id=${deviceId}`
    : `${SPOTIFY_API_BASE}/me/player/play`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      context_uri: contextUri,
    }),
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Spotify API error: ${response.status}`);
  }
}

// Search for tracks
export async function searchTracks(
  accessToken: string,
  query: string,
  limit: number = 10
): Promise<SpotifyTrack[]> {
  const response = await fetch(
    `${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }

  const data = await response.json();
  return data.tracks.items;
}

// Add track to queue
export async function addToQueue(accessToken: string, trackUri: string): Promise<void> {
  const response = await fetch(
    `${SPOTIFY_API_BASE}/me/player/queue?uri=${encodeURIComponent(trackUri)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok && response.status !== 204) {
    throw new Error(`Spotify API error: ${response.status}`);
  }
}

// Get available devices
export async function getDevices(accessToken: string) {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/devices`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }

  return response.json();
}

// Transfer playback to a specific device
export async function transferPlayback(accessToken: string, deviceId: string): Promise<void> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      device_ids: [deviceId],
    }),
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Spotify API error: ${response.status}`);
  }
}

// Refresh Spotify token (call through backend)
export async function refreshSpotifyToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  const { data, error } = await supabase.functions.invoke('spotify-refresh', {
    body: { refresh_token: refreshToken },
  });

  if (error) throw error;
  return data;
}

// Get valid access token (refresh if needed)
export async function getValidSpotifyToken(userId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('spotify_access_token, spotify_refresh_token')
    .eq('id', userId)
    .single();

  if (!profile?.spotify_access_token || !profile?.spotify_refresh_token) {
    return null;
  }

  // Try to use current token, refresh if it fails
  try {
    await getSpotifyUser(profile.spotify_access_token);
    return profile.spotify_access_token;
  } catch {
    // Token might be expired, try refreshing
    const tokens = await refreshSpotifyToken(profile.spotify_refresh_token);

    await updateProfile(userId, {
      spotify_access_token: tokens.access_token,
      ...(tokens.refresh_token && { spotify_refresh_token: tokens.refresh_token }),
    });

    return tokens.access_token;
  }
}

// Check if user is premium
export async function checkPremiumStatus(accessToken: string): Promise<boolean> {
  const user = await getSpotifyUser(accessToken);
  return user.product === 'premium';
}
