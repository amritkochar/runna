# iOS Rebuild Instructions - Fix ExpoLocation Error

## Problem
You're seeing: **"Cannot find native module 'ExpoLocation'"**

This happens because `expo-location` was installed as an npm package, but the native iOS module hasn't been compiled into your app binary yet.

## Solution: Rebuild Your Development Client

Since you're using `expo-dev-client`, you need to rebuild the native iOS app to include the `expo-location` module.

---

## Option 1: Local Build (Recommended - Faster)

**Requirements:**
- Mac with Xcode installed
- iPhone connected via USB or WiFi
- CocoaPods installed (`sudo gem install cocoapods`)

**Steps:**

```bash
# 1. Make sure you're on the correct branch
git checkout claude/add-gps-tracking-2AyVO
git pull

# 2. Install dependencies (if not already done)
npm install

# 3. Generate native iOS code with all Expo plugins
npx expo prebuild --clean --platform ios

# 4. Install CocoaPods dependencies
cd ios && pod install && cd ..

# 5. Build and install on your iPhone
npx expo run:ios --device
```

**Expected output:**
- Xcode will compile the app (~5-10 minutes first time)
- App will install on your connected iPhone
- App will launch automatically
- ExpoLocation module will now be available

---

## Option 2: EAS Build (Cloud Build)

If you don't have a Mac or prefer cloud builds:

```bash
# 1. Install EAS CLI (if not already installed)
npm install -g eas-cli

# 2. Login to Expo
eas login

# 3. Configure EAS (first time only)
eas build:configure

# 4. Build development client for iOS
eas build --profile development --platform ios

# 5. Download and install the .ipa on your iPhone
# (EAS will provide a download link and QR code)
```

---

## Troubleshooting

### "Command not found: npx expo"
```bash
npm install -g expo-cli
```

### "No devices found"
- Connect iPhone via USB
- Trust the computer on your iPhone
- Or use: `npx expo run:ios --device "Your iPhone Name"`

### "CocoaPods not installed"
```bash
sudo gem install cocoapods
```

### "Xcode build failed"
- Open `ios/Runna.xcworkspace` in Xcode
- Go to Signing & Capabilities
- Select your Apple Developer account
- Build from Xcode directly (⌘ + R)

### "Module still not found after rebuild"
- Clean build: `cd ios && rm -rf build Pods && pod install && cd ..`
- Rebuild: `npx expo run:ios --device`

---

## Why This Happened

1. **npm install expo-location** → Installed JavaScript package ✅
2. **Native module not linked** → iOS binary doesn't have ExpoLocation yet ❌
3. **Need to rebuild** → Compile native code into app binary ✅

Expo's autolinking will automatically detect `expo-location` in `package.json` and link it during the prebuild step.

---

## After Successful Build

You should see:
- ✅ No "ExpoLocation" error
- ✅ Location permission prompt when starting a run
- ✅ GPS metrics displaying during run
- ✅ Distance, pace, and speed updating in real-time

---

## Quick Test

After rebuilding:
1. Open the Runna app
2. Go to the Run tab
3. Tap "Start Run"
4. Grant location permission when prompted
5. Walk around for 30 seconds
6. You should see distance start incrementing

---

## Notes

- **First build takes longer** (~10 minutes) - subsequent builds are faster (~2 minutes)
- **The `/ios` directory is gitignored** - you need to generate it locally
- **Prebuild is safe** - it regenerates based on `app.json` config
- **You only need to rebuild when adding/removing native modules**

---

## Still Having Issues?

Check the logs:
```bash
# View Metro bundler logs
npx expo start

# View iOS device logs (on Mac)
Console.app → Select your iPhone → Filter for "Runna"
```

Common issues documented in: `docs/gps-tracking-implementation.md` (Troubleshooting section)
