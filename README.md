# Code to Flowchart

**[Open the live Flowchart Generator →](https://parthvevahare.github.io/Flowchart-Generator-/)**

A static, browser-based flowchart generator for structured C/C++, Python, and Java programs. Serve this directory with any static web server; no build step is required.

## Personal cloud library

**My Codes** adds Google Sign-In, private libraries with 300+ programs and no count cap, automatic saving, search/filter/sort, favorites, duplication, source download/copy and recoverable Trash. It reuses the existing editor and generator. Guest editing continues without Firebase.

Cloud features require the owner to finish [Firebase setup](FIREBASE_SETUP.md), populate `firebase-config.js`, and deploy the supplied Firestore rules/index settings. Email-update preferences are stored in Firebase; no mailing service is connected and no emails are sent.

Use Node.js 24.12+ for the full suite. Run `npm ci`, `npm test`, `npm run test:ui` (after `npx playwright install chromium`) and `npm run test:rules` (Java 21+) for the full regression, browser and isolated Firestore suites. The latter verifies 301 programs and account isolation without production data.

## Workspace

- Paste code or choose an example, open **Language and examples** (the sliders button) when needed, and choose **Generate Flowchart** (Ctrl/Cmd + Enter).
- The source editor colors keywords, strings, comments, numbers and function names for C/C++, Python and Java. Highlighting follows the selected or detected language and adapts to light/dark mode. Editing and copying preserve the exact original source.
- The complete program appears on one A4 canvas. Its entry point and helper functions each have a labeled section. Calls to known helpers use subprocess shapes; hover over a node for its call references. `RETURN` resumes at the calling step. Recursive functions are drawn once, and helper references are not drawn as execution paths between functions.
- Zoom, fit, pan, or enter fullscreen. When the canvas has keyboard focus, use `+`/`-` to zoom, `0` to fit, and arrow keys to pan.
- Algorithm and pseudocode panels cover all functions. Export the complete chart as SVG, PNG, or PDF.
- Exports use A4 portrait proportions and 10 mm margins without stretching shapes. SVG is resolution independent; PNG is 2480 × 3508 with 300-DPI print metadata; PDF places that high-resolution page on A4. Very large programs fit on one page with smaller text; SVG remains sharp when enlarged.
- Editing or resetting code invalidates the previous result and disables export until the next successful generation.

## Supported syntax

The parser deliberately accepts a structured subset rather than silently turning unfamiliar text into process boxes:

- Typed C/C++ functions and Java methods in simple class containers; Python functions and top-level scripts.
- Variable declarations and assignments, arithmetic and comparisons, function calls, arrays/indexing, and common input/output operations.
- Conditions, `while`, `for`, `do/while` (C/Java), `break`, `continue`, `return`, and conventional `switch/case` statements (C/Java).
- Python literals, tuples, lists, dictionaries, basic type annotations in function signatures, and imports.

Malformed tokens, expressions, declarations, parameters, indentation, and invalid control-flow contexts produce line-specific diagnostics. Bare text and expressions without an action are rejected. Assignment inside a condition is intentionally rejected; use an explicit assignment followed by a comparison.

This is syntax and control-flow validation, not a compiler or interpreter. It does not execute code, resolve types or undefined names, evaluate preprocessor macros, or prove runtime behavior. Classes with inheritance/constructors, C/C++ aggregate definitions, typedefs, exceptions, `goto`, Python comprehensions/generators, and other unsupported constructs need simplification before generating a chart. Function overloading is rejected because call resolution requires type information. Indirect/function-pointer calls are not expanded into helper links.

To keep diagrams responsive, inputs are limited to 50,000 characters, 12,000 tokens, 20 functions and 500 flowchart steps. Excessive nesting is rejected with a diagnostic.

If Python contains only function definitions, the chart labels its first function as a function root with no entry point; it does not imply that defining a function executes it.

## Checks

Requires Node.js 22 or later for the dependency-free regression suite:

```sh
node --test tests/core.test.cjs
```

Run `npm test` for the full core, graph and library checks. The suite covers all built-in examples, valid and invalid syntax, language detection, control-flow context, combined function charts, recursive calls, renderer isolation from the parsed program, branch joins, nested transfers, switch fallthrough, graph/source execution comparisons and layout geometry.

## Generation pipeline

`syntax.js` and the existing parsers produce validated statement structures. `flowchart.js` builds a separate graph with explicit successors: branches share continuations, loops have dedicated condition/update targets, and abrupt transfers have no fallthrough. Consecutive assignments/declarations are grouped up to three statements, keeping calls and input/output separate. Unreachable nodes are removed; graph validation checks successor counts, branch labels, terminal exits and edge destinations.

The locally bundled ELK.js 0.11.0 engine calculates node positions, orthogonal connector routes and edge-label positions. Layout-only reversal of loop feedback edges keeps the entry above the body; arrows are restored to their original direction before rendering. Function sections are packed for A4 and scaled uniformly. `diagram-export.js` supplies shared page dimensions and PNG density metadata. Layout does not change semantic graph edges or execute user code. Graph validation checks structural control flow, rather than proving satisfiability of arbitrary runtime predicates.

The browser interaction suite additionally requires Playwright and Chromium:

```sh
npm install --no-save playwright
npx playwright install chromium
node --test tests/ui.test.cjs
```

It checks keyboard navigation, contrast in both themes, short-window errors, long-file error positioning, Reset recovery, PDF loading/retry, stale-export protection, and mobile control sizing. External services are intercepted during these checks.

Tab and Shift+Tab move between controls; Ctrl/Command + ] inserts four spaces in the editor. Reset exposes a Restore action, and Ctrl/Command + Z also recovers the cleared source until the next edit or example selection.

The page loads its existing jsPDF CDN dependency only when PDF export is requested, with retry feedback if loading fails. Visit-counter/analytics services remain unchanged. Custom interface icons are inline SVG with no external icon library.

## Diagram settings

Use **Settings** in the diagram toolbar for custom true/false labels, statement
grouping, decorated edge labels, five themes, four directions, font size,
width/height scales and compact spacing. Every setting has a local SVG icon.
Apply commits changes, Cancel/Escape discards the draft, and Reset restores the
draft defaults. Settings persist only in the current browser when storage is
available. They affect preview and exports without editing source code.

## Guides and search discovery

The [guide index](https://parthvevahare.github.io/Flowchart-Generator-/guides/)
contains C, C++, Python and Java walkthroughs, control-flow explanations,
algorithm/pseudocode help and an export guide. Use **Try this example** to load
a checked example directly into the generator. Edit `scripts/guide-content.cjs`
and run `npm run build:guides` to update the static pages and sitemap.

The [sitemap](https://parthvevahare.github.io/Flowchart-Generator-/sitemap.xml)
contains 11 public URLs. If Search Console already displays the project prefix
ending in `/`, enter `sitemap.xml` with **no leading slash**. See [SEO.md](SEO.md)
for the exact submission and deployment checks.
