# 09 — Free staging deployment

Puts the API online with an `https://` address so a release APK works on any
phone, on any network, without the PC running. Every service below has a free
tier that needs no card.

| Part | Service | Free limit |
|---|---|---|
| API (Docker) | Render — free web service | 750 h/month, sleeps after 15 min idle |
| Database | Neon — Postgres | 0.5 GB, does not expire |
| Photo storage | Backblaze B2 — S3-compatible | 10 GB |
| Email (invites, resets) | Brevo — transactional API | 300 emails/day |
| Keep-awake | UptimeRobot | checks every 5 min |
| APK | Local Gradle build (or EAS free tier) | — |

Limits change; confirm them on each provider's pricing page when signing up.

Keep a scratch note open while you work. You will collect:

```
NEON_URL          = postgresql://...neon.tech/neondb?sslmode=require
B2_ENDPOINT       = https://s3.<region>.backblazeb2.com
B2_REGION         = <region>            e.g. us-east-005
B2_KEY_ID         = ...
B2_APP_KEY        = ...                 shown once only
AUTH_SECRET       = ...
BREVO_API_KEY     = xkeysib-...         shown once only
MAIL_FROM_EMAIL   = the sender address you verified in Brevo
API_URL           = https://<name>.onrender.com
```

---

## Step 0 — Push the code to GitHub

Render builds from GitHub, so the API code must be on the branch it deploys.

1. Commit your work and merge it into `main` (or pick the branch you want live).
2. `git push origin main`
3. Confirm on https://github.com/pranavmudaliar-28/fieldmate that `apps/api/Dockerfile` is there.

## Step 1 — Database (Neon)

1. Sign up at https://neon.tech (GitHub login is fine).
2. **Create project** → name `fieldmate-staging` → Postgres version: latest →
   region: closest to your users (e.g. *AWS Asia Pacific (Singapore)* for India).
3. On the project dashboard click **Connect**. Untick **Connection pooling**
   (the API keeps its own pool; migrations need a direct connection).
4. Copy the connection string. It looks like
   `postgresql://neondb_owner:xxxx@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.
   Save it as `NEON_URL`. Keep `?sslmode=require` on the end.

## Step 2 — Photo storage (Backblaze B2)

1. Sign up at https://www.backblaze.com/sign-up/cloud-storage.
2. **Buckets → Create a Bucket**
   - Name: `fieldmate-staging-<something-unique>` (names are global, so add a suffix)
   - Files in bucket: **Private**
   - Default encryption: Enable
   - Object lock: Disable
3. Open the new bucket's details and copy its **Endpoint**, e.g.
   `s3.us-east-005.backblazeb2.com`. Save `https://` + that as `B2_ENDPOINT`, and the
   middle part (`us-east-005`) as `B2_REGION`.
4. **Application Keys → Add a New Application Key**
   - Name: `fieldmate-staging-api`
   - Allow access to bucket: the bucket you just made
   - Type of access: Read and Write
5. Copy **keyID** → `B2_KEY_ID` and **applicationKey** → `B2_APP_KEY`.
   The application key is shown only once.

## Step 2b — Email (Brevo)

Invitations and "Forgot password?" send a 6-digit code by email. The API
refuses to start on staging without these settings.

1. Sign up at https://www.brevo.com (free plan).
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: the address
   emails come from (e.g. `team@yourcompany.com`). Click the link Brevo emails
   to that address to verify it. Save it as `MAIL_FROM_EMAIL`.
3. **SMTP & API → API Keys → Generate a new API key**, name `fieldmate-staging`.
   Save it as `BREVO_API_KEY` (shown once only).

Without your own domain, some inboxes may file the emails as spam at first;
ask testers to check there.

## Step 3 — Generate the auth secret

In PowerShell:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Save the output as `AUTH_SECRET`. Never reuse the development one.

## Step 4 — Create the tables and the first account

Run from the PC, against the Neon database. Values set with `$env:` take
precedence over `apps/api/.env`, so your local setup is untouched.

```powershell
cd C:\FieldMate
npm install
cd apps\api
$env:DATABASE_URL = "<NEON_URL>"
$env:APP_ENV = "staging"
npm run db:migrate
npm run user:create -- --email you@company.com --name "Your Name" --role ADMIN
```

`user:create` asks for the password without echoing it. Roles are `ADMIN`,
`MANAGER` and `FIELD_WORKER`; create the rest later from the app's admin screens
or by running the same command again. (`db:seed` refuses to run on staging by
design.)

Close this PowerShell window afterwards so the Neon URL does not linger in a
terminal you later use for local work.

## Step 5 — API (Render)

1. Sign up at https://render.com with GitHub and allow access to the `fieldmate` repo.
2. **New → Web Service** → pick `pranavmudaliar-28/fieldmate`.
3. Settings:

   | Field | Value |
   |---|---|
   | Name | `fieldmate-api` (becomes `fieldmate-api.onrender.com`, or with a suffix if taken) |
   | Region | Singapore (or nearest to the Neon region) |
   | Branch | `main` |
   | Language / Runtime | **Docker** |
   | Root Directory | *(leave empty — the build needs the repo root)* |
   | Dockerfile Path | `apps/api/Dockerfile` |
   | Instance Type | **Free** |

4. **Environment Variables** — add each one:

   ```
   APP_ENV=staging
   DATABASE_URL=<NEON_URL>
   AUTH_SECRET=<AUTH_SECRET>
   FILE_STORAGE_ENDPOINT=<B2_ENDPOINT>
   FILE_STORAGE_REGION=<B2_REGION>
   FILE_STORAGE_BUCKET=<your bucket name>
   FILE_STORAGE_ACCESS_KEY_ID=<B2_KEY_ID>
   FILE_STORAGE_SECRET_ACCESS_KEY=<B2_APP_KEY>
   FILE_STORAGE_FORCE_PATH_STYLE=true
   LOG_LEVEL=info
   BREVO_API_KEY=<BREVO_API_KEY>
   MAIL_FROM_EMAIL=<MAIL_FROM_EMAIL>
   ```

   Do not set `PORT`; Render supplies it and the API reads it.
   `CORS_ORIGINS` can stay unset — the mobile app sends no Origin header.

5. **Advanced → Health Check Path**: `/health`
6. **Create Web Service**. The first Docker build takes several minutes; watch the
   **Logs** tab. If the API exits with `Invalid environment configuration`, the
   message names the variable that is wrong (values are never printed).
7. When the status is **Live**, copy the URL at the top → `API_URL`.

### Check it

Open `<API_URL>/health` in a browser. It should answer. Then, in PowerShell:

```powershell
curl.exe -X POST "<API_URL>/api/v1/auth/login" -H "Content-Type: application/json" -d '{\"email\":\"you@company.com\",\"password\":\"<password>\"}'
```

A JSON response with a token means the API, database and account all work.

## Step 6 — Keep it awake (UptimeRobot)

Render's free service sleeps after 15 idle minutes and takes ~50 s to wake.
The app gives up on the server after 15 s, so a sleeping API shows
"The server took too long to answer".

1. Sign up at https://uptimerobot.com.
2. **New monitor** → type **HTTP(s)** → URL `<API_URL>/health` → interval **5 minutes** → Create.

One service running all month stays inside Render's 750 free hours.

## Step 7 — Build the release APK

The APK carries its own JavaScript and the API address, so it needs neither
Metro nor the PC. A release build only allows `https://`, which `API_URL` is.

### Option A — local Gradle build (fastest, no account)

```powershell
cd C:\FieldMate\apps\mobile
$env:APP_ENV = "staging"
$env:EXPO_PUBLIC_API_BASE_URL = "<API_URL>/api/v1"
npx expo prebuild --platform android --clean
cd android
.\gradlew assembleRelease
```

Variables set in the shell win over `apps/mobile/.env`, so the LAN address there
is not baked in. The APK is at
`apps\mobile\android\app\build\outputs\apk\release\app-release.apk`.

It is signed with the debug key, which is fine for installing directly on
phones but not for the Play Store.

### Option B — EAS cloud build (free tier)

1. In `apps/mobile/eas.json`, add the URL to the `staging` profile:

   ```json
   "staging": {
     "distribution": "internal",
     "environment": "preview",
     "env": {
       "APP_ENV": "staging",
       "EXPO_PUBLIC_API_BASE_URL": "<API_URL>/api/v1"
     },
     "android": { "buildType": "apk" }
   }
   ```

2. ```powershell
   cd C:\FieldMate\apps\mobile
   npx eas-cli login
   npx eas-cli build --profile staging --platform android
   ```

3. When it finishes, EAS shows a link and QR code to download the APK.
   Free builds wait in a queue, so this can take a while.

## Step 8 — Install and test on the phone

1. Uninstall the old `FieldMate Staging` debug app first (same package name,
   different signing key, so Android refuses to update over it).
2. Copy the APK to the phone (or `adb install -r app-release.apk` over USB) and install.
3. Turn the PC's Wi-Fi off or put the phone on mobile data — the app should still work.
4. Sign in with the account from Step 4, create a task, and attach a photo
   (this proves the B2 bucket works).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Stuck on the splash screen | A debug APK was installed. Build `assembleRelease` (Step 7). |
| "The server took too long to answer" | The API was asleep. Check the UptimeRobot monitor is active; wait 1 min and retry. |
| Sign-in says network error | The APK was built with the old LAN address or an `http://` URL. Rebuild with `EXPO_PUBLIC_API_BASE_URL` set. |
| Render log: `Invalid environment configuration` | The listed variable is missing or malformed; fix it under **Environment** and redeploy. |
| Render log: `DATABASE_URL must not point to a local host` | You pasted the local URL. Use the Neon one. |
| `db:migrate` fails with an SSL error | `?sslmode=require` is missing from the Neon URL. |
| Photo upload fails | Wrong bucket name, region or key, or the key is not scoped to that bucket. Check the Render logs for the S3 error. |
| Render log: `BREVO_API_KEY is required` | Add the Brevo settings from Step 2b under **Environment**. |
| Invite says "The email could not be sent" | The Render log says why: usually an unverified sender (`MAIL_FROM_EMAIL`) or a wrong key. The user is still created; use **Resend invitation** once fixed. |
| Push notifications don't arrive | Android release builds need Firebase (FCM) credentials configured in EAS; not covered here. |

## Redeploying

- **Database changes first:** when the code being pushed adds a migration
  (a new file in `apps/api/drizzle/`), run Step 4's `npm run db:migrate`
  against Neon **before** pushing, so the new API never starts against an
  old schema.
- **API:** push to `main`; Render rebuilds automatically.
- **App:** rerun Step 7. The API address only needs changing if the Render URL changes.
