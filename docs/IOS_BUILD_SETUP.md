# iOS Build Setup Plan for Runna

## Current State Summary

**What's Working:**
- ✅ GPS tracking with real-time metrics (merged PR #1)
- ✅ Strava sync with auto-loading activities
- ✅ Spotify integration with native SDK
- ✅ Voice AI companion via OpenAI Realtime API (WebRTC)
- ✅ Comprehensive error handling and documentation
- ✅ All permissions configured in app.json

**Build Configuration Status:**
- ❌ No `eas.json` - Cannot create builds for physical devices
- ❌ EAS project ID placeholder in app.json (`"your-project-id"`)
- ✅ Bundle ID configured: `com.runna.app`
- ✅ Team ID configured: `BWVB392PLS`
- ✅ Native modules configured via config plugins
- ✅ Custom WebRTC patch exists in `/patches/` directory
- ✅ Environment variables in `.env` file

## Goal

Create an installable iOS build that you can test on your iPhone with full functionality:
- GPS tracking during runs
- Strava OAuth and activity sync
- Spotify music control
- Voice AI companion
- All real device permissions (location, microphone)

## Implementation Strategy

### Build Approach: Development Build with Local Xcode

**Why Development Build:**
1. **Fast iteration**: Native code compiled once, JS updates via Metro (2 seconds vs 20 minutes)
2. **Full native module support**: WebRTC, Spotify SDK, GPS tracking all work correctly
3. **Debug capabilities**: Dev tools, console logs, error reporting
4. **Perfect for testing**: OAuth flows, permissions, voice AI, music integration

**Build Method: Local Xcode Build**
- **Fast**: 5 min first build, 2-3 min subsequent builds
- **No limits**: Unlimited builds without using EAS build minutes
- **Direct debugging**: Full Xcode debugging capabilities
- **Immediate iteration**: Build, test, repeat quickly

**Selected Approach**: Local build using Xcode for fastest development workflow.

## Step-by-Step Implementation

### Phase 1: Prepare iOS Project

#### 1.1 Connect iPhone to Mac
```bash
# Connect via USB or WiFi
# Ensure iPhone is trusted (unlock and tap "Trust This Computer")
```

#### 1.2 Verify .env File Exists
The file `/Users/musafiramrit/Desktop/projects/runna/.env` already exists with all required variables ✓

### Phase 2: Generate and Configure iOS Project

#### 2.1 Generate iOS Native Project
```bash
# From project root
npx expo prebuild --platform ios --clean
```

**What this does:**
- Creates `/ios` directory with native Xcode project
- Applies all config plugins from app.json:
  - expo-location (GPS tracking)
  - expo-spotify-sdk (music control)
  - react-native-webrtc (voice AI)
  - expo-router (navigation)
- Configures Info.plist with permissions
- Sets up URL schemes for OAuth redirects
- Links all native modules

#### 2.2 Install CocoaPods Dependencies
```bash
cd ios
pod install
cd ..
```

**What this does:**
- Installs all native iOS dependencies
- Links React Native pods
- Configures Xcode workspace
- Sets up Hermes JS engine
- Applies New Architecture (Fabric) settings

**Expected output**: "Pod installation complete! There are X dependencies from the Podfile..."

### Phase 3: Build and Install on iPhone

#### 3.0 Prepare iPhone for Development

**Step 1: Enable Developer Mode (iOS 16+ only)**

If you haven't already:
1. On your iPhone, go to **Settings → Privacy & Security → Developer Mode**
2. Toggle **Developer Mode** to ON
3. Enter your passcode when prompted
4. Tap **Restart** to restart your iPhone
5. After restart, tap **Turn On** when prompted again

**Step 2: Prepare Device in Xcode (CRITICAL - First Time Setup)**

Even with Developer Mode enabled, Xcode needs to prepare your device on first connection. This step is **required** and can take 5-10 minutes.

1. **Connect iPhone** via USB (keep unlocked)
2. **Open Xcode**: Run `open ios/Runna.xcworkspace`
3. **Open Devices window**: Window → Devices and Simulators (⇧⌘2)
4. **Select your iPhone** in the left sidebar (should show "Musafir Amrit")
5. **Wait for preparation**: You'll see:
   - "Preparing Musafir Amrit for development..."
   - "Processing symbol files..."
   - "Fetching debug symbols for..."
   - This takes 5-10 minutes on first connection
6. **Verify ready**: Device should show as "Ready" with a green dot

**Why this is necessary:**
- Xcode downloads device support files for iOS 18.6.2
- Xcode downloads and processes symbol files for debugging
- Device trust and pairing is fully established
- Without this, xcodebuild will timeout with "developer disk image" error

**Verification:**
- Device shows "Ready" with green dot in Xcode Devices window
- Run `xcrun devicectl list devices` - should show "available (paired)"
- Run `xcrun xctrace list devices` - should show your device without "Offline"

#### 3.1 Build with Expo CLI
```bash
# Build and install on connected iPhone
npx expo run:ios --device

# If you have multiple devices, specify by name:
npx expo run:ios --device "Musafir Amrit"
```

**What happens:**
1. Detects connected iPhone (Musafir Amrit - iPhone 15 Pro Max)
2. Runs Xcode build process
3. Applies WebRTC patch via `postinstall` script
4. Compiles native code (~5 minutes first time)
5. Uses automatic code signing (Team ID: BWVB392PLS)
6. Installs app directly to iPhone
7. Launches the app

**Expected time:**
- First build: 5-7 minutes
- Subsequent builds: 2-3 minutes

**Common Issues:**

**Issue: "developer disk image could not be mounted"**
- **Cause**: Developer Mode not enabled on iPhone
- **Fix**: Follow step 3.0 above to enable Developer Mode and restart iPhone

**Issue: Code signing error**
```bash
open ios/Runna.xcworkspace
# In Xcode: Select Runna target → Signing & Capabilities → Enable "Automatically manage signing"
```

**Issue: Device locked during build**
- Keep your iPhone unlocked during the entire build process
- The screen can dim but shouldn't lock completely

#### 3.2 Start Metro Bundler
```bash
# In a separate terminal
npx expo start --dev-client
```

**What this provides:**
- Metro bundler for JS code
- Hot module reloading
- Dev tools access
- Fast refresh on code changes

The app on your iPhone will automatically connect to Metro and load the latest JS code.

### Phase 4: Verification and Testing

See "Testing & Verification" section below for comprehensive testing checklist.

## Critical Files

### Files to Generate (Automatic):
1. **`/Users/musafiramrit/Desktop/projects/runna/ios/`** - Generated by `expo prebuild` (gitignored)

### Files to Verify (Already Correct):
2. **`/Users/musafiramrit/Desktop/projects/runna/package.json`** - Has `postinstall` script ✓
3. **`/Users/musafiramrit/Desktop/projects/runna/patches/react-native-webrtc+124.0.7.patch`** - Exists and committed ✓
4. **`/Users/musafiramrit/Desktop/projects/runna/.env`** - Has all environment variables ✓
5. **`/Users/musafiramrit/Desktop/projects/runna/app.json`** - Has all config plugins and permissions ✓

## Testing & Verification

### Essential Tests After Installation

**1. OAuth Flows:**
```
□ Login with Strava → Verify redirect works (runna://strava-callback)
□ Connect Spotify → Verify native SDK auth flow (runna://callback)
□ Check activities load from Strava
□ Test Spotify playback controls
```

**2. Native Permissions:**
```
□ Start a run → Location permission prompt appears
□ Grant location → GPS tracking works, distance updates
□ Start voice companion → Microphone permission prompt
□ Grant microphone → Voice AI connects via WebRTC
□ Test voice commands → AI responds
```

**3. Core Features:**
```
□ GPS tracking: Real-time distance, pace, speed calculations
□ Strava sync: Activities load automatically on app start
□ Spotify control: Play/pause, skip, volume (requires Premium)
□ Voice AI: Low-latency conversation, music control via voice
□ Background audio: Voice companion works with screen off
```

### Troubleshooting

**Issue: "developer disk image could not be mounted on this device"**
```
Error: The developer disk image could not be mounted on this device.
xcodebuild: error: Timed out waiting for all destinations
{ platform:iOS, arch:arm64, id:..., name:Musafir Amrit, error:The developer disk image could not be mounted }
```

**Root Cause**: Xcode hasn't finished preparing your device for development yet.

**Solution (Two-step process)**:

**Step 1**: Ensure Developer Mode is enabled (iOS 16+ only)
- On iPhone: **Settings → Privacy & Security → Developer Mode** → Toggle ON
- Restart iPhone when prompted
- Tap "Turn On" after restart

**Step 2**: **Prepare device in Xcode (This fixes the error)**
1. Keep iPhone **unlocked** and connected via USB
2. Open Xcode: `open ios/Runna.xcworkspace`
3. Open Devices: **Window → Devices and Simulators** (⇧⌘2)
4. Select your iPhone ("Musafir Amrit") in left sidebar
5. **Wait 5-10 minutes** while Xcode:
   - Shows "Preparing device for development..."
   - Downloads iOS 18.6.2 support files
   - Processes symbol files
6. Wait until device shows **"Ready"** with green dot
7. Close Xcode
8. Retry: `npx expo run:ios --device`

**Why this happens**:
- On first connection, Xcode needs to download device support files for your iOS version (18.6.2)
- The `expo run:ios` command uses xcodebuild, which can't do this preparation automatically
- You must let Xcode's GUI prepare the device first, then command-line builds work

**Verification**:
- ✅ Xcode Devices window shows "Ready" with green dot
- ✅ `xcrun xctrace list devices | grep Musafir` shows device (not "Offline")
- ✅ iPhone remains unlocked during build

**Issue: "Cannot connect to Metro"**
```bash
# Get your Mac's local IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# In app dev menu, enter URL manually
# exp://YOUR_MAC_IP:8081
```

**Issue: OAuth redirects fail**
- Verify Strava redirect URI includes: `runna://strava-callback`
- Verify Spotify redirect URI includes: `runna://callback`
- Check these in developer dashboards:
  - Strava: https://www.strava.com/settings/api
  - Spotify: https://developer.spotify.com/dashboard

**Issue: Location/Microphone permissions not working**
- Check app.json has usage descriptions (already configured ✓)
- Reset permissions: Settings → General → Reset → Reset Location & Privacy

**Issue: Spotify playback fails**
- Verify you have Spotify Premium (required for playback control)
- Free accounts can only get metadata, not control playback
- Check Spotify app is installed on iPhone

**Issue: WebRTC voice AI fails**
- Check microphone permission was granted
- Verify patch-package ran during build (check build logs)
- Try restarting the app

## Security Considerations

**Environment Variables Strategy:**
- ✅ Public-facing variables in `eas.json` env block (safe to include)
- ✅ Server-side secrets (STRAVA_CLIENT_SECRET, SPOTIFY_CLIENT_SECRET, OPENAI_API_KEY) remain in Supabase Edge Functions only
- ✅ Supabase anon key is designed to be public (protected by Row Level Security policies)
- ✅ OAuth client IDs are public identifiers (secrets are server-side)

**What's NOT in the build:**
- ❌ STRAVA_CLIENT_SECRET (stays in Supabase Edge Function)
- ❌ SPOTIFY_CLIENT_SECRET (stays in Supabase Edge Function)
- ❌ OPENAI_API_KEY (stays in Supabase Edge Function)

All sensitive operations (token exchange, API calls requiring secrets) happen server-side via Supabase Edge Functions.

## Timeline & Resources

**First-Time Setup (Local Build):**
- Connect iPhone: 1 minute
- Run `expo prebuild`: 2 minutes
- Install pods: 3 minutes
- First Xcode build: 5-7 minutes
- Start Metro: 1 minute
- **Total: ~12-15 minutes**

**Subsequent Builds:**
- Rebuild after native changes: 2-3 minutes
- JS-only changes: Instant (via Metro hot reload)

**No Build Limits:**
- Local builds are unlimited
- No EAS build minutes used
- No monthly costs
- Build as many times as needed

## Build Profile Comparison

| Profile | Use Case | Metro | Build Time | Distribution |
|---------|----------|-------|------------|--------------|
| **development** | Daily testing | ✅ Yes (instant JS updates) | 20 min cloud / 5 min local | Ad-hoc (100 devices) |
| **preview** | Pre-release testing | ❌ No (standalone) | 20 min | Ad-hoc (100 devices) |
| **production** | App Store | ❌ No | 25 min | App Store |

**For your testing**: Use `development` profile - it's perfect for iterating on features and testing all integrations.

## Success Criteria

After following this plan, you will have:
- ✅ Runna app installed on your iPhone
- ✅ Connected to Metro bundler for fast development
- ✅ GPS tracking working with real location data
- ✅ Strava OAuth login and activity sync
- ✅ Spotify integration with music control
- ✅ Voice AI companion via WebRTC
- ✅ All permissions properly requested and granted
- ✅ Code changes reload instantly (2 seconds via Metro)

## Next Steps After Testing

Once you've verified everything works on your iPhone:

1. **Daily Development**: Use local builds (`npx expo run:ios --device`) for faster iteration
2. **Sharing with Others**: Use EAS cloud builds to generate shareable .ipa files
3. **TestFlight Beta**: Create production build and submit via `eas submit`
4. **App Store Release**: Same production build, submit for review

For now, focus on getting the development build working - it's the best way to test all features with fast iteration.
