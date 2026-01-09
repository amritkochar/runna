# Activities Loading & Sync Fix

## Problems Fixed

### 1. **Activities Not Showing on App Start** ✅
**Problem**: When you opened the History tab, no activities were displayed even though they existed in the database.

**Solution**: Added automatic loading of activities from database when the app starts:
- Activities load as soon as you're authenticated and Strava is connected
- Loads up to 100 most recent activities, sorted by date
- Also loads your runner persona (running stats profile)

### 2. **Efficient Sync - Only New Activities** ✅
**Problem**: Need to ensure sync only fetches new activities, not re-syncing everything.

**Solution**: The sync logic already correctly:
- Queries the database for your latest synced activity date
- Fetches activities from Strava starting from that date
- Stops when it reaches activities you already have
- Only inserts new activities into database

### 3. **Runner Profile Updates** ✅
**Problem**: Runner profile needed to update with every new run synced.

**Solution**:
- After syncing new activities, automatically recalculates runner persona
- Updates profile with latest running stats:
  - Average distance
  - Average pace
  - Preferred run time (morning/afternoon/evening)
  - Running frequency
  - Recent accomplishments
  - Heart rate zones (if available)
- Refreshes the profile to keep everything in sync

## What You'll See Now

### When Opening the App
```
📊 [Strava] Loading existing activities from database...
✅ [Strava] Loaded 45 activities from database
✅ [Strava] Loaded runner persona from profile
📊 [History] Screen mounted
📊 [History] Strava connected: true
📊 [History] Activities count: 45
📊 [History] First activity: Morning Run
```

### When Syncing New Activities
```
🔄 [History] User initiated sync via pull-to-refresh
🔄 [Strava] Starting sync...
🔑 [Strava] Getting valid token for user: abc-123
⏰ [Strava] Token expires at: 2026-01-15T12:00:00.000Z
✅ [Strava] Using existing token
🔄 [Strava] Starting activity sync for user: abc-123
📊 [Strava] Latest activity date: 2026-01-08T09:00:00.000Z
📥 [Strava] Fetching page 1...
📥 [Strava] Retrieved 20 activities from page 1
🏃 [Strava] Found 5 running activities in page 1
✅ [Strava] Synced activity: Evening Run
✋ [Strava] Reached already-synced activities, stopping
✅ [Strava] Sync complete! Synced 1 new activities
📊 [Strava] Loaded 46 total activities after sync
🔄 [Strava] Updating runner persona...
✅ [Strava] Runner persona updated
✅ [Strava] Profile refreshed with updated runner persona
✅ [History] Sync complete - 1 new activities synced
```

## How Sync Works

### Initial Load (App Start)
1. User logs in / app starts
2. Profile is loaded from Supabase
3. If `strava_access_token` exists, `stravaConnected` is set to true
4. `useStrava` hook detects connection and loads activities from DB
5. Runner persona is loaded from profile
6. Activities display in History tab

### Pull-to-Refresh Sync
1. User pulls down on History tab
2. Gets valid Strava token (refreshes if expired)
3. Queries DB for latest activity date
4. Fetches activities from Strava API (paginated)
5. Filters to only running activities
6. For each activity:
   - If newer than latest in DB → insert
   - If older/equal to latest in DB → stop
7. Recalculates runner persona with all activities
8. Updates profile with new persona
9. Refreshes activities list in app

### Sync Efficiency
- **No duplicate data**: Uses `upsert` with `onConflict: 'strava_activity_id'`
- **Stops early**: Breaks pagination loop when reaching synced activities
- **Rate limited**: 100ms delay between pages (Strava allows 200 requests per 15 min)
- **Only runs**: Filters to `type === 'Run' || sport_type === 'Run'`

## Database Schema

### Activities Table
```sql
activities
├── id (uuid, primary key)
├── user_id (uuid, foreign key to profiles)
├── strava_activity_id (bigint, unique)
├── name (text)
├── type (text)
├── distance_meters (numeric)
├── moving_time_seconds (integer)
├── start_date (timestamp)
├── average_speed (numeric)
├── average_heartrate (numeric, nullable)
├── calories (integer, nullable)
├── elevation_gain (numeric)
└── raw_data (jsonb)
```

### Profile Runner Persona
Stored in `profiles.runner_persona` as JSON:
```json
{
  "typical_distance_km": 5.2,
  "average_pace_min_per_km": 5.8,
  "preferred_run_time": "morning",
  "heart_rate_zones": {
    "easy": [120, 140],
    "tempo": [160, 180],
    "threshold": [180, 200]
  },
  "recent_accomplishments": ["Long run of 10.2km"],
  "running_frequency": 3.5,
  "total_runs": 45
}
```

## Testing

After deploying the Strava Edge Function fix (see STRAVA_SYNC_FIX.md):

1. **Open app** - Should see activities immediately in History tab
2. **Pull down** - Should sync only new activities
3. **Check logs** - Should see detailed emoji-logged progress
4. **Verify persona** - Settings should show updated running stats

All changes have been committed and pushed to your branch.
