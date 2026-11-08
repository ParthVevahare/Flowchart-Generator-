# Flowchart Generator interface

This is a task-focused code playground. Preserve the existing restrained
interface, compact controls, and space for source code and generated diagrams.
Runtime CSS variables in `index.html` are the canonical token source; this file
documents their roles rather than generating a second token system.

## Existing visual language

Use the application's light/dark `--surface`, `--editor`, `--tx`, `--mu`, `--bd`
and purple `--ac` roles. Reuse the SVG symbol library, native buttons and native
selects. Language and Examples use platform-owned select popups inside the
native top-layer editor-options popover. Keep source and diagram panels in the
established desktop columns and mobile stack. Keep focus indicators visible.

## Code color roles

Color should help readers recognize syntax without changing the source or
token widths. Token fonts, weight, spacing and line height match the textarea.

| Role | Light | Dark |
| --- | --- | --- |
| Keywords, booleans | `#6f42c1` | `#c4a5ff` |
| Strings, characters | `#137333` | `#a8d594` |
| Comments | `#657080` | `#9ba6bb` |
| Numbers | `#b54708` | `#f4bd7b` |
| Functions, builtins | `#075ead` | `#86c5ff` |
| Operators, punctuation | `#475569` | `#c3ccdb` |
| Types, constants | `#8c3b12` | `#f6ca92` |
| Directives, annotations | `#a02753` | `#f3a7cb` |

## Editor behavior

The native textarea owns editing, caret, selection, undo, clipboard, keyboard
input and accessibility. The colored mirror is `aria-hidden`, noninteractive,
and synchronized to the textarea's client dimensions and both scroll axes.
Its padding and font metrics must remain identical to the textarea's.
Selected language takes precedence over automatic detection. Theme switching
only changes CSS colors. Forced-colors mode exposes native text instead.

Highlighting is presentation only: it never executes source or changes parser
validation. Invalid/incomplete code stays editable. Missing highlighting
assets and programs above 100,000 characters fall back to escaped plain text.
Verify tokens at WCAG AA contrast, language changes, raw source preservation,
scroll alignment, example/reset/cloud loading, and mobile sizing.

## Diagram settings and guide surfaces

Settings use the native modal dialog pattern already established by help,
with a fixed header/action bar and internally scrolling fields. Each setting
has a decorative SVG symbol from the local icon library. Native selects retain
platform-owned popup geometry and keyboard behavior. Settings CSS inherits
existing surface/text/accent tokens; it also owns global scrollbar styling.

`diagram-settings.js` owns five explicit export palettes independently of the
interface theme. Node geometry grows with font metrics; width scale changes
wrapping and minimum width, height scale changes minimum height. All directions
use actual port routing, not rotated text. Diagrams use natural dimensions with a 24 px margin and no fixed paper frame. SVG preserves vector dimensions; PNG bounds canvas memory and PDF uses a custom page matching the diagram’s proportions.

Guides use `guides/guides.css`: the same purple accent, system typography,
quiet borders and light/dark surfaces at a larger reading scale. Article
content is static HTML, with a narrow contents rail on desktop and stacked
navigation on mobile. Code samples own horizontal overflow; the document
never overflows horizontally. Motion is limited to link/card feedback and
respects reduced motion. No new font or image service is required.

Canonical behavior and ownership are recorded in UX-CONTRACT.md.

## Workspace viewport and automatic fit

The first desktop viewport belongs to the header and the two playgrounds.
`workspace.css` owns that viewport shell; the guide/legal/language footer stays
in normal document flow after it and appears through scrolling. It remains
keyboard accessible and crawlable. Wide screens use the available width rather
than a centered 1700 px cap. Mobile keeps the existing stacked panels and grows
each panel to make use of a tall viewport.

Fit scales the complete natural diagram into the canvas with 8–16 px breathing
room, without the former 130% automatic zoom cap. Manual zoom uses the same
maximum as fit, so zooming in cannot unexpectedly reduce a fitted small chart.
Export dimensions and diagram geometry are independent of viewport fit.
