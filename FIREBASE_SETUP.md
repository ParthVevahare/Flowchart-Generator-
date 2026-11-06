# Firebase setup and personal code library

The site remains a static HTML/CSS/JavaScript flowchart generator. **My Codes** adds Google Sign-In, private cloud programs, autosave, search, language/favorite filters, sorting, duplicate, rename, download, clipboard copy and recoverable Trash. There is no program-count cap. The checked-by-default email-updates checkbox is optional and its value is saved in the user's profile; signing in again preserves the existing choice.

## Finish the Firebase Console setup

The owner-supplied public web configuration for `flowcharts-d5f51` is now included in `firebase-config.js`. The Console steps below still need verification. Firebase initializes once through `firebase-client.mjs`; the supplied Analytics measurement ID is retained in configuration, but the site's existing Analytics integration is preserved without adding a second tracker.

1. In your Firebase project, register a **Web app** under Project settings. Copy its public `firebaseConfig` values into `firebase-config.js`, including `apiKey`, `authDomain`, `projectId` and `appId`. Never put a service-account key in website files. See [Firebase web setup](https://firebase.google.com/docs/web/setup).
2. Under Authentication → Sign-in method, enable **Google**, select your support email and save. Add the website hostname (for example `parthvevahare.github.io`, without a path) to Authentication → Settings → Authorized domains. Add a custom hostname if used, and `localhost` explicitly for local testing. Configure the Google consent screen/support details if the Console requests them. See [Google authentication setup](https://firebase.google.com/docs/auth/web/google-signin).
3. Create the **default Cloud Firestore database**, Standard edition, in production mode, and select its permanent region. This implementation uses Firestore, not Realtime Database.
4. Review and deploy the supplied rules and index configuration. If this Firebase project already has unrelated deployed collections/rules, merge their rules first; this repository had no previous Firebase rules. Do not deploy test-mode/open access rules.

```sh
npm ci
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes --project YOUR_REAL_PROJECT_ID
```

5. Publish the updated static files through the existing GitHub Pages workflow. Firebase Hosting is not required. Serve over HTTPS (or localhost during development); opening the HTML as a local `file://` URL cannot provide Google popup login.
6. Verify a real Google login, popup handling and sign-out on the published hostname. Create a program, sign in on another browser/device and open it. Test a second Google account. Real OAuth and production rules deployment require your project setup and were not exercised by automated fixtures.

Empty config deliberately keeps sign-in disabled with a setup explanation; all guest generator features continue working. If Google services fail to load, the panel explains how to retry. No Firebase secrets or production project identifiers are invented.

## Storage and access control

```text
users/{uid}
  email, displayName, emailUpdates
  createdAt, updatedAt, consentUpdatedAt

users/{uid}/codes/{programId}
  title, language, description, tags[], favorite, deleted
  createdAt, updatedAt, revision, mutationId

users/{uid}/codes/{programId}/content/source
  sourceCode, revision, mutationId, updatedAt
```

Firebase Auth UID owns every path. Rules reject guests and other UIDs, validate allowed keys/types/lengths, preserve creation timestamps, require increasing revisions and enforce atomic metadata/source updates with `getAfter`. Client hard deletion is denied. The browser uses no administrative credentials.

The source body is deliberately separate from metadata: the web Firestore SDK retrieves whole documents, so the library can search titles/descriptions/tags without downloading all source code. Metadata arrives in pages of 100 ordered by document ID; the UI progressively loads all metadata and renders 25 matching rows at a time. Search and sorting cover the fully loaded collection, including program 301 and beyond. The displayed count says “loading” while incomplete. No composite indexes are required; `firestore.indexes.json` exempts source text, descriptions and tags from unused field indexes.

Each program is independent. Duplicate titles are allowed; unique Firestore IDs prevent overwrites. The client accepts up to **180,000 UTF-16 code units** per source file; the rules also cap source string length, keeping even multibyte source comfortably below Firestore's document-size limit. Titles allow 120 characters, descriptions 2,000, and up to 10 tags of 40 characters each. The generator's existing **50,000-character diagram input limit** is unchanged: larger saved programs may be stored/downloaded but cannot be rendered as a diagram without shortening them.

## Autosave and recovery

- Code, title, language, description, tags and favorite changes save after 1.5 seconds of inactivity. Unchanged values do not trigger cloud writes.
- Saves run serially per editing session. A Firestore transaction checks the expected revision, writes metadata and source together, and uses server timestamps. Only a confirmed transaction produces “Saved to cloud.” Operation IDs make retries of an acknowledged transaction idempotent.
- Another device's changes cause a conflict instead of being overwritten. **Save as new** keeps the local version in a separate program. **Reload cloud version** explicitly confirms discarding local edits. Refresh the library to see another device's new programs; this is not live collaborative editing.
- Unsynced source and metadata are journaled to IndexedDB, separately by account, program and browser-tab writer. Refresh/re-login offers **Recover** actions. Cloud transactions fail offline; drafts stay local and retry when connectivity returns or **Save now** is clicked. Opening other programs waits for the current save; on failure, keep editing, download the source, or save a separate copy after reconnecting.
- Account changes clear the previous account's editor, results and library immediately. Its pending recovery drafts remain available only through that account's library UI. Local drafts are not encrypted; a shared browser profile or cleared browser storage is not a durable backup. Browser storage failures are shown, and leaving with unsynced work triggers a browser warning where supported. Keep downloaded backups of important work.
- Guest editing is locally recoverable. Signing in never silently uploads guest code: use **Save current code**. There was no previous saved-program schema in this repository, so no destructive legacy migration runs.
- **Move to Trash** asks for confirmation, sets `deleted: true` and keeps the source. Use the Trash filter and **Restore** to recover it. Nothing is automatically purged, including Trash. The library count excludes Trash and shows its separate count.

## Email-update preferences and later export

The signup label is **Receive updates on your email**, checked initially and freely editable. Returning users keep their stored choice, and can change it in My Codes. `consentUpdatedAt` records the latest preference change. No email is sent and no external mailing service receives data.

When a mailing provider is chosen, export only profiles where `emailUpdates == true` using a trusted administrative environment. The optional `scripts/export-mailing-list.cjs` utility writes `email,displayName,consentUpdatedAt` CSV, excluding source code. Install `firebase-admin` in that trusted environment, use Application Default Credentials for the intended project, and run:

```sh
node scripts/export-mailing-list.cjs YOUR_REAL_PROJECT_ID /private/path/mailing-list.csv
```

This script is not loaded by the website, sends no messages and requires admin access. Never commit its CSV or credentials. Re-export before sending so opted-out users are excluded, and synchronize provider unsubscribe changes back to `emailUpdates` when integrating a provider. The checkbox records the displayed default and user choice; it does not prove a separate affirmative opt-in.

## Capacity, usage and free-tier considerations

The application supports 300–1,000+ programs per account without an architectural change or automatic eviction. Firebase quotas apply to the whole project, not separately to each user. The published free quota currently includes 1 GiB stored data, 50,000 document reads/day, 20,000 writes/day and 10 GiB outbound transfer/month. A document is limited to 1 MiB. Check the current [Firestore quotas](https://firebase.google.com/docs/firestore/quotas) and [billing documentation](https://firebase.google.com/docs/firestore/pricing) for your project.

Typical usage with this implementation:

| Action | Document operations, before retries/rule checks |
| --- | --- |
| Load/refresh a 300-program library | About 300 metadata reads; no source-body reads |
| Open a program | 2 reads |
| Create or save a changed program | 1 transaction read and 2 writes |
| Favorite, rename, trash or restore via a row action | Reads the program, then performs the same transactional save |
| Signup | Profile read + one creation write |
| Change email preference | 1 write |

Rules using `getAfter` can add billed reads; transaction retries add operations. Idle typing pauses are debounced, but continuous editing sessions still consume writes. Three hundred 10 KB sources occupy roughly 3 MB before metadata, indexes and overhead; 1,000 occupy roughly 10 MB. Many users or large files can exhaust the project's free quota. Trash also consumes storage. Monitor Firestore Usage, set billing alerts if billing is enabled, and choose paid capacity when necessary; the UI will report failures rather than deleting records to fit a quota.

## Automated and manual checks

Use Node.js 24.12+ and Java 21+ for the Firestore emulator. No real Firebase login is required for the demo-project tests. CI pins Ubuntu 24.04 for compatibility with the pinned Playwright browser build.

```sh
npm ci
npx playwright install chromium
npm test
npm run test:ui
npm run test:rules
```

`test:rules` uses only `demo-flowchart-library` on 127.0.0.1:8080. It creates 301 independent programs, pages through all of them, edits number 300, duplicates/trashes/restores, checks revision conflicts/idempotence, profile preferences, unauthorized reads/writes and malformed writes. Browser tests intercept Firebase authentication/storage with an isolated fixture to exercise UI, draft persistence, account changes and offline recovery; these complement the real SDK/Firestore emulator tests rather than replacing them. The original parser and UI regression suites remain included. GitHub Actions runs all three suites.

Before a production release, finish the real-project setup above and manually check Google popup sign-in on desktop/mobile, two real accounts, a second device, a real network interruption, and deployed rules. The automated tests do not certify your Console settings or hosting configuration.
