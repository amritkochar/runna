# iOS Device Testing Fixes

This document outlines fixes for 5 issues discovered during real device testing on iOS.

---

## Issue 1: Login Input Fields Text Color

### Problem
Input text color is `#fff` (white), invisible against the dark background.

### File
`app/(auth)/login.tsx` (line 158)

### Current Code
```typescript
input: {
  // ...
  color: '#fff',  // White text - invisible on dark background
}
```

### Fix
Change `input.color` from `#fff` to `#FF7F30` (primary orange) or a dark color that contrasts with the background. Also update the button color from `#007AFF` (iOS blue) to `#FF7F30` for brand consistency.

---

## Issue 2: Dismiss Keyboard on Tap Outside

### Problem
Keyboard stays open when tapping outside input fields on the login screen.

### File
`app/(auth)/login.tsx`

### Current Code
The screen uses `KeyboardAvoidingView` but has no tap-to-dismiss behavior.

### Fix
1. Import `TouchableWithoutFeedback` and `Keyboard` from `react-native`
2. Wrap the content with `TouchableWithoutFeedback` that calls `Keyboard.dismiss()` on press

```typescript
import { TouchableWithoutFeedback, Keyboard } from 'react-native';

// In render:
<TouchableWithoutFeedback onPress={Keyboard.dismiss}>
  <View style={styles.content}>
    {/* ... existing content */}
  </View>
</TouchableWithoutFeedback>
```

---

## Issue 3: Strava Token Refresh Errors

### Problem
Edge Function returns non-2xx status, but UI still shows "connected". Error log:
```
ERROR  ❌ [Strava] Token refresh error: [FunctionsHttpError: Edge Function returned a non-2xx status code]
```

### Files
- `lib/strava.ts`
- `hooks/useStrava.ts`
- `supabase/functions/strava-refresh/index.ts`

### Root Cause Analysis
1. When `refreshStravaToken()` fails, `stravaConnected` state is NOT updated to `false`
2. The `checkConnection()` function silently returns `false` but doesn't update UI state
3. Error details from Edge Function aren't extracted (only generic "non-2xx" message)

### Fix

#### 1. Extract error details in `lib/strava.ts`
```typescript
export async function refreshStravaToken(refreshToken: string) {
  const { data, error } = await supabase.functions.invoke('strava-refresh', {
    body: { refresh_token: refreshToken },
  });

  if (error) {
    console.error('❌ [Strava] Token refresh error:', error);
    // Try to extract more details
    let errorDetails = error.message;
    if (error.context) {
      try {
        const body = await error.context.json();
        errorDetails = body.error || body.details || error.message;
      } catch {}
    }
    throw new Error(`Failed to refresh Strava token: ${errorDetails}`);
  }
  // ...
}
```

#### 2. Update connection state on failure in `hooks/useStrava.ts`
```typescript
const syncActivities = useCallback(async () => {
  // ...
  } catch (error: any) {
    console.error('Error syncing activities:', error);

    // Update connection state when token refresh fails
    if (error.message?.includes('Token refresh failed') ||
        error.message?.includes('No valid Strava token')) {
      setStravaConnected(false);
    }
    // ... show alert
  }
}, [/* deps */]);
```

#### 3. Update checkConnection to modify state
```typescript
const checkConnection = useCallback(async () => {
  if (!user) return false;

  try {
    const token = await getValidStravaToken(user.id);
    return !!token;
  } catch {
    // Token invalid - update connection state
    setStravaConnected(false);
    return false;
  }
}, [user, setStravaConnected]);
```

---

## Issue 4: Voice Companion Volume Too Low

### Problem
WebRTC audio plays but at very low volume compared to other apps (Spotify, YouTube).

### Files
- `lib/openai-realtime.ts`
- `hooks/useVoiceCompanion.ts`

### Root Cause
No iOS audio session configuration. By default, WebRTC audio may:
- Play through the earpiece instead of speaker
- Not mix properly with other audio
- Play at reduced volume

### Fix
Configure audio session using `expo-av` before establishing WebRTC connection:

```typescript
import { Audio } from 'expo-av';

// Add to RealtimeClient.connect() or before calling it:
async function configureAudioSession() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,           // Required for microphone
    playsInSilentModeIOS: true,         // Play audio even in silent mode
    staysActiveInBackground: true,      // Keep audio during backgrounding
    shouldDuckAndroid: true,            // Lower other audio on Android
    playThroughEarpieceAndroid: false,  // Use speaker, not earpiece
  });
}

// In lib/openai-realtime.ts, add to connect():
async connect(ephemeralToken: string): Promise<void> {
  try {
    // Configure audio session first
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    // ... rest of connection logic
  }
}
```

---

## Issue 5: GPS Not Working (Distance Stays at 0)

### Problem
Distance stays at 0.00 km while walking with phone connected to laptop.

### File
`hooks/useGPSTracking.ts`

### Root Cause Analysis

1. **Incorrect simulator detection** (lines 314, 317-318):
```typescript
const isSimulator = __DEV__ && Platform.OS === 'ios';
const trackingConfig = {
  // ...
  timeInterval: isSimulator ? 1000 : 5000,  // 1s for "simulator", 5s for device
  distanceInterval: isSimulator ? 1 : 10,   // 1m for "simulator", 10m for device
};
```

The problem: `__DEV__` is `true` on **real devices** during development! This check doesn't distinguish between simulator and real device.

2. **Distance interval too high**: With `distanceInterval: 10` (10 meters), walking slowly won't trigger location updates.

3. **No initial position**: The code starts watching but doesn't get an initial position first.

### Fix

1. **Remove incorrect simulator detection**:
```typescript
const startTracking = useCallback(async () => {
  // ... permission checks

  // Use consistent tracking config for all devices
  const trackingConfig = {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 3000,      // 3 seconds
    distanceInterval: 1,     // 1 meter - ensures updates even when walking slowly
  };

  // Get initial position first
  try {
    const initialPosition = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });
    console.log('📍 [GPS] Initial position acquired:', initialPosition.coords);
    handleLocationUpdate(initialPosition);
  } catch (e) {
    console.warn('⚠️ [GPS] Could not get initial position:', e);
  }

  // Start watching
  subscriptionRef.current = await Location.watchPositionAsync(
    trackingConfig,
    handleLocationUpdate
  );
  // ...
}, [/* deps */]);
```

2. **Optional: Add location status indicator** in UI to show when GPS is acquiring vs locked.

---

## Files to Modify Summary

| File | Issue(s) |
|------|----------|
| `app/(auth)/login.tsx` | #1, #2 |
| `lib/strava.ts` | #3 |
| `hooks/useStrava.ts` | #3 |
| `lib/openai-realtime.ts` | #4 |
| `hooks/useGPSTracking.ts` | #5 |

---

## Verification Plan

### Issue 1 & 2 (Login Screen)
1. Run app on device: `npm run ios`
2. Navigate to login screen
3. Verify: Input text is visible (orange or dark color)
4. Tap outside input field → keyboard should dismiss

### Issue 3 (Strava)
1. Connect Strava account
2. Wait for token to expire OR manually invalidate tokens in Supabase
3. Pull to refresh on History tab
4. Verify: Shows "Disconnected" status and prompts to reconnect
5. After reconnecting, sync should work

### Issue 4 (Voice Volume)
1. Start a run with Voice Companion enabled
2. Speak to trigger AI response
3. Verify: Voice plays at normal system volume (comparable to YouTube/Spotify)
4. Test with device volume buttons - volume should adjust normally

### Issue 5 (GPS)
1. Start a run on real device (can be indoors near window)
2. Walk around slowly for 1-2 minutes
3. Verify: Distance increases from 0.00 km
4. Check logs for "📡 [GPS] Location update received!" messages
5. Each update should show distance incrementing
