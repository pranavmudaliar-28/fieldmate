# Google Maps setup (for the customer location search)

> **Not needed today.** You chose the free route, so the app uses Photon (OpenStreetMap) search and OpenStreetMap tiles, with no key and no billing account. Keep this page for the day you want Google's data instead: switching is a swap of `apps/mobile/src/features/location/osm-provider.ts` behind the `LocationProvider` interface, with no change to the screens.

Do this once. It takes about 15 minutes. At the end you'll have **two API keys** to send me — one for Android, one for iOS.

Google requires a card on file even though normal use for a small team stays inside the free monthly allowance. You can cap spending in step 7 so it can never surprise you.

---

## 1. Create the project

1. Go to https://console.cloud.google.com and sign in.
2. Top bar → project dropdown → **New project**.
3. Name it `FieldMate` and click **Create**.
4. Make sure `FieldMate` is selected in the project dropdown before continuing.

## 2. Enable billing

1. Left menu → **Billing** → **Link a billing account** → **Create billing account**.
2. Enter your details and card. Google gives a recurring monthly allowance for Maps; a team of this size normally stays well under it.

## 3. Turn on the three APIs

Left menu → **APIs & Services** → **Library**, then search for and **Enable** each of these:

| API | What it does for us |
|---|---|
| **Places API (New)** | Address suggestions as the manager types |
| **Geocoding API** | Turns a dragged pin back into an address |
| **Maps SDK for Android** | The map on Android |
| **Maps SDK for iOS** | The map on iPhone (skip if Android only for now) |

## 4. Create the Android key

1. **APIs & Services** → **Credentials** → **Create credentials** → **API key**.
2. Rename it `FieldMate Android`.
3. Click it, then under **Application restrictions** choose **Android apps** → **Add**:
   - Package name: `com.slasheasy.fieldmate.dev` (and later `com.slasheasy.fieldmate` for the store build)
   - SHA-1 fingerprint: I'll send you this once the first build exists. **Until then, leave the restriction as "None" and treat the key as temporary.**
4. Under **API restrictions** → **Restrict key** → select: Places API (New), Geocoding API, Maps SDK for Android.
5. **Save.**

## 5. Create the iOS key

Same steps, named `FieldMate iOS`, restricted to **iOS apps** with bundle ID `com.slasheasy.fieldmate.dev`, and to: Places API (New), Geocoding API, Maps SDK for iOS.

*(Skip this if you only want Android for now — I'll wire iOS later.)*

## 6. Send me the keys

Paste them into `apps/mobile/.env` yourself if you prefer (the file is git-ignored and never committed):

```
EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY=AIza...
EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY=AIza...
```

Or send them to me and I'll put them there. **Don't paste them into chat if you'd rather keep them private** — adding them to that file yourself works just as well, and I'll pick them up from there.

> These keys ship inside the app, which is normal and expected for Maps keys. That's exactly why the restrictions in steps 4 and 5 matter: a restricted key only works from our app.

## 7. Cap the spend (recommended)

1. **Billing** → **Budgets & alerts** → **Create budget**.
2. Set a small monthly amount (for example ₹500 or $5) and alerts at 50%, 90%, 100%.

This warns you by email. If you want a hard stop rather than a warning, tell me and I'll add server-side quotas: **APIs & Services → Quotas**, capping daily requests per API.

## What happens next

Once the keys exist I'll build step 7D:
- Address search with suggestions on the Create Task screen
- A map with a pin that can be dragged to correct the exact spot
- Removal of the "use my current location" button
- Address **and** coordinates become required

Nothing else in the app changes, and existing tasks keep working.
