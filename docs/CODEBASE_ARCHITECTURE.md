# Runna Codebase Architecture

This document provides a comprehensive overview of the Runna app architecture, data flows, and key implementation details.

---

## Table of Contents
1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Authentication & User Management](#authentication--user-management)
4. [Strava Integration](#strava-integration)
5. [Spotify Integration](#spotify-integration)
6. [Voice Companion (OpenAI Realtime)](#voice-companion-openai-realtime)
7. [GPS Tracking](#gps-tracking)
8. [State Management](#state-management)
9. [Supabase Edge Functions](#supabase-edge-functions)
10. [Color Theme & Design System](#color-theme--design-system)

---

## Overview

Runna is an AI-powered running companion mobile app built with:
- **React Native + Expo SDK 54**
- **Expo Router** for file-based routing
- **Zustand** for state management
- **Supabase** for backend (Auth, PostgreSQL, Edge Functions)
- **OpenAI Realtime API** for voice conversation via WebRTC

---

## Project Structure

```
runna/
├── app/                     # Expo Router pages
│   ├── (auth)/             # Unauthenticated routes
│   │   ├── _layout.tsx     # Auth route layout (Stack navigator)
│   │   └── login.tsx       # Login/signup screen
│   ├── (tabs)/             # Main authenticated tabs
│   │   ├── _layout.tsx     # Tab navigator layout
│   │   ├── index.tsx       # Home tab
│   │   ├── run.tsx         # Run tracking tab
│   │   ├── history.tsx     # Activity history tab
│   │   └── settings.tsx    # Settings tab
│   └── _layout.tsx         # Root layout with auth protection
├── components/
│   └── Themed.tsx          # Themed Text/View components
├── constants/
│   └── Colors.ts           # Color definitions
├── hooks/
│   ├── useAuth.ts          # Authentication hook
│   ├── useStrava.ts        # Strava integration hook
│   ├── useSpotify.ts       # Spotify integration hook
│   ├── useVoiceCompanion.ts # Voice AI hook
│   └── useGPSTracking.ts   # GPS tracking hook
├── lib/
│   ├── supabase.ts         # Supabase client
│   ├── strava.ts           # Strava API functions
│   ├── spotify.ts          # Spotify API functions
│   └── openai-realtime.ts  # OpenAI Realtime WebRTC client
├── stores/
│   └── runStore.ts         # Zustand store
├── types/
│   └── index.ts            # TypeScript type definitions
├── supabase/
│   └── functions/          # Edge Functions
│       ├── strava-exchange/
│       ├── strava-refresh/
│       ├── spotify-refresh/
│       └── openai-session/
└── app.json                # Expo configuration
```

---

## Authentication & User Management

### Files
- `hooks/useAuth.ts` - Authentication hook
- `lib/supabase.ts` - Supabase client configuration
- `app/_layout.tsx` - Route protection via `useProtectedRoute()`

### Flow
1. User signs in via email/password or magic link
2. Supabase Auth manages session tokens
3. `useProtectedRoute()` in root layout redirects unauthenticated users to login
4. User profile stored in `profiles` table with OAuth tokens

### Database Schema
```sql
profiles:
  id                      UUID (FK to auth.users)
  email                   TEXT
  display_name            TEXT
  strava_athlete_id       TEXT
  strava_access_token     TEXT
  strava_refresh_token    TEXT
  strava_token_expires_at TIMESTAMP
  spotify_access_token    TEXT
  spotify_refresh_token   TEXT
  runner_persona          JSONB
  created_at              TIMESTAMP
  updated_at              TIMESTAMP
```

---

## Strava Integration

### Files
- `lib/strava.ts` - Core Strava API functions
- `hooks/useStrava.ts` - React hook for Strava integration
- `supabase/functions/strava-exchange/` - OAuth token exchange
- `supabase/functions/strava-refresh/` - Token refresh

### OAuth Flow
1. User taps "Connect Strava"
2. `expo-auth-session` opens Strava OAuth page
3. User authorizes, redirects to `runna://strava-callback`
4. App calls Edge Function `strava-exchange` to exchange code for tokens
5. Tokens stored in `profiles` table

### Token Management

#### Token Refresh (`lib/strava.ts:70-93`)
```typescript
export async function refreshStravaToken(refreshToken: string) {
  const { data, error } = await supabase.functions.invoke('strava-refresh', {
    body: { refresh_token: refreshToken },
  });
  // Returns: access_token, refresh_token, expires_at
}
```

#### Valid Token Check (`lib/strava.ts:96-145`)
- Checks if token expires in < 5 minutes
- Automatically refreshes if needed
- Updates profile with new tokens
- Throws error with reconnect message on failure

### Activity Sync
- Fetches activities from Strava API
- Stores in `activities` table
- Calculates `runner_persona` from activity history

### Connection State Issues
**Critical Bug Identified**: When token refresh fails, `stravaConnected` state is NOT updated to `false`. The UI continues showing "connected" even though operations fail.

Location in code:
- `hooks/useStrava.ts:234-236` - `checkConnection()` catches errors silently, returns `false` but doesn't update state

---

## Spotify Integration

### Files
- `lib/spotify.ts` - Spotify API functions
- `hooks/useSpotify.ts` - React hook for Spotify
- `supabase/functions/spotify-refresh/` - Token refresh

### SDK
Uses `@wwdrew/expo-spotify-sdk` which provides native SDK integration.

### Key Functions (`lib/spotify.ts`)
- `playTrack()` - Play specific track
- `pausePlayback()` - Pause current playback
- `resumePlayback()` - Resume playback
- `skipToNext()` - Skip to next track
- `skipToPrevious()` - Skip to previous track
- `setVolume()` - Set playback volume (Premium only)
- `searchTracks()` - Search for tracks
- `getCurrentlyPlaying()` - Get current track info

### Premium vs Free
- **Premium**: Full playback control
- **Free**: Metadata only (can see what's playing but can't control)

---

## Voice Companion (OpenAI Realtime)

### Files
- `lib/openai-realtime.ts` - WebRTC client for OpenAI Realtime API
- `hooks/useVoiceCompanion.ts` - React hook managing voice sessions
- `supabase/functions/openai-session/` - Ephemeral token generation

### Architecture

#### WebRTC Connection (`lib/openai-realtime.ts`)
```typescript
class RealtimeClient {
  peerConnection: RTCPeerConnection    // WebRTC peer connection
  dataChannel: RTCDataChannel          // Events channel
  mediaStream: MediaStream             // User's microphone
}
```

#### Connection Flow
1. Get ephemeral token from `openai-session` Edge Function
2. Create RTCPeerConnection with STUN server
3. Get microphone access via `mediaDevices.getUserMedia()`
4. Create data channel for events
5. Send SDP offer to OpenAI Realtime API
6. Set remote description from response
7. Configure session (voice, VAD settings, tools)

#### Session Configuration (`lib/openai-realtime.ts:335-360`)
```typescript
const sessionConfig = {
  type: 'session.update',
  session: {
    instructions: this.systemPrompt,    // Dynamic prompt with user context
    voice: 'alloy',                      // Voice model
    input_audio_format: 'pcm16',
    output_audio_format: 'pcm16',
    turn_detection: {
      type: 'server_vad',               // Server-side voice activity detection
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
    },
    tools: AI_FUNCTIONS,                // Function calling definitions
  },
};
```

#### AI Functions
The voice AI can call these functions:
1. `control_music` - Play/pause/skip/queue songs
2. `get_running_stats` - Get user's running statistics
3. `save_note` - Save voice notes
4. `get_motivation` - Get motivational messages
5. `tell_joke` - Tell jokes

#### System Prompt Generation (`lib/openai-realtime.ts:96-149`)
Builds dynamic prompt including:
- User's name
- Current run duration
- Runner persona (typical distance, pace, frequency)
- Currently playing track
- Personality guidelines

### Audio Configuration Issue
**Critical Bug Identified**: No iOS audio session configuration. The code relies on WebRTC's default behavior which may:
- Play through earpiece instead of speaker
- Not respect silent mode setting
- Play at reduced volume

Required fix: Add `expo-av` Audio.setAudioModeAsync() before connecting:
```typescript
await Audio.setAudioModeAsync({
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
  staysActiveInBackground: true,
});
```

---

## GPS Tracking

### Files
- `hooks/useGPSTracking.ts` - Main GPS tracking hook
- `stores/runStore.ts` - GPS state storage
- `types/index.ts` - Type definitions

### Location Tracking Flow

#### 1. Permission Request (`useGPSTracking.ts:154-198`)
- Check if location services enabled
- Request foreground permissions
- Show appropriate error alerts if denied

#### 2. Start Tracking (`useGPSTracking.ts:289-357`)
```typescript
const startTracking = async () => {
  // Request permissions
  // Clear previous route
  // Configure tracking settings
  // Start watching position
};
```

#### 3. Location Update Handler (`useGPSTracking.ts:203-284`)
Each location update:
1. Creates `LocationPoint` from GPS coordinates
2. Adds to `routePoints` array
3. Calculates total distance (Haversine formula)
4. Calculates current/average speed and pace
5. Updates `gpsMetrics` in store

### Distance Calculation
Uses Haversine formula (`useGPSTracking.ts:31-44`):
```typescript
const calculateDistance = (p1: LocationPoint, p2: LocationPoint): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (p1.latitude * Math.PI) / 180;
  const φ2 = (p2.latitude * Math.PI) / 180;
  const Δφ = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const Δλ = ((p2.longitude - p1.longitude) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};
```

### Tracking Configuration (`useGPSTracking.ts:315-319`)
```typescript
const trackingConfig = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: isSimulator ? 1000 : 5000,  // 1s or 5s
  distanceInterval: isSimulator ? 1 : 10,    // 1m or 10m
};
```

### Simulator Detection Bug
**Critical Bug Identified** (`useGPSTracking.ts:314`):
```typescript
const isSimulator = __DEV__ && Platform.OS === 'ios';
```

Problem: `__DEV__` is `true` on real devices during development! This check does NOT distinguish between simulator and real device. The result:
- On real device in dev mode: Uses `distanceInterval: 1` (intended for simulator)
- But the actual problem is reverse - if the check "worked", it would use 10m interval which is too large for slow walking

### Type Definitions (`types/index.ts`)
```typescript
interface LocationPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  timestamp: number;
}

interface GPSMetrics {
  currentSpeed: number;      // km/h
  currentPace: number;       // min/km
  averageSpeed: number;      // km/h
  averagePace: number;       // min/km
  totalDistance: number;     // meters
  currentLocation: LocationPoint | null;
}
```

---

## State Management

### Zustand Store (`stores/runStore.ts`)

#### Run State
```typescript
isRunning: boolean
runStartTime: Date | null
runDuration: number
distance: number        // Legacy, use gpsMetrics.totalDistance
pace: number            // Legacy, use gpsMetrics
```

#### GPS State
```typescript
gpsMetrics: GPSMetrics
routePoints: LocationPoint[]
locationPermission: LocationPermissionStatus
gpsError: string | null
```

#### Voice State
```typescript
isListening: boolean
isSpeaking: boolean
voiceEnabled: boolean
```

#### Integration State
```typescript
stravaConnected: boolean
spotifyConnected: boolean
spotifyIsPremium: boolean
activities: Activity[]
runnerPersona: RunnerPersona | null
currentTrack: SpotifyTrack | null
```

#### Actions
```typescript
startRun: () => void
endRun: () => void
updateRunStats: (distance: number, duration: number) => void
setGPSMetrics: (metrics: GPSMetrics) => void
addRoutePoint: (point: LocationPoint) => void
setStravaConnected: (connected: boolean) => void
setActivities: (activities: Activity[]) => void
// ... more actions
```

---

## Supabase Edge Functions

### strava-exchange
Exchanges OAuth code for tokens during initial Strava connection.

### strava-refresh (`supabase/functions/strava-refresh/index.ts`)
Refreshes expired Strava access tokens.

**Environment Variables Required:**
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`

**Request:**
```json
{ "refresh_token": "..." }
```

**Response:**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_at": 1234567890
}
```

**Error Responses:**
- 500: Missing credentials
- 400: Missing refresh_token
- Strava's status code: Strava API error

### spotify-refresh
Refreshes Spotify access tokens.

### openai-session
Generates ephemeral tokens for OpenAI Realtime API connections.

---

## Color Theme & Design System

### Colors (`constants/Colors.ts`)
```typescript
export default {
  light: {
    text: '#000',
    background: '#fff',
    tint: '#FF7F30',           // Primary orange
    primary: '#FF7F30',
    secondary: '#FF9F5C',
    accent: '#FFA500',
    success: '#34C759',
    error: '#FF3B30',
    cardBackground: '#FFFFFF',
    cardBorder: '#E5E5E5',
  },
  dark: {
    text: '#fff',
    background: '#000',
    tint: '#FF7F30',
    primary: '#FF7F30',
    // ... similar to light
  },
};
```

### Primary Color: `#FF7F30` (Orange)
Used for:
- Tab icons (selected)
- Timer display
- Metric values
- Primary buttons
- Accent elements

### Login Screen Styling Issue
**Bug Identified**: Login screen uses hardcoded colors instead of theme:
- Input text: `#fff` (white) - invisible on dark background
- Buttons: `#007AFF` (iOS blue) - inconsistent with brand

---

## iOS Configuration (`app.json`)

### Background Modes
```json
"UIBackgroundModes": ["audio", "fetch"]
```
- `audio`: Allows voice companion to work in background
- `fetch`: Allows background data fetching

### Permissions
```json
"NSMicrophoneUsageDescription": "Runna needs microphone access for voice commands during your run",
"NSSpeechRecognitionUsageDescription": "Runna uses speech recognition to understand your voice commands",
"NSLocationWhenInUseUsageDescription": "Runna needs your location to track distance, pace, and route during your runs."
```

### URL Schemes
- `runna://` - Main app scheme
- `runna://strava-callback` - Strava OAuth redirect
- `runna://callback` - Spotify OAuth redirect

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Profile                             │
│                    (Supabase profiles table)                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         useAuth hook                             │
│                   (Session + Profile data)                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      useRunStore (Zustand)                       │
│  ┌──────────┬───────────┬───────────┬──────────┬──────────┐    │
│  │ Run      │ GPS       │ Voice     │ Strava   │ Spotify  │    │
│  │ State    │ Metrics   │ State     │ Data     │ Data     │    │
│  └────┬─────┴─────┬─────┴─────┬─────┴────┬─────┴────┬─────┘    │
└───────┼───────────┼───────────┼──────────┼──────────┼──────────┘
        │           │           │          │          │
        ▼           ▼           ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐
│useGPS    │ │run.tsx   │ │useVoice  │ │useStrava│ │useSpotify│
│Tracking  │ │(UI)      │ │Companion │ │        │ │        │
└────┬─────┘ └──────────┘ └────┬─────┘ └────┬───┘ └────┬───┘
     │                         │            │          │
     ▼                         ▼            ▼          ▼
┌──────────┐           ┌──────────┐  ┌──────────┐ ┌──────────┐
│expo-     │           │OpenAI    │  │Strava    │ │Spotify   │
│location  │           │Realtime  │  │API       │ │SDK       │
│API       │           │API       │  │          │ │          │
└──────────┘           └──────────┘  └──────────┘ └──────────┘
```

---

## Known Issues & Technical Debt

1. **Login screen colors** - Uses hardcoded white text instead of theme colors
2. **No keyboard dismiss** - Login screen doesn't dismiss keyboard on outside tap
3. **Strava connection state** - Not updated on token refresh failure
4. **Voice audio session** - No iOS audio session configuration
5. **GPS simulator detection** - Uses `__DEV__` which is true on real devices in dev mode
6. **Legacy distance/pace in store** - Store has both legacy fields and gpsMetrics

---

## Future Considerations

1. **Background location tracking** - Currently only foreground; would need `NSLocationAlwaysAndWhenInUseUsageDescription`
2. **Offline support** - Cache activities and sync when online
3. **Watch integration** - Apple Watch/WearOS companion
4. **Social features** - Share runs, challenges, leaderboards
