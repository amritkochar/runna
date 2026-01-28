# Strava Upload Implementation

## Overview
Implemented functionality to upload locally tracked runs to Strava when users end a run, with validation checks to ensure data quality.

## What's New

### 1. Updated Strava OAuth Scopes
**File**: `lib/strava.ts`

Added `activity:write` scope to enable uploading activities to Strava:
```typescript
const STRAVA_SCOPES = ['activity:read_all,activity:write,profile:read_all'];
```

**Important**: Existing users must reconnect their Strava account to grant the new permission.

### 2. Run Validation
**File**: `lib/runValidation.ts` (new)

Validates run data before saving or uploading with these checks:

| Check | Threshold | Action |
|-------|-----------|--------|
| Minimum distance | >= 100m | Block if less |
| Minimum duration | >= 60s | Block if less |
| Minimum GPS points | >= 5 | Block if less |
| Maximum pace | < 1 min/km | Warn if faster |
| Maximum distance | < 100 km | Warn if more |
| Future start time | Not in future | Block if future |

### 3. Upload to Strava
**File**: `lib/strava.ts`

New function: `uploadRunToStrava()`
- Uploads run data to Strava API
- Handles authentication and token refresh
- Returns activity ID and name on success
- Provides detailed error messages for common failure cases

### 4. Save Runs Locally
**File**: `lib/runs.ts` (new)

New functions:
- `saveRunLocally()` - Saves run to local database with optional Strava activity ID
- `generateRunName()` - Creates time-based run names (Morning Run, Afternoon Run, etc.)
- `formatRunStats()` - Formats run statistics for display

### 5. Updated Run Screen
**File**: `app/(tabs)/run.tsx`

Enhanced end-run flow:
1. Captures run data before clearing state
2. Validates run data
3. Shows save options dialog with three choices:
   - **Upload to Strava** (if connected)
   - **Save Locally**
   - **Discard**

Error handling:
- Invalid runs show error and don't offer save options
- Failed uploads offer retry or save locally fallback
- Missing permissions prompt reconnection

### 6. Updated Types
**File**: `types/index.ts`

Changed `Activity.strava_activity_id` from `number` to `number | null` to support local-only runs.

## User Experience Flow

```
User ends run
     ↓
[Validate run data]
     ↓
Valid? ──No──> Show error, clear data
     ↓
    Yes
     ↓
[Show warnings if any]
     ↓
[Show save dialog]
     ↓
User chooses:
├── Upload to Strava → Upload → Save locally with Strava ID → Success
├── Save Locally → Save to DB → Success
└── Discard → Clear data, done
```

## Error Scenarios

### Strava Not Connected
- "Upload to Strava" option hidden
- Only "Save Locally" and "Discard" available

### Missing Write Permission
- Error: "Permission denied. Please reconnect Strava to grant activity upload permission."
- Offers "Save Locally" fallback

### Network Error
- Shows error with retry option
- Offers "Save Locally" fallback

### Invalid Run Data
- Shows specific validation errors
- No save options offered
- Data is cleared

## Database Changes

Activities table now supports local-only runs:
- `strava_activity_id` can be NULL for local runs
- `raw_data` stores GPS route points for all runs
- Local runs marked with `source: 'runna_gps_tracking'` in raw_data

## Testing Checklist

- [ ] Valid run uploads to Strava successfully
- [ ] Runs < 100m or < 60s are blocked with error
- [ ] Save locally works without Strava connection
- [ ] Very long runs show warning but allow save
- [ ] Fast pace (< 1 min/km) shows warning
- [ ] Strava not connected hides upload option
- [ ] Failed upload offers retry and save locally
- [ ] GPS route data saved in raw_data field
- [ ] Run name generated based on time of day
- [ ] Multiple saves don't duplicate data

## Known Limitations

1. **No GPS stream upload**: Strava API's basic activity creation doesn't accept GPS points. To upload route data, would need to use Upload File endpoint with GPX/TCX format (not in current scope).

2. **Re-authentication required**: Existing users must disconnect and reconnect Strava to grant `activity:write` permission.

3. **No heart rate data**: GPS tracking doesn't capture heart rate, so uploaded activities won't have HR data.

4. **Moving time = elapsed time**: Current implementation uses total elapsed time for both moving and elapsed time fields.

## Future Enhancements

1. Upload GPS track data using GPX/TCX format
2. Calculate elevation gain from altitude data
3. Support for pausing/resuming runs
4. Detect and handle duplicate uploads
5. Batch upload multiple local runs
6. Edit run details (name, description) before upload
7. Activity type selection (Run, Trail Run, Race, etc.)

## Files Modified

- `lib/strava.ts` - Added upload function, updated scopes
- `lib/runValidation.ts` - New file with validation logic
- `lib/runs.ts` - New file with save functionality
- `app/(tabs)/run.tsx` - Enhanced end-run flow with save dialog
- `types/index.ts` - Updated Activity type
