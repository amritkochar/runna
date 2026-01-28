# Codebase Cleanup Plan

Analysis performed: January 2026

---

## Summary

This document outlines dead code, unused exports, duplicate code, and cleanup opportunities identified in the Runna codebase.

**Estimated reduction:** ~200-300 lines of dead/duplicate code

---

## Dead Code to Remove

### Template Files (Safe to Delete)

These are Expo template files not integrated into the app:

| File | Reason |
|------|--------|
| `app/modal.tsx` | Template route, never navigated to |
| `components/EditScreenInfo.tsx` | Only used by modal.tsx |
| `components/ExternalLink.tsx` | Only used by EditScreenInfo.tsx |
| `components/StyledText.tsx` | Only used by EditScreenInfo.tsx |

**Also update:** Remove `<Stack.Screen name="modal" ... />` from `app/_layout.tsx:77`

### Unused Functions - lib/spotify.ts

| Function | Lines | Notes |
|----------|-------|-------|
| `setVolume()` | 227-245 | Never imported anywhere |
| `getPlaylists()` | 248-260 | Never imported anywhere |
| `playContext()` | 263-287 | Never imported anywhere |
| `checkPremiumStatus()` | 481-484 | Never imported anywhere |
| `transferPlayback()` | 345-361 | Used internally only - remove `export` keyword |

### Unused Functions - lib/strava.ts

| Function | Lines | Notes |
|----------|-------|-------|
| `getStravaAthlete()` | 148-160 | Never imported anywhere |
| `getStravaActivity()` | 185-200 | Never imported anywhere |
| `getStravaActivities()` | 163-182 | Used internally only - remove `export` keyword |

### Unused Functions - lib/supabase.ts

| Function | Lines | Notes |
|----------|-------|-------|
| `getCurrentUser()` | 18-22 | Never imported anywhere |

---

## Duplicate Code to Consolidate

### Formatting Functions

**In `app/(tabs)/run.tsx` (lines 95-120):**
```typescript
formatTime(seconds)
formatDistance(meters)
formatPace(minPerKm)
formatSpeed(kmh)
```

**In `app/(tabs)/history.tsx` (lines 40-56):**
```typescript
formatPace(seconds, meters)  // Different signature
formatDuration(seconds)
```

**Recommendation:** Create `utils/formatters.ts` with unified implementations:
- `formatDuration(seconds, format: 'timer' | 'human')`
- `formatPace(minPerKm)`
- `formatPaceFromTimeDistance(seconds, meters)`
- `formatDistance(meters, decimals?)`
- `formatSpeed(kmh)`

---

## Console Statement Cleanup

**Total: ~148 console statements** with emoji prefixes throughout codebase.

### Files by Console Statement Count

| File | Count | Examples |
|------|-------|----------|
| `hooks/useGPSTracking.ts` | ~49 | GPS tracking debug logs |
| `lib/strava.ts` | ~27 | Token refresh, sync progress |
| `hooks/useStrava.ts` | ~17 | Auth flow debugging |
| `lib/openai-realtime.ts` | ~16 | WebRTC connection logs |
| `hooks/useSpotify.ts` | ~13 | Polling, playback state |
| `app/(tabs)/history.tsx` | ~9 | Activity loading |
| `app/(tabs)/run.tsx` | ~6 | GPS metrics, start/stop |

**Recommendation:** Create `utils/logger.ts` with `__DEV__` guard:
```typescript
export const logger = __DEV__
  ? { log, warn, error, info, debug }
  : { noop, noop, error, noop, noop }  // Keep console.error in prod
```

---

## Dependencies to Review

| Dependency | Status | Recommendation |
|------------|--------|----------------|
| `react-native-reanimated` | Side-effect import only | **Keep** - Required by Expo Router |
| `react-native-worklets` | Not imported | Check if peer dependency, remove if not needed |

---

## iOS Build Instructions

### Prerequisites

1. **Xcode** installed from App Store
2. **Apple ID** configured in Xcode > Settings > Accounts
   - Free account: Apps expire after 7 days
   - Paid ($99/yr): Apps valid 1 year, TestFlight distribution

### Build Commands

```bash
# Clean previous builds
rm -rf ios/build
cd ios && pod deintegrate && pod install && cd ..

# Build and run on connected device
npx expo run:ios --device
```

### Device Setup

1. Connect iPhone via USB
2. Trust computer on device
3. In Xcode: Select Runna target > Signing & Capabilities > Enable "Automatically manage signing" > Select your Team
4. On iPhone: Settings > General > VPN & Device Management > Trust developer certificate

---

## Implementation Order

1. Remove template files (Phase 1.1)
2. Remove unused functions (Phase 1.2-1.4)
3. Create shared formatters (Phase 2)
4. Add logger utility and migrate console statements (Phase 3)
5. Remove unused dependencies (Phase 4)
6. Build for iOS (Phase 5)

**Verify after each phase:** `npm start`, navigate all tabs, `npx tsc --noEmit`
