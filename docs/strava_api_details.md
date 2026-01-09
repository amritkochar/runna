# Strava API Technical Details

## 1. Authentication (OAuth 2.0)

Strava uses OAuth 2.0. The flow differs slightly for Mobile (iOS/Android) vs Web.

### iOS App (Native + Web Fallback)
The "best practice" on iOS involves checking if the Strava App is installed and if so, app-switching to it. If not, fallback to a web-view authentication.

**Key URL Schemes:**
- **Scheme:** `strava://oauth/mobile/authorize`
- **Fallback:** `https://www.strava.com/oauth/mobile/authorize`

**Info.plist Configuration:**
Apps must verify they can open the Strava app scheme by adding `strava` to `LSApplicationQueriesSchemes` in `Info.plist`.

**The Flow:**
1. **User Request:** User clicks "Connect with Strava".
2. **App Check:** App checks `Linking.canOpenURL('strava://')`.
3. **Authorize:**
    - **Native:** `Linking.openURL('strava://oauth/mobile/authorize?client_id=...&redirect_uri=...&response_type=code&approval_prompt=auto&scope=...')`
    - **Web Fallback:** Open an `ASWebAuthenticationSession` or similar pointing to `https://www.strava.com/oauth/mobile/authorize...`.
4. **Redirect:** User approves in Strava App/Web. Strava redirects back to `YOUR_APP_SCHEME://YOUR_CALLBACK_PATH?code=AUTHORIZATION_CODE&scope=ACCEPTED_SCOPES`.
5. **Token Exchange:** App sends the `code` to YOUR backend.
6. **Backend:** Backend exchanges `code` for `access_token` and `refresh_token` via `POST https://www.strava.com/oauth/token`.

### Token Exchange Endpoint
- **URL:** `https://www.strava.com/oauth/token`
- **Method:** `POST`
- **Parameters:**
    - `client_id`: Integer
    - `client_secret`: String
    - `code`: The code from the redirect
    - `grant_type`: `authorization_code`

### Token Refresh
- **URL:** `https://www.strava.com/oauth/token`
- **Method:** `POST`
- **Parameters:**
    - `client_id`
    - `client_secret`
    - `grant_type`: `refresh_token`
    - `refresh_token`: The refresh token you stored.

## 2. OAuth Scopes

Scopes are additive. You must request all permissions you need.

- `read`: (Default) Public data.
- `read_all`: Private activities, comprehensive access.
- `profile:read_all`: Full profile including private data.
- `profile:write`: Update weight, FTP.
- `activity:read`: Read activities (excludes Only You/Privacy Zones).
- `activity:read_all`: Read all activities including private.
- `activity:write`: Create/Update activities.

**Recommendation:** For a running app acting as a "sync" or "companion", usually `activity:read_all,activity:write` is ideal, plus `profile:read_all` if you need detailed user info.

## 3. Important Endpoints

### List Athlete Activities
- **GET** `/athlete/activities`
- **Params:** `before` (timestamp), `after` (timestamp), `page`, `per_page`.
- **Requires:** `activity:read` or `activity:read_all`.

### Get Activity Streams (Detailed Data)
- **GET** `/activities/{id}/streams/{keys}`
- **Keys:** `time,latlng,distance,altitude,velocity_smooth,heartrate,cadence,watts,temp,moving,grade_smooth`.
- **Detailed:** Returns arrays of data points.

### Create Activity
- **POST** `/activities`
- **Params:** `name`, `type`, `start_date_local`, `elapsed_time`, `description`, `distance`.
- **Requires:** `activity:write`.

## 4. Webhooks

Webhooks are the preferred way to stay in sync without polling.

- **Subscription:** You subscribe your "callback URL" to Strava.
- **Events:**
    - `object_type`: `activity` or `athlete`.
    - `aspect_type`: `create`, `update`, `delete`.
- **Flow:**
    1. Strava sends `POST` to your callback URL with event data.
    2. Your server responds `200 OK` quickly (within 2 seconds).
    3. Your server processes the event (e.g., fetches the new activity details) asynchronously.

## 5. Implementation Strategy for Fix

1.  **Frontend (React Native):**
    - Ensure `Info.plist` has `strava`.
    - Correctly handle the OAuth redirect and extract `code`.
    - **CRITICAL:** Send this `code` to the backend Function. Do NOT do token exchange on the client (exposes client secret).

2.  **Backend (Supabase Edge Function):**
    - Receive `code` from client.
    - Perform `POST` to Strava to get tokens.
    - **Store Tokens:** Save `access_token`, `refresh_token`, and `expires_at` in the user's database record.
    - Return success to client.

3.  **Client Error Handling:**
    - The current error `FunctionsHttpError` means the Edge Function failed.
    - **Likely Causes:**
        - Invalid Client ID/Secret in backend env vars.
        - Network error from Function to Strava.
        - Invalid `code` passed.
        - Redirect URI mismatch (Strava is very strict about this).

## 6. Debugging Steps

1.  **Check Edge Function Logs:** See *why* it returned non-2xx.
2.  **Verify Strava App Settings:** Check "Authorization Callback Domain" on Strava settings matches what is being sent/used.
3.  **Local Test:** Manually call the token exchange with a fresh code to verify credentials.
