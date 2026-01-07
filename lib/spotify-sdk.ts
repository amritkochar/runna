import { Authenticate } from '@wwdrew/expo-spotify-sdk';
import type { SpotifyScope } from '@wwdrew/expo-spotify-sdk/build/ExpoSpotifySDK.types';

export const SPOTIFY_SCOPES: SpotifyScope[] = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'user-read-private',
  'user-read-email',
];

export async function authenticateSpotify() {
  return Authenticate.authenticateAsync({
    scopes: SPOTIFY_SCOPES,
  });
}
