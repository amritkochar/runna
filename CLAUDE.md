# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Runna is an AI-powered running companion mobile app built with React Native (Expo). It integrates with Strava for activity data, Spotify for music control, and OpenAI's Realtime API for voice conversation during runs.

## Commands

```bash
# Development
npm start           # Start Expo dev server
npm run ios         # Start iOS simulator
npm run android     # Start Android emulator
npm run web         # Start web version

# Supabase Edge Functions (from project root)
supabase functions deploy strava-exchange
supabase functions deploy strava-refresh
supabase functions deploy spotify-refresh
supabase functions deploy openai-session
```

## Architecture

### Tech Stack
- **Frontend**: React Native + Expo SDK 54, Expo Router (file-based routing)
- **State**: Zustand (`stores/runStore.ts`)
- **Backend**: Supabase (Auth, PostgreSQL, Edge Functions)
- **AI Voice**: OpenAI Realtime API via WebRTC

### Route Groups (Expo Router)
- `app/(auth)/` - Unauthenticated routes (login)
- `app/(tabs)/` - Main authenticated tabs (home, run, history, settings)
- Route protection handled in `app/_layout.tsx` via `useProtectedRoute()`

### Data Flow
```
User Profile (Supabase) → useAuth hook → useRunStore (Zustand)
                                              ↓
Strava Data ← useStrava hook ←──────────── useRunStore
                                              ↓
Spotify Control ← useSpotify hook ←─────── useRunStore
                                              ↓
Voice AI ← useVoiceCompanion hook ←──────── useRunStore
```

### Key Integrations

**Strava** (`lib/strava.ts`):
- OAuth via `expo-auth-session`
- Token exchange/refresh via Supabase Edge Functions
- Activity sync stores to `activities` table

**Spotify** (`lib/spotify.ts`):
- Auth via `@wwdrew/expo-spotify-sdk` (native SDK)
- Playback control requires Spotify Premium
- Free users get metadata only

**OpenAI Realtime** (`lib/openai-realtime.ts`):
- WebRTC connection for low-latency voice
- Function calling for music control, stats, notes
- System prompt built with user's running persona

### Database Schema (Supabase)
- `profiles` - User data, OAuth tokens, runner_persona JSON
- `activities` - Synced Strava runs with metrics
- `notes` - Voice notes from runs
- `conversations` - AI conversation history

### Path Aliases
`@/*` maps to project root (configured in `tsconfig.json`)

## Environment Variables

Client-side (prefixed with `EXPO_PUBLIC_`):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_STRAVA_CLIENT_ID`
- `EXPO_PUBLIC_SPOTIFY_CLIENT_ID`

Server-side (Supabase Edge Functions secrets):
- `STRAVA_CLIENT_SECRET`
- `SPOTIFY_CLIENT_SECRET`
- `OPENAI_API_KEY`

## OAuth Redirect URIs
- Strava: `runna://strava-callback`
- Spotify: `runna://callback`
