import type { SpotifyDevice, SpotifyPlaybackState, SpotifyTrack, SpotifyUser } from '../types';
import { supabase, updateProfile } from './supabase';

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

// Helper: Parse and throw Spotify errors
// Helper: Parse and throw Spotify errors
async function handleSpotifyError(response: Response) {
  if (response.status === 401) {
    // Mark token as expired in store to force refresh on next attempt
    try {
      const store = (await import('../stores/runStore')).useRunStore.getState();
      // Set expiration to 0 to force refresh
      store.setSpotifyTokens(store.spotifyAccessToken, store.spotifyRefreshToken, -1);
      console.log('Spotify 401: Marked token as expired in store');
    } catch (e) {
      console.error('Failed to invalidate token in store:', e);
    }
    throw new Error('Spotify token expired');
  }

  try {
    const errorData = await response.json();
    const message = errorData.error?.message || `Status: ${response.status}`;
    const reason = errorData.error?.reason || 'UNKNOWN';
    throw new Error(`Spotify API error: ${message} (${reason})`);
  } catch (e: any) {
    // If JSON parse fails or error format is different
    if (e.message && e.message.includes('Spotify API error')) throw e;
    throw new Error(`Spotify API error: ${response.status}`);
  }
}

// Helper: Ensure we have an active device.
// Returns a deviceId if we needed to activate one, or undefined if flow proceeds securely.
async function ensureActiveDevice(accessToken: string, targetDeviceId?: string): Promise<string | undefined> {
  // If a specific device is targeted, we trust the caller.
  if (targetDeviceId) return targetDeviceId;

  // 1. Check current playback state
  try {
    const playbackState = await getPlaybackState(accessToken);
    if (playbackState && playbackState.device && playbackState.device.is_active) {
      return undefined; // Already has an active device
    }
  } catch (e) {
    // Ignore error, proceed to finding a device
    console.warn('Failed to check playback state, checking devices...', e);
  }

  // 2. No active device found. Fetch available devices.
  const { devices } = await getDevices(accessToken);

  if (!devices || devices.length === 0) {
    throw new Error('No Spotify devices available. Open Spotify on a device first.');
  }

  // 3. Try to find a device that is already active (redundant check but good safety) or pick the first one.
  const activeDevice = devices.find((d: SpotifyDevice) => d.is_active);
  if (activeDevice) return activeDevice.id!;

  // 4. Pick the first available device (e.g., Smartphone, Computer)
  // We prefer not to grab 'CastAudio' or restricted devices if possible, but for now take first.
  const targetDevice = devices[0];
  if (!targetDevice.id) throw new Error('Available device has no ID');

  console.log(`Activating Spotify device: ${targetDevice.name}`);

  // 5. Transfer playback to this device
  await transferPlayback(accessToken, targetDevice.id, false); // Don't auto-play yet, just transfer

  // Give it a moment to propagate? 
  // Spotify API can be slow. We'll return the ID so the caller can explicitly use it.
  return targetDevice.id;
}

// Get current user profile
export async function getSpotifyUser(accessToken: string): Promise<SpotifyUser> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    await handleSpotifyError(response);
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
    await handleSpotifyError(response);
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
    await handleSpotifyError(response);
  }

  const data = await response.json();
  return data.item;
}

// Play/Resume playback
export async function play(accessToken: string, deviceId?: string): Promise<void> {
  // Ensure we have a target device if none is known to be active
  const effectiveDeviceId = await ensureActiveDevice(accessToken, deviceId);

  const url = effectiveDeviceId
    ? `${SPOTIFY_API_BASE}/me/player/play?device_id=${effectiveDeviceId}`
    : `${SPOTIFY_API_BASE}/me/player/play`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    // If we get a 403, and we didn't specify a device, it might be that the "Active" check failed race condition.
    // Retry once with explicit device selection if we haven't already
    if (response.status === 403 && !effectiveDeviceId) {
      console.warn('Got 403 on play, retrying with force device activation...');
      const retryDeviceId = await ensureActiveDevice(accessToken); // Will fetch devices
      if (retryDeviceId) {
        const retryUrl = `${SPOTIFY_API_BASE}/me/player/play?device_id=${retryDeviceId}`;
        const retryResponse = await fetch(retryUrl, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!retryResponse.ok && retryResponse.status !== 204) {
          await handleSpotifyError(retryResponse);
        }
        return;
      }
    }
    await handleSpotifyError(response);
  }
}

// Pause playback
export async function pause(accessToken: string, deviceId?: string): Promise<void> {
  const effectiveDeviceId = await ensureActiveDevice(accessToken, deviceId);
  const url = effectiveDeviceId
    ? `${SPOTIFY_API_BASE}/me/player/pause?device_id=${effectiveDeviceId}`
    : `${SPOTIFY_API_BASE}/me/player/pause`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    await handleSpotifyError(response);
  }
}

// Skip to next track
export async function skipToNext(accessToken: string, deviceId?: string): Promise<void> {
  const effectiveDeviceId = await ensureActiveDevice(accessToken, deviceId);
  const url = effectiveDeviceId
    ? `${SPOTIFY_API_BASE}/me/player/next?device_id=${effectiveDeviceId}`
    : `${SPOTIFY_API_BASE}/me/player/next`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    await handleSpotifyError(response);
  }
}

// Skip to previous track
export async function skipToPrevious(accessToken: string, deviceId?: string): Promise<void> {
  const effectiveDeviceId = await ensureActiveDevice(accessToken, deviceId);
  const url = effectiveDeviceId
    ? `${SPOTIFY_API_BASE}/me/player/previous?device_id=${effectiveDeviceId}`
    : `${SPOTIFY_API_BASE}/me/player/previous`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    await handleSpotifyError(response);
  }
}

// Set volume (0-100)
export async function setVolume(accessToken: string, volumePercent: number): Promise<void> {
  // Volume also requires active specific device sometimes, but API doesn't take device_id in URL IIRC?
  // Actually documentation says: PUT /v1/me/player/volume?volume_percent=50&device_id=...
  // Let's add device support if needed, but for now just fix error handling.

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
    await handleSpotifyError(response);
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
    await handleSpotifyError(response);
  }

  return response.json();
}

// Start playback of a specific context (playlist, album, etc.)
export async function playContext(
  accessToken: string,
  contextUri: string,
  deviceId?: string
): Promise<void> {
  const effectiveDeviceId = await ensureActiveDevice(accessToken, deviceId);
  const url = effectiveDeviceId
    ? `${SPOTIFY_API_BASE}/me/player/play?device_id=${effectiveDeviceId}`
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
    await handleSpotifyError(response);
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
    await handleSpotifyError(response);
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
    await handleSpotifyError(response);
  }
}

// Get available devices
export async function getDevices(accessToken: string): Promise<{ devices: SpotifyDevice[] }> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/devices`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    await handleSpotifyError(response);
  }

  return response.json();
}

// Transfer playback to a specific device
export async function transferPlayback(accessToken: string, deviceId: string, play: boolean = false): Promise<void> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      device_ids: [deviceId],
      play: play,
    }),
  });

  if (!response.ok && response.status !== 204) {
    await handleSpotifyError(response);
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

  if (error) {
    console.error('Spotify token refresh failed:', {
      error,
      message: error.message,
      context: error.context || 'No additional context',
    });
    throw error;
  }

  if (!data || !data.access_token) {
    throw new Error('Invalid token refresh response: missing access_token');
  }

  // Update store with new tokens
  // Import store dynamically to avoid circular dependencies if any (though usually fine in handlers)
  // Actually we need to be careful with imports. Let's assume standard import works.
  // We can't import hooks here, but we can import the store directly.
  return data;
}

// Get valid access token (refresh if needed)
export async function getValidSpotifyToken(userId: string): Promise<string | null> {
  // 1. Check Store Cache
  // We need to import the store. Since it's a regular function, we can import it at top level or here.
  // Let's rely on top-level import added in next step or use require if needed.
  // Ideally, modify imports at top of file. 
  // For now, let's assume `useRunStore` is available or we add it to imports.

  // NOTE: This ReplaceBlock is large, so I will handle the import in a separate tool call to be safe 
  // or I can assume I'll fix imports after. Let's try to do it all ensuring we have the import.

  // ACCESS STORE DIRECTLY
  // We need to add `import { useRunStore } from '../stores/runStore';` to the top of file.
  // But wait, `useRunStore` is a hook. `useRunStore.getState()` is valid outside components.

  const store = (await import('../stores/runStore')).useRunStore.getState();

  if (store.spotifyAccessToken) {
    const now = Date.now();
    const expiresAt = store.spotifyTokenExpiresAt;

    // Buffer of 60 seconds
    if (!expiresAt || now < expiresAt - 60000) {
      return store.spotifyAccessToken;
    }

    // Token expired or close to expiring, try refresh
    if (store.spotifyRefreshToken) {
      try {
        console.log('Refreshing expired Spotify token from store cache...');
        const tokens = await refreshSpotifyToken(store.spotifyRefreshToken);

        // Update store
        store.setSpotifyTokens(tokens.access_token, tokens.refresh_token || store.spotifyRefreshToken, tokens.expires_in);

        // Update Supabase (optimistic, don't wait)
        updateProfile(userId, {
          spotify_access_token: tokens.access_token,
          ...(tokens.refresh_token && { spotify_refresh_token: tokens.refresh_token }),
        }).catch(err => console.error('Failed to persist refreshed token:', err));

        return tokens.access_token;
      } catch (e: any) {
        // Handle failed refresh (invalid grant, revoked access, 400/401)
        // If the refresh token is bad, we MUST clear it to stop the loop.
        console.warn('Refresh failed, disconnecting Spotify:', e.message || e);

        // Clear tokens from store immediately
        store.setSpotifyTokens(null, null, undefined);
        store.setSpotifyConnected(false, false);

        // Clear from database to prevent future issues
        try {
          await updateProfile(userId, {
            spotify_access_token: null,
            spotify_refresh_token: null,
            spotify_is_premium: false
          });
        } catch (dbError) {
          console.warn('Failed to clear Supabase tokens:', dbError);
        }

        return null;
      }
    } else {
      // No refresh token but we have an expired access token?
      // Should probably just return null and let the next logic decide, 
      // but typically this means we are disconnected.
      // Let's safe fallthrough? No, if it's expired and no refresh token, it's dead.
      return null;
    }
  }

  // 2. Fallback to Supabase (Initial load or cache miss)
  // First verify we have a valid Supabase session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('spotify_access_token, spotify_refresh_token')
    .eq('id', userId)
    .single();

  if (profileError) {
    const isAuthError = profileError.code === 'PGRST301' ||
      profileError.message?.includes('JWT') ||
      profileError.message?.includes('session');

    if (isAuthError) return null;

    console.error('Error fetching profile for Spotify token:', {
      code: profileError.code,
      message: profileError.message,
    });
    return null;
  }

  if (!profile?.spotify_access_token) {
    return null;
  }

  // Update store with fetched token (assume valid for now as we don't have expiration from DB)
  // We can't know when it expires, so we set it to null or a short default? 
  // Safest is to set it, use it, and if 401 happens, handleSpotifyError detects it.
  // But wait, `handleSpotifyError` throws. We need to catch 401 somewhere?
  // `getValidSpotifyToken` just gets a token. The consumer calls API. 
  // If API returns 401, consumer should probably trigger refresh.
  // BUT the current architecture relies on `getValidSpotifyToken` to checking expiration.
  // Since we don't have expiration from DB, we just return it.
  // If we want to be smarter, we could `try` a lightweight call? No, that defeats the purpose.

  // Let's treat DB tokens as "Unknown expiration" (null).
  // If they fail downstream, we can improve `handleSpotifyError` to invalidate store.

  store.setSpotifyTokens(profile.spotify_access_token, profile.spotify_refresh_token, undefined);

  // Try to use current token first
  // We verified it exists.

  // OPTIONAL: We could proactively check validity with `getSpotifyUser` but that adds latency.
  // Let's stick to the requested fix: reduce DB polling.
  // Returning the token from DB is fine.

  return profile.spotify_access_token;
}

// Check if user is premium
export async function checkPremiumStatus(accessToken: string): Promise<boolean> {
  const user = await getSpotifyUser(accessToken);
  return user.product === 'premium';
}
