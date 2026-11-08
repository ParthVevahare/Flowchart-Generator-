# Diagram settings and search discovery implementation plan

**Goal:** Add the full Code2Flow-inspired settings scope and broaden useful search coverage for supported programming workflows.
**Architecture:** Keep the existing static JavaScript application, validated control-flow graph and ELK router. A shared settings module normalizes local preferences; graph options affect grouping and layout, while display labels remain separate from semantic branch labels. Static educational pages provide distinct, useful search entry points.
**Tech stack:** HTML, CSS, JavaScript, Node tests, Playwright, GitHub Pages.
**Spec:** User approved full settings and search scope in chat on 8 November 2026 and requested autonomous execution.

## Global constraints
- Preserve parser semantics, source, algorithm output, authentication, Analytics and verification.
- Retain the existing purple interface and native select ownership documented in DESIGN.md.
- Use honest descriptions of the structured language subset; no invented language support, reviews or search ranking guarantees.
- Keep all public URLs within the GitHub Pages project path.

## Review focus
- Corrupt/blocked storage must fall back safely.
- Changes during layout or export must not publish stale charts.
- Long/untrusted branch labels must remain bounded and escaped.
- Every direction must preserve arrow paths and readable, non-overlapping nodes.
- Keyboard and narrow screens must reach every setting and recover focus.

## Task 1: Settings and layout
- [x] Add tests for normalization, persistence failure, grouping, direction, large fonts/scales, semantic label preservation and export appearance; observe failures.
- [x] Add diagram-settings.js with defaults, palettes, normalize/load/save and displayLabel. Extend FlowGraph.build(program, options) and layout(graph, options) with safe defaults.
- [x] Add an accessible settings dialog with content/rendering sections, defaults, Apply and Cancel. Stage edits until Apply; regenerate only a currently valid unchanged chart. Keep settings usable when source is invalid.
- [x] Integrate palette/font/labels in renderer and exports; settings are captured by each generation ticket.
- [x] Run unit and browser tests, inspect desktop/mobile and commit.

## Task 2: Search discovery
- [x] Add meaningful browser assertions for crawlable guides, unique canonical metadata, examples, navigation and sitemap coverage; observe failures.
- [x] Create distinct C, C++, Python, Java, loops/decisions, algorithm/pseudocode, and export guides with working supported examples, limits, FAQs and direct generator links.
- [x] Add a guide index, shared responsive stylesheet, visible homepage introduction and internal navigation without crowding the workspace. Update schema, sitemap, README and SEO documentation.
- [x] Run metadata/link tests without JavaScript and all existing UI tests; inspect narrow-screen guides and commit.

## Delivery
- [x] Run applicable repository tests, premium static audit, source checks and final independent code review. Fix material findings, push feature branch, open a pull request and report actual verification.

## Progress
- Fresh clone on feat/diagram-settings-and-search; no pre-existing local edits. Dependencies installed; source, authentication and private cloud flows preserved.
- Ruling: execute in the fresh clone on a feature branch; another worktree would duplicate this already separate checkout.

- Task 1 complete: normalized/staged local preferences, SVG icons, four-direction routing and theme-aware exports; tests were observed failing before implementation.
- Task 2 complete: seven distinct guides plus index, checked examples, canonical metadata, 11-entry sitemap and local/live verification commands; tests were observed failing before implementation.
- Final checks: 121 unit tests, 35 browser tests and 5 emulator access-rule tests pass. No application formatter or typecheck command exists; JavaScript syntax checks and deterministic output checks passed.
- Additional regression: large non-Latin strings escaped nodes at font size 24. The new browser test failed first, then passed after codepoint-safe wrapping and wider fallback-font estimates; both full unit and browser suites pass afterward.
- Independent review: no Critical, Important or Minor findings. Reviewer checked 176 direction/font/scale combinations and 28 long-label guide layouts without connector/node collisions.
- Static audit limitation: the complete project-root audit reports 39 actionless-button findings because its scanner recognizes inline onclick only, while this application binds handlers in JavaScript; two textarea-resize findings ignore existing stylesheet rules. These are recorded rather than hidden by narrowing source roots. Runtime suites verify the controls and editor behavior.
- Sitemap investigation: canonical live XML returned HTTP 200. The supplied Search Console URL used a doubled slash; submission instructions now explicitly require sitemap.xml without a leading slash after the project-prefix slash.
- Integration: publish the tested feature branch and open a pull request against main; production changes after merge and GitHub Pages deployment.

- Follow-up HTTP evidence: the exact double-slash submission also returns HTTP 200 XML today. Canonical resubmission is appropriate, but the reported Google fetch failure was not reproduced and is not claimed to be conclusively caused by the extra slash. SEO.md records this distinction.
