# Personal code library implementation plan

**Goal:** Add private Google-account libraries with 300+ independently saved programs while preserving the generator.

**Architecture:** Keep the static site and editor. Add a small library panel, lazy Firebase authentication, metadata documents with separate source bodies, transactional revision checks, and per-account IndexedDB recovery drafts.

**Tech stack:** Plain JavaScript, Firebase modular SDK, Firestore, Node test runner, Playwright, Firebase emulator.

**Spec:** User-supplied cloud-library brief, with explicit authorization to add authentication and save mailing preferences in Firebase while Console setup is ongoing.

## Constraints and decisions
- Existing syntax parser, diagram generation, export and guest workflow remain intact.
- No program-count cap. Fetch metadata in 100-record pages; render 25 rows at a time. Source bodies load only on opening or duplicating.
- Source limit: 180,000 UTF-16 units in the client (at most 720 KB UTF-8); the existing 50,000-character diagram generation limit remains.
- Autosave after 1.5 seconds; report cloud success only after the transaction resolves.
- Conflicts stop automatic writes and preserve the local draft; users can save their version as a separate program.
- Deletion moves programs to Trash; restoration is explicit. No automatic purge.
- Checked-by-default email-update checkbox, editable at signup and later. Existing users' choices are never reset by login.
- Empty Firebase config is intentional. No production credentials, deployments or live-account test data.

## Tasks and verification
- [x] Core data validation, filtering, draft and save controller. Tests: meaningful changes, writes in flight, offline failures, conflicts, recovery, account separation.
- [x] Firestore adapter and rules. Emulator: create 301 programs; retrieve/edit number 300; reload, duplicate, trash/restore; reject other users, guests and malformed/stale writes.
- [x] Integrate the existing editor with My Codes, account controls, metadata editing, search/filter/sort, copy/download, and local guest recovery. Browser tests preserve the generator and exercise library actions.
- [x] Document Firebase configuration, rules/index deployment, costs, limits, recovery and mailing-list export. Add CI tests.
- [x] Run core, browser and emulator suites, inspect desktop/mobile renders, independent final review, and prepare a reviewable GitHub PR.

## Review focus
Account changes during pending saves; failure between cloud commit and acknowledgement; local storage failures; rapid program switching while typing; large code source and hostile titles rendered as text.
