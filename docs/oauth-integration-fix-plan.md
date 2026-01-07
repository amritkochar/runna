# OAuth Integration Fix Plan

## Issues

### Strava OAuth Scope Error
- **Error**: `{"message":"Bad Request","errors":[{"resource":"Authorize","field":"scope","code":"invalid"}]}`
- **Root Cause**: Invalid scope `'profile:read_all'` at `lib/strava.ts:14`
- **Fix**: Replace with valid scopes `['activity:read_all', 'read']`

### Spotify Authentication Not Implemented
- **Issue**: Placeholder alert instead of actual authentication at `app/(tabs)/settings.tsx:56-63`
- **Root Cause**: `@wwdrew/expo-spotify-sdk` configured but never used
- **Fix**: Create SDK wrapper and implement authentication flow

## Implementation Steps

### 1. Fix Strava Scopes (`lib/strava.ts` line 14)
```typescript
// Change from:
const STRAVA_SCOPES = ['activity:read_all', 'profile:read_all'];

// To:
const STRAVA_SCOPES = ['activity:read_all', 'read'];
```

### 2. Create Spotify SDK Wrapper (`lib/spotify-sdk.ts` - NEW FILE)
```typescript
import { authenticateAsync } from '@wwdrew/expo-spotify-sdk';
import type { SpotifyScope } from '@wwdrew/expo-spotify-sdk';

export const SPOTIFY_SCOPES: SpotifyScope[] = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'user-read-private',
  'user-read-email',
];

export async function authenticateSpotify() {
  return authenticateAsync({
    scopes: SPOTIFY_SCOPES,
  });
}
```

### 3. Add connectSpotify to useSpotify Hook (`hooks/useSpotify.ts`)

Add import:
```typescript
import { authenticateSpotify } from '../lib/spotify-sdk';
```

Add function after `handleSpotifyAuth`:
```typescript
const connectSpotify = async () => {
  if (!user) throw new Error('User not authenticated');

  try {
    const session = await authenticateSpotify();
    const spotifyUser = await getSpotifyUser(session.accessToken);
    const isPremium = spotifyUser.product === 'premium';

    await updateProfile(user.id, {
      spotify_user_id: spotifyUser.id,
      spotify_access_token: session.accessToken,
      spotify_refresh_token: session.refreshToken || null,
      spotify_is_premium: isPremium,
    });

    setSpotifyConnected(true, isPremium);
    await refreshProfile();

    return { success: true, isPremium };
  } catch (error) {
    console.error('Spotify authentication failed:', error);
    throw error;
  }
};
```

Export it:
```typescript
return {
  // ...existing exports
  connectSpotify,
  // ...
};
```

### 4. Update Settings Screen (`app/(tabs)/settings.tsx`)

Update import (line 27):
```typescript
const { spotifyConnected, connectSpotify, disconnectSpotify } = useSpotify();
```

Replace `handleSpotifyConnect` (lines 45-64):
```typescript
const handleSpotifyConnect = async () => {
  if (spotifyConnected) {
    Alert.alert('Disconnect Spotify', 'Are you sure you want to disconnect?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: disconnectSpotify },
    ]);
  } else {
    try {
      setSyncing(true);
      const result = await connectSpotify();

      Alert.alert(
        'Connected!',
        result.isPremium
          ? 'Spotify Premium connected. You can now control playback during runs.'
          : 'Spotify Free account connected. You can see what\'s playing, but playback control requires Spotify Premium.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert(
        'Connection Failed',
        error.message || 'Could not connect to Spotify. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSyncing(false);
    }
  }
};
```

### 5. Add Strava Error Handling (`hooks/useStrava.ts`)

Add import:
```typescript
import { Alert } from 'react-native';
```

Update OAuth response useEffect:
```typescript
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

        await updateProfile(user.id, {
          strava_athlete_id: tokens.athlete.id.toString(),
          strava_access_token: tokens.access_token,
          strava_refresh_token: tokens.refresh_token,
          strava_token_expires_at: new Date(tokens.expires_at * 1000).toISOString(),
        });

        setStravaConnected(true);
        await refreshProfile();

        Alert.alert(
          'Connected!',
          `Connected to Strava as ${tokens.athlete.firstname} ${tokens.athlete.lastname}`,
          [{ text: 'OK' }]
        );

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
```

## Files to Modify

1. `lib/strava.ts` - Fix scope (1 line)
2. `lib/spotify-sdk.ts` - NEW FILE (~15 lines)
3. `hooks/useSpotify.ts` - Add connectSpotify (~35 lines)
4. `app/(tabs)/settings.tsx` - Replace handleSpotifyConnect (~30 lines)
5. `hooks/useStrava.ts` - Add error alerts (~45 lines)

## Testing

### Strava
- Disconnect if connected
- Click Connect → verify OAuth with correct scopes
- Complete auth → verify success message with athlete name
- Verify "Connected" status
- Test sync activities

### Spotify
- **Requires physical iOS/Android device** (SDK doesn't work in simulator)
- Click Connect → complete auth
- Verify Premium/Free message
- Check connection status
- Test playback controls (Premium only)
- Test disconnect/reconnect

### Error Handling
- Cancel OAuth → verify graceful handling
- Network issues → verify error messages
- Invalid credentials → verify alerts

## Notes

- Strava users need to reconnect after scope change
- Spotify requires physical device for testing
- All env variables and redirect URIs already configured
- Supabase Edge Functions already implemented
