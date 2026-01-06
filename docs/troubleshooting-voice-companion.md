# Troubleshooting: Voice Companion Setup

This document captures the issues encountered while setting up the voice companion feature (OpenAI Realtime API integration) and their resolutions.

---

## Issue 1: React Native URL Polyfill Import Error

**Error:**
```
Unable to resolve "react-native-url-polyfill/dist/polyfill" from "lib/supabase.ts"
```

**Cause:**
The import path `react-native-url-polyfill/dist/polyfill` was outdated. In version 3.x of `react-native-url-polyfill`, the package structure changed and the `/dist/polyfill` path no longer exists.

**Solution:**
Update the import in `lib/supabase.ts`:

```typescript
// Before (broken)
import 'react-native-url-polyfill/dist/polyfill';

// After (fixed)
import 'react-native-url-polyfill/auto';
```

**Lesson:** When upgrading packages, check for breaking changes in import paths. The `/auto` export automatically sets up the polyfill.

---

## Issue 2: Invalid Strava OAuth Scope

**Error:**
```json
{"message":"Bad Request","errors":[{"resource":"Authorize","field":"scope","code":"invalid"}]}
```

**Cause:**
The Strava OAuth scopes array included `'read'` which is not a valid Strava OAuth scope, or conflicts with more specific scopes.

**Solution:**
Update `lib/strava.ts` to remove the invalid scope:

```typescript
// Before (broken)
const STRAVA_SCOPES = ['read', 'activity:read_all', 'profile:read_all'];

// After (fixed)
const STRAVA_SCOPES = ['activity:read_all', 'profile:read_all'];
```

**Lesson:** Always verify OAuth scopes against the provider's official documentation. The specific scopes (`activity:read_all`, `profile:read_all`) already provide the necessary access.

---

## Issue 3: React Infinite Loop (Maximum Update Depth Exceeded)

**Error:**
```
Render Error: Maximum update depth exceeded. This can happen when a component
repeatedly calls setState inside componentWillUpdate or componentDidUpdate.
```

**Cause:**
In `hooks/useVoiceCompanion.ts`, the `useEffect` hook had `connect` and `disconnect` functions in its dependency array. These functions were created with `useCallback` and depended on Zustand store setters (`setListening`, `setSpeaking`). This created a cycle:

1. Effect runs → calls `disconnect()` → calls `setListening(false)`
2. Store update → component re-renders
3. `connect`/`disconnect` functions recreated (new references)
4. Effect dependency changed → effect runs again
5. Infinite loop

**Solution:**
1. Create stable refs for the store setters:
```typescript
const setListeningRef = useRef(setListening);
const setSpeakingRef = useRef(setSpeaking);

useEffect(() => {
  setListeningRef.current = setListening;
  setSpeakingRef.current = setSpeaking;
}, [setListening, setSpeaking]);
```

2. Use refs in callbacks instead of direct setters:
```typescript
const disconnect = useCallback(() => {
  // ...
  setListeningRef.current(false);
  setSpeakingRef.current(false);
}, []); // Empty deps - stable reference
```

3. Remove unstable dependencies from the effect:
```typescript
useEffect(() => {
  if (voiceEnabled && isRunning) {
    connect();
  } else {
    disconnect();
  }
  return () => disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [voiceEnabled, isRunning]); // Only reactive values
```

**Lesson:** When using Zustand with React hooks, be careful about including store functions in dependency arrays. Use refs to break circular dependencies while keeping the latest function reference.

---

## Issue 4: Supabase Edge Function 401 Unauthorized

**Error:**
```
FunctionsHttpError: Edge Function returned a non-2xx status code
status: 401
```

**Cause:**
Supabase Edge Functions require JWT verification by default. Even though the function code didn't explicitly verify JWTs, Supabase's infrastructure was blocking unauthenticated requests.

**Solution:**
Redeploy the function with the `--no-verify-jwt` flag:

```bash
supabase functions deploy openai-session --no-verify-jwt
```

**When to use `--no-verify-jwt`:**
- Public endpoints that don't need user authentication
- Endpoints that handle their own authentication
- Utility functions like creating ephemeral API tokens

**Lesson:** Understand Supabase's default security settings. For functions that don't need user context, explicitly disable JWT verification during deployment.

---

## Issue 5: RTCPeerConnection Not Available in React Native

**Error:**
```
ReferenceError: Property 'RTCPeerConnection' doesn't exist
```

**Cause:**
`RTCPeerConnection` is a Web API that doesn't exist in React Native. The original code was written for web browsers and assumed browser globals would be available.

**Solution:**
1. Install `react-native-webrtc`:
```bash
npm install react-native-webrtc
```

2. Update imports in `lib/openai-realtime.ts`:
```typescript
import {
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
```

3. Update the code to use React Native WebRTC APIs:
```typescript
// Before (browser API)
this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

// After (React Native WebRTC)
this.mediaStream = await mediaDevices.getUserMedia({
  audio: true,
  video: false,
}) as MediaStream;
```

4. Use proper RTCSessionDescription for remote description:
```typescript
await this.peerConnection.setRemoteDescription(
  new RTCSessionDescription({ type: 'answer', sdp: answerSdp })
);
```

**Lesson:** React Native doesn't have browser APIs. Always check if native modules are needed for web-specific functionality like WebRTC, geolocation, etc.

---

## Issue 6: Expo Config Plugin for Native Modules

**Error:**
```
PluginError: Unable to resolve a valid config plugin for react-native-webrtc.
```

**Cause:**
`react-native-webrtc` is a native module that requires native code compilation. It doesn't include an Expo config plugin, so Expo can't automatically configure the native projects.

**Solution:**
1. Install the community config plugin:
```bash
npm install @config-plugins/react-native-webrtc
```

2. Install expo-dev-client for development builds:
```bash
npm install expo-dev-client
```

3. Update `app.json` to use the correct plugin:
```json
{
  "plugins": [
    ["@config-plugins/react-native-webrtc", {
      "cameraPermission": false,
      "microphonePermission": "Runna needs microphone access for voice commands during your run"
    }]
  ]
}
```

4. Generate native projects:
```bash
npx expo prebuild --clean
```

5. Build and run with native code (not Expo Go):
```bash
npx expo run:ios
```

**Lesson:** Native modules in Expo require:
- A config plugin (official or community `@config-plugins/*`)
- `expo-dev-client` for development
- A development build instead of Expo Go

---

## Summary: Development Build vs Expo Go

| Feature | Expo Go | Development Build |
|---------|---------|-------------------|
| Native modules | Not supported | Supported |
| Custom native code | No | Yes |
| Build time | Instant | Minutes |
| Distribution | N/A | TestFlight, APK |

For apps using native modules like `react-native-webrtc`, always use development builds:

```bash
# One-time setup
npx expo prebuild --clean

# Run on iOS
npx expo run:ios

# Run on Android
npx expo run:android
```

---

## Quick Reference: Commands Used

```bash
# Supabase CLI
brew install supabase/tap/supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set OPENAI_API_KEY=sk-xxx
supabase functions deploy openai-session --no-verify-jwt
supabase functions list
supabase secrets list

# Expo Development Build
npm install expo-dev-client
npm install @config-plugins/react-native-webrtc
npx expo prebuild --clean
npx expo run:ios
```
