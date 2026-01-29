# iOS Production Build for Personal Testing

## Context

Test Runna on your physical iPhone before sharing with initial users. The project uses Expo SDK 54 with native modules (bare workflow — has `ios/` directory).

## Important Constraint

**EAS Build and TestFlight both require a paid Apple Developer account ($99/yr).** Without one, your only option is deploying directly from Xcode to your plugged-in iPhone using free provisioning (your Apple ID). This works well for personal testing but has limitations:

- App expires every **7 days** — you'll need to rebuild/reinstall weekly
- Limited to **3 apps** sideloaded at a time
- Cannot distribute to other people's devices
- Some entitlements (like Push Notifications) won't work

**When you're ready to share with initial users, you'll need the $99 Apple Developer account** for TestFlight distribution.

---

## Steps to Build & Install on Your iPhone

### Step 1: Pre-flight checks

- Ensure your `.env` file has all required `EXPO_PUBLIC_*` variables set
- Ensure Supabase Edge Functions are deployed (strava-exchange, strava-refresh, spotify-refresh, openai-session)
- Update the placeholder EAS project ID in `app.json` (run `npx eas init` or remove the placeholder — not strictly needed for local builds but keeps things clean)

### Step 2: Install dependencies and prepare native project

```bash
npm install
cd ios && pod install && cd ..
```

### Step 3: Open Xcode and configure signing

1. Open `ios/Runna.xcworkspace` in Xcode (NOT the `.xcodeproj`)
2. Select the **Runna** target in the project navigator
3. Go to **Signing & Capabilities** tab
4. Check **"Automatically manage signing"**
5. Set **Team** to your personal Apple ID (sign in via Xcode > Settings > Accounts if not already)
6. Xcode will create a free provisioning profile for `com.runna.app`
   - If the bundle ID is taken, you may need to change it (e.g. `com.yourname.runna`)

### Step 4: Connect your iPhone and trust the computer

1. Plug iPhone into Mac via USB/USB-C
2. On iPhone: tap "Trust This Computer" if prompted
3. On iPhone: go to **Settings > General > VPN & Device Management** (after first install) and trust your developer certificate

### Step 5: Build Release configuration

**Option A — From Xcode** (recommended for first time):
1. Select your iPhone as the build target (top bar in Xcode)
2. Change scheme to **Release**: Product > Scheme > Edit Scheme > Run > Build Configuration > Release
3. Press `Cmd+R` to build and run

**Option B — From command line**:
```bash
npx expo run:ios --device --configuration Release
```
This will detect your connected device and build in Release mode (no dev server needed).

### Step 6: Trust the developer on iPhone

After first install:
1. Go to **Settings > General > VPN & Device Management**
2. Find your Apple ID under "Developer App"
3. Tap **Trust**

### Step 7: Verify the app works disconnected

1. Unplug your iPhone from the Mac
2. Open the Runna app
3. Test all core flows: login, Strava sync, Spotify, voice companion, run tracking

---

## What Changes When You Get Apple Developer Account

When ready to distribute to initial users via TestFlight:

1. Sign up at [developer.apple.com](https://developer.apple.com) ($99/yr)
2. Set up EAS:
   ```bash
   npm install -g eas-cli
   eas login
   eas init  # links project, sets real projectId in app.json
   ```
3. Create `eas.json` with build profiles:
   ```json
   {
     "cli": { "version": ">= 3.0.0" },
     "build": {
       "preview": {
         "distribution": "internal",
         "ios": { "simulator": false }
       },
       "production": {
         "distribution": "store"
       }
     },
     "submit": {
       "production": {
         "ios": { "appleId": "your@email.com" }
       }
     }
   }
   ```
4. Build and submit to TestFlight:
   ```bash
   eas build --platform ios --profile production
   eas submit --platform ios
   ```
5. Add testers in App Store Connect and they install via TestFlight app

---

## Verification Checklist

After installing on your phone:
- [ ] App launches without crash
- [ ] Supabase auth (login/signup) works
- [ ] Strava OAuth flow completes and syncs activities
- [ ] Spotify connects and controls playback
- [ ] Voice companion (OpenAI Realtime) establishes WebRTC connection
- [ ] Location tracking works during a run
- [ ] App works when phone is disconnected from Mac
- [ ] App works on Wi-Fi and cellular
