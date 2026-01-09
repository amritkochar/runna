# GPS Tracking Implementation Guide

## Overview

This document provides technical details about the GPS tracking implementation for the Runna iOS app. The implementation uses `expo-location` (v19.0.8) to provide production-ready GPS tracking with real-time distance, pace, and speed calculations.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Technical Implementation](#technical-implementation)
3. [GPS Accuracy & Calculations](#gps-accuracy--calculations)
4. [State Management](#state-management)
5. [Permission Handling](#permission-handling)
6. [Battery Optimization](#battery-optimization)
7. [Error Handling](#error-handling)
8. [Testing Guide](#testing-guide)
9. [Caveats & Limitations](#caveats--limitations)
10. [Future Enhancements](#future-enhancements)
11. [Troubleshooting](#troubleshooting)

---

## Architecture

### Component Hierarchy

```
run.tsx (UI Layer)
    ↓
useGPSTracking() (Business Logic)
    ↓
expo-location (Native GPS API)
    ↓
useRunStore (State Management)
```

### Data Flow

```
GPS Location Update
    ↓
LocationPoint created with lat/lng/altitude/speed
    ↓
Added to routePoints array in store
    ↓
Distance calculated using Haversine formula
    ↓
Pace & Speed derived from GPS speed data
    ↓
GPSMetrics updated in store
    ↓
UI re-renders with new metrics
```

---

## Technical Implementation

### Core Hook: `useGPSTracking.ts`

The GPS tracking is encapsulated in a custom React hook that:
- Manages location permissions
- Starts/stops GPS tracking automatically based on run state
- Calculates metrics from raw GPS data
- Handles all error scenarios
- Performs cleanup on unmount

**Key Features:**
- **Auto-start/stop**: Watches `isRunning` state and manages tracking lifecycle
- **Permission flow**: Requests permissions, checks services, handles denials
- **Real-time metrics**: Calculates distance, pace, speed on every GPS update
- **Error recovery**: Handles all error types with user-friendly messages
- **Memory safe**: Proper cleanup of subscriptions and refs

### Location Tracking Configuration

```typescript
{
  accuracy: Location.Accuracy.BestForNavigation,  // Level 6 accuracy
  timeInterval: 5000,    // Update every 5 seconds minimum
  distanceInterval: 10,  // Update if moved 10 meters minimum
}
```

**Why these settings?**

| Setting | Value | Reason |
|---------|-------|--------|
| `BestForNavigation` | Level 6 | Highest accuracy for fitness tracking, uses GPS + sensors |
| `timeInterval: 5000ms` | 5 seconds | Balances battery life with data granularity |
| `distanceInterval: 10m` | 10 meters | Prevents GPS drift, only updates on actual movement |

**How it works:**
- GPS updates when **EITHER** 5 seconds pass **OR** user moves 10 meters
- This prevents rapid updates when stationary (battery saving)
- Ensures updates even if moving slowly (time-based fallback)

---

## GPS Accuracy & Calculations

### Haversine Formula for Distance

The distance between GPS points is calculated using the **Haversine formula**, which accounts for Earth's curvature:

```typescript
const calculateDistance = (p1: LocationPoint, p2: LocationPoint): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (p1.latitude * Math.PI) / 180;
  const φ2 = (p2.latitude * Math.PI) / 180;
  const Δφ = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const Δλ = ((p2.longitude - p1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};
```

**Why Haversine?**
- Standard formula for calculating great-circle distance
- Accurate to within 0.5% for distances up to a few hundred kilometers
- Accounts for Earth's spherical shape (unlike simple Euclidean distance)
- Industry standard for fitness apps

**Expected Accuracy:**
- iOS GPS accuracy: ±5-10 meters in ideal conditions
- Distance accuracy: ±0.5-1% over a typical 5km run
- Accuracy degrades in urban canyons, dense forests, tunnels

### Pace & Speed Calculations

**Current Speed:**
```typescript
const currentSpeedMps = location.coords.speed || 0;  // From GPS (m/s)
const currentSpeedKmh = currentSpeedMps * 3.6;       // Convert to km/h
```

**Current Pace:**
```typescript
const calculatePace = (speedMps: number): number => {
  if (speedMps <= 0) return 0;
  const speedKmh = speedMps * 3.6;
  const paceMinPerKm = 60 / speedKmh;  // Inverse of speed
  return paceMinPerKm;
};
```

**Average Metrics:**
```typescript
const avgSpeedMps = totalDistance / totalDuration;  // meters / seconds
const avgSpeedKmh = avgSpeedMps * 3.6;              // km/h
const avgPace = 60 / avgSpeedKmh;                   // min/km
```

**Important Notes:**
- **Current speed** comes directly from GPS hardware (Doppler shift calculation)
- **Average speed** is calculated from total distance / total time
- Pace is the **inverse of speed** (slow speed = high pace number)
- GPS speed is more accurate than calculating speed from position changes

---

## State Management

### Zustand Store Schema

```typescript
interface RunState {
  // GPS tracking state
  gpsMetrics: GPSMetrics;              // Current metrics
  routePoints: LocationPoint[];        // All GPS points for route
  locationPermission: LocationPermissionStatus;
  gpsError: string | null;

  // GPS actions
  setGPSMetrics: (metrics: GPSMetrics) => void;
  addRoutePoint: (point: LocationPoint) => void;
  setLocationPermission: (status: LocationPermissionStatus) => void;
  setGPSError: (error: string | null) => void;
  clearRoute: () => void;
}
```

### Type Definitions

**LocationPoint** - Raw GPS data:
```typescript
interface LocationPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;      // Elevation in meters
  speed: number | null;         // Speed in m/s from GPS
  heading: number | null;       // Direction in degrees (0-360)
  accuracy: number | null;      // Accuracy radius in meters
  timestamp: number;            // Unix timestamp in milliseconds
}
```

**GPSMetrics** - Calculated metrics:
```typescript
interface GPSMetrics {
  currentSpeed: number;         // km/h - from GPS speed
  currentPace: number;          // min/km - calculated from speed
  averageSpeed: number;         // km/h - total distance / total time
  averagePace: number;          // min/km - inverse of avg speed
  totalDistance: number;        // meters - sum of all segment distances
  currentLocation: LocationPoint | null;
}
```

### Data Persistence

**Currently:**
- GPS data lives in Zustand store (in-memory only)
- Data is lost when app restarts
- `routePoints` array can grow large for long runs

**Future Considerations:**
- Persist route points to Supabase for history
- Compress route data (every Nth point, or Douglas-Peucker algorithm)
- Store in local SQLite/AsyncStorage for offline capability

---

## Permission Handling

### iOS Permission Flow

```
App Launch
    ↓
User starts run
    ↓
Check if location services enabled
    ↓ YES                        ↓ NO
Request permission          Show "Enable Location Services" alert
    ↓
User grants?
    ↓ YES                        ↓ NO
Start tracking              Show "Open Settings" alert with deep link
```

### Permission Configuration

**app.json:**
```json
{
  "ios": {
    "infoPlist": {
      "NSLocationWhenInUseUsageDescription": "Runna needs your location to track distance, pace, and route during your runs."
    }
  },
  "plugins": [
    [
      "expo-location",
      {
        "locationWhenInUsePermission": "Runna needs your location to track distance, pace, and route during your runs."
      }
    ]
  ]
}
```

**Why "When In Use" only?**
- Simpler permission request (no background location needed for MVP)
- Better battery life
- Less intrusive to users
- Avoids App Store scrutiny of background location

**When to request background permissions:**
- When implementing auto-pause detection
- For continued tracking when user switches apps
- Required permission string: `NSLocationAlwaysAndWhenInUseUsageDescription`

### Permission States

```typescript
type LocationPermissionStatus = 'granted' | 'denied' | 'undetermined';
```

- **undetermined**: User hasn't been asked yet (initial state)
- **granted**: User approved location access
- **denied**: User rejected permission (or revoked in Settings)

**Handling "denied" state:**
1. Check if we can ask again: `canAskAgain` from permission response
2. If false: User selected "Don't Ask Again" → Show Settings deep-link
3. Deep-link: `Linking.openURL('app-settings:')` (iOS only)

---

## Battery Optimization

### Power Consumption Factors

**GPS accuracy levels (from lowest to highest power):**
```typescript
Location.Accuracy.Lowest         // ~3000m accuracy, minimal power
Location.Accuracy.Low            // ~1000m accuracy, low power
Location.Accuracy.Balanced       // ~100m accuracy, moderate power
Location.Accuracy.High           // ~10m accuracy, high power
Location.Accuracy.Highest        // Best possible, very high power
Location.Accuracy.BestForNavigation  // Same as Highest + sensors
```

**Our choice:** `BestForNavigation`
- **Reason:** Fitness tracking requires high accuracy
- **Trade-off:** Higher battery drain, but necessary for accurate distance
- **Alternative for battery-conscious users:** `Accuracy.High` (90% as accurate, 30% less power)

### Battery Optimization Techniques Implemented

1. **Distance-based updates**: Only update when moved 10m (prevents GPS drift processing)
2. **Foreground-only tracking**: No background location (major battery saver)
3. **Proper cleanup**: Stop tracking immediately when run ends
4. **No continuous polling**: Event-based updates only (not constant polling)

### Expected Battery Usage

| Scenario | Battery per Hour | Notes |
|----------|------------------|-------|
| GPS tracking (foreground) | 10-15% | With BestForNavigation accuracy |
| GPS tracking (background) | 20-30% | Not implemented (would drain faster) |
| With music + voice AI | 15-20% | Combined with Spotify + OpenAI |

**Battery Saving Tips for Users:**
- Close other apps before running
- Reduce screen brightness
- Use Low Power Mode (iOS still allows GPS)
- Avoid using 4G/5G if possible (download music beforehand)

---

## Error Handling

### Error Types

```typescript
type LocationErrorType =
  | 'PERMISSION_DENIED'        // User denied location permission
  | 'SERVICES_DISABLED'        // Location services off in Settings
  | 'PROVIDER_UNAVAILABLE'     // GPS hardware unavailable/error
  | 'TIMEOUT'                  // Taking too long to get location
  | 'UNKNOWN';                 // Unexpected error
```

### Error Detection Logic

```typescript
const handleLocationError = (error: any): LocationErrorType => {
  const message = error.message?.toLowerCase() || '';

  if (message.includes('permission')) return 'PERMISSION_DENIED';
  if (message.includes('provider') || message.includes('unavailable'))
    return 'PROVIDER_UNAVAILABLE';
  if (message.includes('timeout')) return 'TIMEOUT';
  if (message.includes('services') || message.includes('disabled'))
    return 'SERVICES_DISABLED';

  return 'UNKNOWN';
};
```

### User-Facing Error Messages

Each error type shows a specific alert with actionable guidance:

**SERVICES_DISABLED:**
```
Title: "Location Services Disabled"
Message: "Please enable location services in your device settings to track your runs."
Actions: [OK]
```

**PERMISSION_DENIED:**
```
Title: "Location Permission Required"
Message: "Runna needs location access to track your runs. Please enable it in Settings."
Actions: [Cancel] [Open Settings]
→ Deep-link to iOS Settings app
```

**PROVIDER_UNAVAILABLE:**
```
Title: "Location Unavailable"
Message: "Unable to determine your location. Make sure location services are enabled and try again."
Actions: [OK]
```

### Error Recovery Strategies

1. **Retry on timeout**: Location.getCurrentPositionAsync() can timeout in poor GPS conditions
2. **Graceful degradation**: If GPS unavailable, still allow run (time-only tracking)
3. **User guidance**: Clear instructions on how to fix each error type
4. **State preservation**: Don't lose run data if GPS fails mid-run

---

## Testing Guide

### Testing on iOS Simulator

**Simulated locations:**
1. Open Xcode → Debug menu → Location
2. Select pre-defined routes:
   - **City Run**: Simulates urban running with turns
   - **City Bicycle Ride**: Faster pace simulation
   - **Freeway Drive**: Very fast (not realistic for running)
   - **Custom Location**: Set fixed lat/lng

**Limitations:**
- Simulator GPS is perfect (no drift, no accuracy issues)
- Speed values may be unrealistic
- Can't test permission prompts accurately
- No altitude/heading data

### Testing on Real Device

**Requirements:**
1. Physical iPhone with GPS capability
2. Developer build installed via Xcode or Expo Dev Client
3. Outdoor location with clear sky view

**Test scenarios:**

**Basic functionality:**
- [ ] Grant location permission on first run
- [ ] Deny permission → See error alert with Settings link
- [ ] Start run → GPS tracking begins automatically
- [ ] Walk/run 100m → Distance updates
- [ ] Check pace calculation (should be ~15-20 min/km for walking)
- [ ] Stop run → GPS tracking stops

**Edge cases:**
- [ ] Start run indoors → GPS may take 30-60s to acquire
- [ ] Run under heavy tree cover → Accuracy degrades
- [ ] Run through tunnel → GPS lost, then reacquired
- [ ] Enable Airplane Mode → Should show "Provider Unavailable"
- [ ] Revoke permission mid-run → Should show error alert
- [ ] Switch to another app → GPS continues (foreground only)
- [ ] Lock phone during run → GPS continues if app in foreground

**Accuracy validation:**
1. Run a known distance (e.g., 400m track)
2. Compare app distance with actual distance
3. Expected variance: ±5-10 meters (1-2.5%)

### Debugging GPS Issues

**Check GPS signal quality:**
```typescript
console.log('GPS Accuracy:', location.coords.accuracy, 'meters');
// < 10m: Excellent
// 10-20m: Good
// 20-50m: Fair
// > 50m: Poor (too inaccurate for running)
```

**Monitor update frequency:**
```typescript
const lastUpdate = useRef(Date.now());

// In location update handler:
const timeSinceLastUpdate = Date.now() - lastUpdate.current;
console.log('Update interval:', timeSinceLastUpdate, 'ms');
lastUpdate.current = Date.now();
```

**Expected update intervals:**
- Stationary: ~5000ms (time-based only)
- Walking slowly: ~5000-10000ms
- Running: ~1000-3000ms (frequent distance-based updates)

---

## Caveats & Limitations

### Known Issues

1. **Initial GPS Lock Time**
   - **Issue**: First GPS position can take 10-60 seconds to acquire
   - **Impact**: Distance = 0 for first minute of run
   - **Cause**: GPS receiver needs to download satellite almanac data
   - **Workaround**: Future feature - "Searching for GPS..." message while waiting
   - **Best practice**: Start run outdoors, wait for GPS lock before moving

2. **GPS Drift When Stationary**
   - **Issue**: Distance increases slightly even when not moving
   - **Impact**: ~5-20m of phantom distance per minute when stationary
   - **Cause**: GPS accuracy ±5-10m, position "drifts" within error circle
   - **Mitigation**: `distanceInterval: 10` helps filter small movements
   - **Future fix**: Auto-pause detection (if speed < 0.5 m/s for 30s, pause)

3. **Urban Canyon Effect**
   - **Issue**: Poor GPS accuracy between tall buildings
   - **Impact**: Distance can be overestimated by 10-30%
   - **Cause**: GPS signals bounce off buildings (multipath error)
   - **No fix**: Inherent limitation of GPS technology
   - **Alternative**: Future - use accelerometer data to smooth GPS jumps

4. **No Background Tracking**
   - **Issue**: If user switches apps, GPS tracking continues but app may be suspended
   - **Impact**: May lose GPS data if iOS suspends app
   - **Current**: Foreground-only permission
   - **Future**: Implement background location + TaskManager for continuous tracking

5. **Battery Drain**
   - **Issue**: High accuracy GPS drains battery quickly
   - **Impact**: ~10-15% battery per hour of running
   - **Mitigation**: Already optimized with distance intervals
   - **Future**: Adaptive accuracy (reduce accuracy when battery low)

6. **Pace Accuracy at Low Speeds**
   - **Issue**: Pace becomes erratic when running very slowly or walking
   - **Impact**: Pace jumps around wildly (e.g., 8:00 → 15:00 → 6:00 min/km)
   - **Cause**: GPS speed accuracy is ±0.5 m/s, which is significant at low speeds
   - **Fix**: Implement moving average filter for pace display

7. **Route Point Memory Usage**
   - **Issue**: `routePoints` array grows linearly with run duration
   - **Impact**: ~1 point per 5-10 seconds = ~360-720 points per hour
   - **Memory**: ~50-100 KB per hour (negligible for modern phones)
   - **Future concern**: 4+ hour ultra-marathons could accumulate 2000+ points
   - **Future fix**: Compress route using Douglas-Peucker algorithm, or persist to DB

### Platform-Specific Limitations

**iOS:**
- ✅ Excellent GPS accuracy with BestForNavigation
- ✅ Native permissions UI
- ⚠️ Background tracking requires extra permissions + justification for App Store
- ⚠️ iOS may throttle GPS in Low Power Mode (reduced accuracy)

**Android (not implemented):**
- Would need `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` permissions
- Background tracking requires `ACCESS_BACKGROUND_LOCATION` (Android 10+)
- More variation in GPS chip quality across devices

**Web (intentionally skipped):**
- HTML5 Geolocation API has poor accuracy (10-50m typical)
- No background tracking (stops when tab loses focus)
- Requires HTTPS
- Battery drain is severe
- Not suitable for production fitness tracking

---

## Future Enhancements

### Short-term Improvements

1. **GPS Signal Indicator**
   - Show GPS accuracy in UI (Good/Fair/Poor)
   - Display "Searching for GPS..." during initial lock
   - Icon color: Green (< 10m), Yellow (10-20m), Red (> 20m)

2. **Auto-Pause Detection**
   - Pause run if speed < 0.5 m/s for 30 seconds
   - Resume when speed > 1 m/s
   - Useful for traffic lights, water breaks

3. **Pace Smoothing**
   - Implement moving average filter (last 30 seconds of pace data)
   - Reduces erratic pace display
   - Formula: `smoothedPace = avg(last_6_pace_values)`

4. **Route Persistence**
   - Save `routePoints` to Supabase `activities` table
   - Store as GeoJSON or compressed polyline
   - Enable post-run route viewing

### Medium-term Features

5. **Map View**
   - Display route on map during/after run
   - Use `react-native-maps` or `expo-maps`
   - Show current location marker
   - Overlay route polyline

6. **Elevation Tracking**
   - Calculate elevation gain from `altitude` field
   - Display total elevation gain in UI
   - Chart elevation profile post-run

7. **Split Times**
   - Track time for each kilometer/mile
   - Show pace per split
   - Identify fastest/slowest splits

8. **Background Location Tracking**
   - Request `NSLocationAlwaysAndWhenInUseUsageDescription` permission
   - Use `Location.startLocationUpdatesAsync()` with TaskManager
   - Continue tracking when app is backgrounded/locked
   - **Important**: Requires App Store justification

### Long-term Ideas

9. **GPS Accuracy Improvements**
   - Kalman filter for smoothing GPS coordinates
   - Sensor fusion (GPS + accelerometer + gyroscope)
   - Map matching (snap route to known roads/paths)

10. **Offline Route Caching**
    - Download map tiles before run
    - Store in AsyncStorage
    - Enable map view without internet

11. **Live Activity Widget (iOS 16+)**
    - Show current distance/pace on lock screen
    - Update in real-time via Live Activities API
    - Dynamic Island support for iPhone 14 Pro+

12. **Export to TCX/GPX**
    - Export route to standard GPS formats
    - Enable import into other apps (Strava, Garmin Connect)
    - Share route file via email/cloud

---

## Troubleshooting

### Common Issues

**Problem: Distance stays at 0.00 km**

Possible causes:
1. GPS hasn't acquired satellite lock yet
   - **Fix**: Wait 30-60 seconds outdoors with clear sky view
2. Permission denied
   - **Fix**: Check error alert, open Settings to grant permission
3. Location services disabled
   - **Fix**: Go to Settings → Privacy → Location Services → Enable
4. Poor GPS signal (indoors, underground)
   - **Fix**: Move outdoors

**Problem: Pace shows "--:--"**

Cause: Speed is 0 or invalid
- **Fix**: Start moving, pace will appear when speed > 0
- This is expected when stationary

**Problem: Distance increases when standing still**

Cause: GPS drift (accuracy ±5-10m)
- **Expected**: Up to ~20m of drift per minute
- **Mitigation**: Already using `distanceInterval: 10` to reduce this
- **Future fix**: Auto-pause when stationary

**Problem: Pace jumps around wildly**

Cause: GPS speed accuracy is ±0.5 m/s
- **Impact**: More noticeable at slow speeds (walking)
- **Future fix**: Implement moving average filter

**Problem: Battery drains quickly**

Causes:
1. `BestForNavigation` accuracy uses maximum power
   - **Fix**: Consider reducing to `Accuracy.High` for longer runs
2. Multiple apps using GPS
   - **Fix**: Close other apps before running
3. Old battery health
   - **Fix**: Check battery health in Settings

**Problem: App crashes when starting run**

Check console for errors:
1. Permission issues
2. `expo-location` not installed correctly
3. TypeScript errors

**Debug steps:**
```bash
# Reinstall dependencies
rm -rf node_modules
npm install

# Clear Metro cache
npx expo start --clear

# Rebuild iOS app
npm run ios
```

### Debug Logging

Add this to `useGPSTracking.ts` for detailed GPS logs:

```typescript
const handleLocationUpdate = (location: Location.LocationObject) => {
  console.log('=== GPS UPDATE ===');
  console.log('Lat/Lng:', location.coords.latitude.toFixed(6), location.coords.longitude.toFixed(6));
  console.log('Accuracy:', location.coords.accuracy, 'm');
  console.log('Speed:', location.coords.speed, 'm/s');
  console.log('Altitude:', location.coords.altitude, 'm');
  console.log('Heading:', location.coords.heading, '°');
  console.log('Timestamp:', new Date(location.timestamp).toISOString());
  console.log('==================');

  // ... rest of handler
};
```

---

## Performance Considerations

### Memory Usage

**Per GPS point**: ~100 bytes
- `latitude`: 8 bytes (float64)
- `longitude`: 8 bytes (float64)
- `altitude`: 8 bytes (float64 or null)
- `speed`: 8 bytes (float64 or null)
- `heading`: 8 bytes (float64 or null)
- `accuracy`: 8 bytes (float64 or null)
- `timestamp`: 8 bytes (int64)
- Object overhead: ~50 bytes

**Per hour of running**:
- Update frequency: ~1 per 5-10 seconds
- Points per hour: ~360-720
- Memory: ~36-72 KB per hour

**Implication**: Even a 4-hour marathon uses < 300 KB for route data (negligible)

### Rendering Performance

**UI updates**: Metrics update every GPS update (5-10 seconds)
- Very low performance impact
- React re-renders only changed components
- No expensive re-renders

**Future concern**: Map view rendering
- Rendering 1000+ route points on map can be slow
- Solution: Use polyline clustering or simplification

---

## Code Quality Notes

### Why useRef instead of useState?

```typescript
const subscriptionRef = useRef<LocationSubscription | null>(null);
const isTrackingRef = useRef(false);
```

**Reason**: These values don't need to trigger re-renders
- `subscriptionRef`: Cleanup reference only
- `isTrackingRef`: Guard against double-start

**Alternative**: Could use `useState`, but unnecessary re-renders

### Why useCallback for functions?

```typescript
const calculateDistance = useCallback((p1, p2) => { ... }, []);
```

**Reason**: Prevent function recreation on every render
- Passed to other hooks/components
- Dependencies are stable (none)

**Impact**: Minor performance optimization, but good practice

### Why check `isFinite()` for pace?

```typescript
if (minPerKm === 0 || !isFinite(minPerKm)) return '--:--';
```

**Reason**: Pace is calculated as `60 / speed`
- If speed = 0, pace = Infinity
- `!isFinite()` catches NaN and Infinity
- Prevents displaying "Infinity:NaN" in UI

---

## Learning Resources

### GPS & Geolocation
- [How GPS Works](https://www.gps.gov/systems/gps/performance/accuracy/)
- [Haversine Formula Explanation](https://www.movable-type.co.uk/scripts/latlong.html)
- [GPS Accuracy Factors](https://www.gps.gov/systems/gps/performance/accuracy/)

### Expo Location API
- [Official Expo Location Docs](https://docs.expo.dev/versions/latest/sdk/location/)
- [Location Permissions Best Practices](https://docs.expo.dev/guides/permissions/)

### iOS Location Services
- [Apple Location Services Programming Guide](https://developer.apple.com/documentation/corelocation)
- [App Store Guidelines for Location](https://developer.apple.com/app-store/review/guidelines/#location-services)

### Fitness Tracking Algorithms
- [Douglas-Peucker Algorithm](https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm) (route simplification)
- [Kalman Filtering for GPS](https://www.bzarg.com/p/how-a-kalman-filter-works-in-pictures/) (smoothing)

---

## Changelog

### v1.0.0 (2026-01-08)
- ✅ Initial GPS tracking implementation
- ✅ Real-time distance, pace, speed calculation
- ✅ iOS foreground location permissions
- ✅ Production-ready error handling
- ✅ Battery-optimized configuration
- ✅ Zustand state management integration
- ✅ UI metrics display with formatting

---

## Appendix

### Coordinate Systems

**WGS 84 (World Geodetic System 1984)**
- Standard coordinate system used by GPS
- Latitude: -90° to +90° (South to North)
- Longitude: -180° to +180° (West to East)
- Example: Apple Park = 37.334900°, -122.009020°

### Distance Units Conversion

```typescript
// Meters to Kilometers
const km = meters / 1000;

// Meters to Miles
const miles = meters / 1609.34;

// m/s to km/h
const kmh = mps * 3.6;

// m/s to mph
const mph = mps * 2.23694;

// km/h to pace (min/km)
const minPerKm = 60 / kmh;

// mph to pace (min/mile)
const minPerMile = 60 / mph;
```

### Typical Running Metrics

| Pace (min/km) | Speed (km/h) | Description |
|---------------|--------------|-------------|
| 7:00 | 8.57 | Elite marathon pace |
| 6:00 | 10.00 | Fast recreational runner |
| 5:30 | 10.91 | Very fast |
| 5:00 | 12.00 | Competitive 5K pace |
| 8:00 | 7.50 | Casual jogger |
| 10:00 | 6.00 | Slow jog |
| 15:00 | 4.00 | Fast walk |

---

**Document Version**: 1.0
**Last Updated**: January 8, 2026
**Author**: Claude (AI Assistant)
**Maintainer**: Amrit Kochar
