# Spotify API Integration Research

## Overview
This document summarizes the current status of the Spotify integration in the Runna app, the issues encountered (specifically 403 Forbidden errors), and the researched solutions.

## Current Implementation
- **Package:** `@wwdrew/expo-spotify-sdk` (Likely used for Auth)
- **Direct API:** `lib/spotify.ts` implements a direct wrapper around `https://api.spotify.com/v1`.
- **Auth Flow:** Authorization Code Flow via `expo-auth-session` + Supabase token management.

### Scopes Used
The following scopes are currently requested:
- `user-read-playback-state`
- `user-modify-playback-state` (Critical for playback control)
- `user-read-currently-playing`
- `playlist-read-private`
- `user-read-private`
- `user-read-email`

## The 403 Forbidden Error
The user reported the following error when calling `play`:
```
ERROR Error toggling playback: [Error: Spotify API error: 403]
```

### Causes
According to Spotify Web API documentation and community research, a 403 status on `PUT /me/player/play` typically indicates:
1.  **No Active Device:** The user has no device currently active (open and ready to play). The API requires an active device to accept a play command unless a specific `device_id` is provided.
2.  **Restriction:** The user is not a Premium subscriber (Free users have limited API control).
3.  **Scope Issues:** Although less likely if `user-modify-playback-state` is present, it can happen if the token is old or scopes changed.

### Diagnosis
Given the user previously mentioned "no active device being selected", Cause #1 is the primary suspect. The API throws 403 if it doesn't know *where* to play the music.

## Solution Strategy

### 1. Robust Error Handling
The current code throws a generic message:
```typescript
throw new Error(`Spotify API error: ${response.status}`);
```
We need to parse the response body, which often contains a specific reason (e.g., "NO_ACTIVE_DEVICE").

### 2. Device Activation Workflow
To fix the "No Active Device" issue, we implement the following logic in the `play` function:

1.  **Attempt Play:** Try to play normally.
2.  **Catch 403:** If a 403 occurs (or preemptively):
    -   Fetch available devices via `GET /me/player/devices`.
    -   If devices are found but none are active, select the first available device.
    -   Transfer playback to that device via `PUT /me/player` (payload: `{"device_ids": ["<id>"]}`).
    -   Retry the `play` command with the `device_id`.

## API Endpoints Reference

### Playback
-   **Play:** `PUT /v1/me/player/play`
    -   Body: `{"context_uri": "...", "uris": [...]}`
    -   Query: `device_id` (Optional but recommended)
-   **Pause:** `PUT /v1/me/player/pause`
-   **Next:** `POST /v1/me/player/next`
-   **Previous:** `POST /v1/me/player/previous`
-   **Set Volume:** `PUT /v1/me/player/volume`

### Device Management
-   **Get Devices:** `GET /v1/me/player/devices`
-   **Transfer Playback:** `PUT /v1/me/player`
    -   Body: `{"device_ids": ["string"], "play": boolean}`

## Action Items
1.  Update `lib/spotify.ts` to include better error parsing.
2.  Implement `ensureActiveDevice` helper function.
3.  Wrap `play`, `skip`, etc., to use this helper.
