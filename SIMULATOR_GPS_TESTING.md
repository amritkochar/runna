# iOS Simulator GPS Testing Guide

## Important: Simulator Requires Manual Location Setup

The iOS Simulator **does not have real GPS**. You must manually set a simulated location for GPS tracking to work.

---

## How to Test GPS in Simulator

### Step 1: Start Your App

```bash
npm run ios
```

### Step 2: Open Metro Bundler Console

The Metro bundler console will show detailed GPS logs with emoji prefixes:
- 🚀 Starting GPS tracking
- 📍 Location updates
- ✅ Success messages
- ❌ Error messages

### Step 3: Set Simulator Location

**In the iOS Simulator menu bar:**

1. Click **Features** → **Location**
2. Choose one of these options:

#### Option A: City Run (Recommended for Testing)
- **Features → Location → City Run**
- Simulates a running route through a city
- Updates location automatically
- **Best for testing GPS tracking!**

#### Option B: Custom Location
- **Features → Location → Custom Location**
- Enter latitude and longitude manually
- Example: San Francisco = `37.7749, -122.4194`

#### Option C: Apple Campus
- **Features → Location → Apple**
- Sets location to Apple Park

### Step 4: Grant Permission

When you tap "Start Run", you'll see a permission alert:
- Tap **"Allow While Using App"**

### Step 5: Watch the Console

You should see logs like:

```
🚀 [GPS] ========== STARTING GPS TRACKING ==========
🔧 [GPS] Platform: ios
🔧 [GPS] Is Simulator: true
🔐 [GPS] Requesting location permissions...
📍 [GPS] Location services enabled: true
✅ [GPS] Location permission granted
⚙️ [GPS] Tracking configuration: { accuracy: 6, timeInterval: 1000, distanceInterval: 1 }
✅ [GPS] GPS tracking started successfully!
💡 [GPS] SIMULATOR DETECTED - Set location via: Features → Location → Custom Location (or City Run)

📡 [GPS] Location update received!
📍 [GPS] ========== NEW LOCATION UPDATE ==========
📍 [GPS] Raw location data: { latitude: 37.7749, longitude: -122.4194, ... }
📍 [GPS] Point added to route
📍 [GPS] Total route points: 1
📍 [GPS] Total distance calculated: 0 meters
📍 [GPS] Current speed: 0.00 km/h
📊 [UI] GPS Metrics updated: { distance: '0.000 km', currentSpeed: '0.0 km/h', ... }
```

### Step 6: Simulate Movement

To see distance increase:

**Option 1: Use City Run (Automatic)**
- Features → Location → City Run
- Location updates automatically along a route
- Distance will increment every 1-2 seconds

**Option 2: Change Location Manually**
- Features → Location → Custom Location
- Enter a new lat/lng slightly different
- Distance will calculate between the two points

---

## Debugging Checklist

### ❌ Numbers Stay at 0.00 km

**Check these in order:**

1. **Is simulator location set?**
   ```
   Features → Location → City Run
   ```

2. **Did you grant permission?**
   - Look for "✅ [GPS] Location permission granted" in console
   - If not, reset permissions:
     - Features → Erase All Content and Settings
     - Restart app

3. **Are you getting location updates?**
   - Look for "📡 [GPS] Location update received!" in console
   - If not showing, check simulator location is actually set

4. **Is location changing?**
   - For distance to increase, location must **move**
   - "City Run" simulates movement automatically
   - "Custom Location" is static (no movement = no distance)

### ❌ Permission Denied Error

**Reset simulator permissions:**
```bash
# Close simulator
# Delete and rebuild app
rm -rf ~/Library/Developer/Xcode/DerivedData
npm run ios
```

### ❌ No Console Logs at All

**Check Metro bundler is running:**
```bash
# In the terminal where you ran `npm run ios`
# You should see live logs

# If no logs, enable Remote JS Debugging:
# Shake simulator (⌘ + Ctrl + Z)
# Tap "Debug"
```

---

## Understanding Simulator GPS Behavior

### Differences from Real Device

| Feature | Simulator | Real Device |
|---------|-----------|-------------|
| GPS accuracy | Perfect (no drift) | ±5-10m |
| Location updates | Manual/scripted | Automatic from GPS |
| Speed data | May be 0 or unrealistic | Accurate from GPS |
| Battery drain | None | ~10-15% per hour |
| Initial GPS lock | Instant | 10-60 seconds |

### Simulator-Specific Optimizations

The code automatically detects simulator and:
- Reduces `timeInterval` from 5000ms → 1000ms (updates every 1 second)
- Reduces `distanceInterval` from 10m → 1m (updates every 1 meter)
- Logs reminder to set location

Check console for:
```
💡 [GPS] SIMULATOR DETECTED - Set location via: Features → Location → Custom Location (or City Run)
```

---

## Example Testing Session

```bash
# Terminal 1: Start app
npm run ios

# Wait for app to load...

# In Simulator:
# 1. Features → Location → City Run
# 2. Tap "Start Run" in app
# 3. Grant permission: "Allow While Using App"

# Watch Metro console:
✅ [GPS] GPS tracking started successfully!
📡 [GPS] Location update received!
📍 [GPS] Total distance calculated: 15.234 meters
📊 [UI] GPS Metrics updated: distance: '0.015 km'

# After 10 seconds with City Run:
📍 [GPS] Total distance calculated: 156.789 meters
📊 [UI] GPS Metrics updated: distance: '0.157 km'
```

---

## Console Log Reference

### Log Prefixes

- `🚀` - Starting GPS tracking
- `🛑` - Stopping GPS tracking
- `🔐` - Permission requests
- `📍` - Location updates
- `📡` - Raw location data received
- `📊` - UI metrics updated
- `✅` - Success
- `❌` - Error
- `⚠️` - Warning
- `💡` - Tip/Info
- `🔧` - Configuration
- `🔄` - State change

### What to Look For

**Successful GPS tracking:**
```
🚀 [GPS] ========== STARTING GPS TRACKING ==========
✅ [GPS] Location permission granted
✅ [GPS] GPS tracking started successfully!
📡 [GPS] Location update received!
📍 [GPS] Total route points: 1
📊 [UI] GPS Metrics updated
```

**Problem: No location updates:**
```
✅ [GPS] GPS tracking started successfully!
✅ [GPS] Waiting for location updates...
(nothing after this = no location set in simulator)
```

**Problem: Permission denied:**
```
❌ [GPS] Location permission denied
❌ [GPS] Permission denied, cannot start tracking
```

---

## Simulating Different Running Scenarios

### Slow Jog (~6 km/h)
Use "City Run" - it simulates realistic jogging speed

### Fast Run (~12 km/h)
1. Features → Location → Custom Location
2. Enter starting point
3. Wait 5 seconds
4. Enter point ~17 meters away (12 km/h * 5s = 16.7m)
5. Repeat

### Stationary (GPS drift test)
1. Features → Location → Custom Location
2. Set to fixed location
3. Distance should stay ~0 (minimal drift in simulator)

---

## Real Device Testing

After simulator testing, test on a real device:

```bash
# Build and install on connected iPhone
npx expo run:ios --device

# Or use expo dev client
npx expo start --ios
```

Real device differences:
- GPS takes 10-60s to acquire first position (outdoors)
- Accuracy varies (±5-10m typical)
- GPS drift when stationary (~5-20m per minute)
- Speed data is more realistic
- Location updates based on actual movement

---

## Troubleshooting Commands

### Clear all app data
```bash
# Erase simulator
xcrun simctl erase all

# Rebuild
npm run ios
```

### Check expo-location is installed
```bash
npm list expo-location
# Should show: expo-location@19.0.8
```

### Verify native module is linked
```bash
# Check iOS folder exists
ls ios/

# Check Podfile includes expo-location
grep -i location ios/Podfile || echo "Needs prebuild"
```

### Force rebuild with location module
```bash
npx expo prebuild --clean --platform ios
cd ios && pod install && cd ..
npm run ios
```

---

## Expected Console Output (Full Session)

<details>
<summary>Click to expand full expected console output</summary>

```
▶️ [UI] Starting run...
🔄 [GPS] Run state changed - isRunning: true | isTracking: false
▶️ [GPS] Run started, starting GPS tracking...
🚀 [GPS] ========== STARTING GPS TRACKING ==========
🔧 [GPS] Platform: ios
🔧 [GPS] Is Simulator: true
🔐 [GPS] Requesting permissions...
🔐 [GPS] Requesting location permissions...
📍 [GPS] Location services enabled: true
🔐 [GPS] Permission status: granted | Can ask again: true
✅ [GPS] Location permission granted
🧹 [GPS] Clearing previous route data...
⚙️ [GPS] Tracking configuration: { accuracy: 6, timeInterval: 1000, distanceInterval: 1 }
⏳ [GPS] Starting location watch...
✅ [GPS] GPS tracking started successfully!
✅ [GPS] Subscription created: true
✅ [GPS] Waiting for location updates...
💡 [GPS] SIMULATOR DETECTED - Set location via: Features → Location → Custom Location (or City Run)

📡 [GPS] Location update received!
📍 [GPS] ========== NEW LOCATION UPDATE ==========
📍 [GPS] Raw location data: {
  latitude: 37.33233141,
  longitude: -122.03121860,
  altitude: 0,
  speed: 2.5,
  heading: 90,
  accuracy: 10,
  timestamp: '2026-01-08T15:30:45.123Z'
}
📍 [GPS] Point added to route
📍 [GPS] Total route points: 1
📍 [GPS] Total distance calculated: 0 meters
📍 [GPS] Current speed: 9.00 km/h
📍 [GPS] Current pace: 6.67 min/km
📍 [GPS] Duration: 5 seconds
📍 [GPS] Average speed: 0.00 km/h
📍 [GPS] Average pace: 0.00 min/km
📍 [GPS] Updating metrics in store: {
  distance: '0.000 km',
  currentSpeed: '9.0 km/h',
  currentPace: '6.67 min/km',
  avgSpeed: '0.0 km/h',
  avgPace: 'N/A'
}
📍 [GPS] Run stats updated
✅ [GPS] Update complete - Distance: 0.000 km
📍 [GPS] ========================================
📊 [UI] GPS Metrics updated: {
  distance: '0.000 km',
  currentSpeed: '9.0 km/h',
  currentPace: '6.67 min/km',
  avgSpeed: '0.0 km/h',
  avgPace: '0.00 min/km',
  hasLocation: true
}

... (subsequent updates every 1 second with increasing distance)

📡 [GPS] Location update received!
📍 [GPS] ========== NEW LOCATION UPDATE ==========
📍 [GPS] Total route points: 15
📍 [GPS] Total distance calculated: 234.567 meters
✅ [GPS] Update complete - Distance: 0.235 km
```

</details>

---

## Next Steps

Once simulator testing works:
1. Test on real iPhone (outdoors for best GPS)
2. Test different scenarios (walking, running, stationary)
3. Test permission denial and re-granting
4. Test long runs (30+ minutes)
5. Check battery usage on device

---

**Document Version**: 1.0
**Last Updated**: January 8, 2026
