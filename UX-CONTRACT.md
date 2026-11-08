# Flowchart Generator UX contract

## Canonical owners

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Select/Listbox | Native HTML select | DESIGN.md | OS-owned language, examples, theme and direction popups | tests/ui.test.cjs, tests/settings-ui.test.cjs |
| Form | Native labeled fields and explicit submit validation | settings-ui.js | staged local preferences | tests/settings-ui.test.cjs |
| Dialog | Native HTML dialog | help.js and settings-ui.js | help walkthrough; staged preferences | tests/seo.test.cjs, tests/settings-ui.test.cjs |
| Scrollbar | Global CSS baseline | settings.css, guides/guides.css | code block horizontal overflow | tests/search-guides.test.cjs |
| Toast | Existing toast(message) live status | index.html | applied; persistence unavailable; export failure | tests/settings-ui.test.cjs, tests/ui.test.cjs |

## Settings behavior

Apply commits a normalized settings snapshot and regenerates an existing chart
or a chart in progress. Invalid/edited source stays untouched and requires
Generate. Cancel, the close button and Escape discard the draft; reopening
restores committed values. Reset changes the draft and requires Apply.
Numeric fields validate explicit bounds, preserve entered values on errors and
focus the first invalid field. The dialog scrolls internally; its action bar
remains reachable in short and narrow viewports. Focus returns to Settings.

Preferences contain presentation values only, persist locally when permitted,
and do not enter cloud records. Storage failures are announced honestly.
Display labels do not change semantic Yes/No edges or parser validation.
Every generation and export is bound to a chart snapshot; editing source or
applying settings invalidates stale work.

## Guides

Articles and metadata are static HTML available without JavaScript. An example
link passes only a known example identifier; source is loaded from local
generated fixtures and is never accepted as executable input from a URL.
Canonical URLs omit example queries and fragments. Educational prose describes
supported subsets rather than promising full-language execution or AI inference.

## Existing account flows

This change does not alter account permissions, retention, legal copy or cloud
write behavior. The existing library contract and Firestore rules still own
those operations; library tests remain part of regression verification.
