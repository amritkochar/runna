# Runna - AI Running Companion

An iOS-focused mobile app that acts as your intelligent running companion. Talk to it during runs, control your music with voice, and get insights from your running data.

## What It Does

- **Voice Companion**: Talk to an AI during your run - ask for jokes, news, motivation, or your running stats
- **Strava Sync**: Pulls your running history, analyzes patterns, builds a "runner persona"
- **Spotify Control**: Control playback with voice ("skip this", "play something upbeat")
- **Voice Notes**: Save thoughts during runs without touching your phone

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | React Native + Expo SDK 54 |
| Routing | Expo Router (file-based) |
| State | Zustand |
| Backend | Supabase (Auth, PostgreSQL, Edge Functions) |
| Voice AI | OpenAI Realtime API (WebRTC) |
| Integrations | Strava API, Spotify SDK |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Xcode) or physical iOS device
- Supabase account
- API credentials for: Strava, Spotify, OpenAI

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

Fill in your `.env`:

```bash
# Supabase - get from supabase.com dashboard
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Strava - get from strava.com/settings/api
EXPO_PUBLIC_STRAVA_CLIENT_ID=12345

# Spotify - get from developer.spotify.com/dashboard
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=abc123...
```

### 3. Set Up Supabase

1. Create a new Supabase project
2. Run the database migration:
   - Go to SQL Editor in Supabase dashboard
   - Paste contents of `supabase/migrations/001_initial_schema.sql`
   - Execute

3. Deploy Edge Functions:
```bash
# Install Supabase CLI
npm install -g supabase

# Login and link project
supabase login
supabase link --project-ref your-project-ref

# Set secrets (server-side, not in .env)
supabase secrets set STRAVA_CLIENT_ID=your-id
supabase secrets set STRAVA_CLIENT_SECRET=your-secret
supabase secrets set SPOTIFY_CLIENT_ID=your-id
supabase secrets set SPOTIFY_CLIENT_SECRET=your-secret
supabase secrets set OPENAI_API_KEY=sk-...

# Deploy functions
supabase functions deploy strava-exchange
supabase functions deploy strava-refresh
supabase functions deploy spotify-refresh
supabase functions deploy openai-session
```

### 4. Configure OAuth Callbacks

**Strava** (strava.com/settings/api):
- Authorization Callback Domain: `runna://strava-callback`

**Spotify** (developer.spotify.com/dashboard):
- Redirect URI: `runna://callback`

### 5. Run the App

```bash
npm start
# Press 'i' for iOS simulator
# Or scan QR with Expo Go on device
```

> **Note**: Voice features require a physical iOS device (simulator doesn't support real microphone).

---

## Project Structure

```
runna/
├── app/                      # Screens (Expo Router)
│   ├── _layout.tsx           # Root layout + auth protection
│   ├── (auth)/               # Unauthenticated routes
│   │   └── login.tsx         # Login/signup screen
│   └── (tabs)/               # Main app (tab navigation)
│       ├── index.tsx         # Home - stats, connections
│       ├── run.tsx           # Run session + voice UI
│       ├── history.tsx       # Past runs list
│       └── settings.tsx      # Connections, preferences
│
├── lib/                      # Core business logic
│   ├── supabase.ts           # Supabase client + helpers
│   ├── strava.ts             # Strava OAuth + API calls
│   ├── spotify.ts            # Spotify API + playback
│   └── openai-realtime.ts    # Voice AI (WebRTC client)
│
├── hooks/                    # React hooks
│   ├── useAuth.ts            # Auth state + sign in/out
│   ├── useStrava.ts          # Strava connection + sync
│   ├── useSpotify.ts         # Spotify connection + controls
│   └── useVoiceCompanion.ts  # Voice AI orchestration
│
├── stores/
│   └── runStore.ts           # Zustand global state
│
├── types/
│   └── index.ts              # TypeScript interfaces
│
├── supabase/
│   ├── migrations/           # Database schema SQL
│   └── functions/            # Edge Functions (Deno)
│       ├── strava-exchange/  # Exchange OAuth code for tokens
│       ├── strava-refresh/   # Refresh expired tokens
│       ├── spotify-refresh/  # Refresh Spotify tokens
│       └── openai-session/   # Create ephemeral AI session
│
└── components/               # Shared UI components
```

---

## Architecture Deep Dive

### Authentication Flow

```
App Launch
    ↓
useAuth hook checks Supabase session
    ↓
No session? → Redirect to /(auth)/login
Has session? → Load profile, redirect to /(tabs)
    ↓
Profile loaded → useRunStore populated
    ↓
Strava/Spotify tokens in profile? → Mark as connected
```

**Where it lives**: `app/_layout.tsx` → `useProtectedRoute()`

### State Management

All app state flows through Zustand store (`stores/runStore.ts`):

```typescript
// Key state slices:
- profile          // User data from Supabase
- stravaConnected  // Boolean, derived from profile.strava_access_token
- spotifyConnected // Boolean, derived from profile.spotify_access_token
- activities       // Array of synced Strava runs
- runnerPersona    // AI-generated running profile (JSON)
- isRunning        // Current run session active?
- voiceEnabled     // Voice companion toggle
- isListening      // Mic active?
- isSpeaking       // AI talking?
- playbackState    // Current Spotify track
```

### Strava Integration

**OAuth Flow**:
1. User taps "Connect Strava" in Settings
2. `useStrava.connectStrava()` → opens Strava auth page
3. User approves → redirects to `runna://strava-callback?code=xxx`
4. App catches redirect, calls Edge Function `strava-exchange`
5. Edge Function exchanges code for tokens (needs client_secret)
6. Tokens saved to `profiles` table

**Activity Sync**:
1. `useStrava.syncActivities()` called on connect + pull-to-refresh
2. Fetches from Strava API with pagination
3. Filters to Run activities only
4. Upserts to `activities` table
5. Calculates `runner_persona` from activity patterns

**Token Refresh**:
- `getValidStravaToken()` checks expiry before API calls
- Auto-refreshes via `strava-refresh` Edge Function if < 5 min remaining

### Spotify Integration

**Auth**: Uses `@wwdrew/expo-spotify-sdk` native module (not web OAuth)
- Config in `app.json` plugins array
- Opens Spotify app or web auth

**Premium Detection**:
- After auth, fetches user profile
- Checks `product === 'premium'`
- Stored in `profiles.spotify_is_premium`

**Playback Control** (Premium only):
```typescript
// lib/spotify.ts exports:
play(), pause(), skipToNext(), skipToPrevious()
addToQueue(trackUri), searchTracks(query)
getPlaybackState(), getCurrentlyPlaying()
```

**Free Users**: Can see currently playing track but can't control playback

### Voice Companion (OpenAI Realtime)

**How it works**:
1. Run starts + voice enabled → `useVoiceCompanion` connects
2. Gets ephemeral token from `openai-session` Edge Function
3. Opens WebRTC connection to OpenAI
4. Streams mic audio, receives AI audio responses
5. AI has function calling for actions:

```typescript
// Available AI functions (lib/openai-realtime.ts):
control_music    // play, pause, next, previous, queue
get_running_stats // recent, summary, weekly, personal_best
save_note        // Save voice memo to DB
get_motivation   // Random encouragement
tell_joke        // Running-related jokes
```

**System Prompt**: Built dynamically with user's running data:
- Typical distance, pace, preferred time
- Current playing track
- Run duration so far

### Database Schema

```sql
profiles        -- User + OAuth tokens + runner_persona JSON
activities      -- Strava runs (distance, pace, HR, etc)
notes           -- Voice notes saved during runs
conversations   -- AI conversation history (for context)
```

All tables have Row Level Security - users can only access their own data.

---

## Key Files Quick Reference

| File | Purpose |
|------|---------|
| `app/_layout.tsx` | Auth protection, navigation setup |
| `app/(tabs)/run.tsx` | Main run screen with voice UI |
| `stores/runStore.ts` | All global state |
| `hooks/useAuth.ts` | Login, logout, session management |
| `hooks/useStrava.ts` | Connect, sync, disconnect Strava |
| `hooks/useSpotify.ts` | Connect, playback controls |
| `hooks/useVoiceCompanion.ts` | Voice AI orchestration |
| `lib/openai-realtime.ts` | WebRTC client for OpenAI |
| `supabase/migrations/001_initial_schema.sql` | Full DB schema |

---

## Common Tasks

### Add a new screen
1. Create file in `app/(tabs)/newscreen.tsx`
2. Add tab in `app/(tabs)/_layout.tsx`

### Add new AI function
1. Add function definition in `lib/openai-realtime.ts` → `AI_FUNCTIONS`
2. Handle in `hooks/useVoiceCompanion.ts` → `handleFunctionCall`

### Add new Supabase table
1. Add migration in `supabase/migrations/`
2. Add TypeScript type in `types/index.ts`
3. Add RLS policies in migration

### Debug OAuth
- Strava callback: Check `useStrava` → `useEffect` watching `response`
- Spotify: Native SDK logs to Xcode console

---

## Environment Variables Reference

### Client-side (in `.env`, prefixed `EXPO_PUBLIC_`)

| Variable | Where to get it |
|----------|-----------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API |
| `EXPO_PUBLIC_STRAVA_CLIENT_ID` | strava.com/settings/api |
| `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` | developer.spotify.com/dashboard |

### Server-side (Supabase Secrets, via CLI)

| Secret | Where to get it |
|--------|-----------------|
| `STRAVA_CLIENT_ID` | strava.com/settings/api |
| `STRAVA_CLIENT_SECRET` | strava.com/settings/api |
| `SPOTIFY_CLIENT_ID` | developer.spotify.com/dashboard |
| `SPOTIFY_CLIENT_SECRET` | developer.spotify.com/dashboard |
| `OPENAI_API_KEY` | platform.openai.com/api-keys |

---

## Troubleshooting

### "Strava connection failed"
- Check redirect URI matches exactly: `runna://strava-callback`
- Verify client ID in `.env` matches Strava dashboard
- Check Edge Function logs: `supabase functions logs strava-exchange`

### "Spotify won't connect"
- Spotify SDK requires the Spotify app installed OR falls back to web auth
- Check `app.json` has correct `clientId` in plugins
- Redirect URI must be `runna://callback`

### "Voice not working"
- Must be on physical device (not simulator)
- Check microphone permission granted
- Check OpenAI API key has Realtime API access
- Check Edge Function: `supabase functions logs openai-session`

### "Activities not syncing"
- Strava rate limit: 200 requests/15min, 2000/day
- Check token not expired: look at `profiles.strava_token_expires_at`
- Only "Run" type activities are synced

---

## Useful Commands

```bash
# Start dev server
npm start

# Start with cache clear
npx expo start --clear

# Run on iOS
npm run ios

# Check TypeScript
npx tsc --noEmit

# View Supabase function logs
supabase functions logs openai-session --tail

# Reset Supabase local (if using local dev)
supabase db reset
```

---

## Next Steps / Roadmap Ideas

- [ ] Background location tracking during runs
- [ ] Push notifications for run reminders
- [ ] Social features (share runs)
- [ ] Apple Watch companion app
- [ ] Offline mode with sync queue
- [ ] Custom AI personas/voices
