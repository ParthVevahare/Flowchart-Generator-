# Code to Flowchart

A static, browser-based flowchart generator for structured C/C++, Python, and Java programs. Serve this directory with any static web server; no build step is required.

## Workspace

- Paste code or choose an example, select its language, and choose **Generate Flowchart** (Ctrl/Cmd + Enter).
- The complete program appears on one canvas. Its entry point and helper functions each have a labeled section. Dashed links connect call sites to their function definitions; `RETURN` resumes at the calling step. Recursive functions are drawn once.
- Zoom, fit, pan, or enter fullscreen. When the canvas has keyboard focus, use `+`/`-` to zoom, `0` to fit, and arrow keys to pan.
- Algorithm and pseudocode panels cover all functions. Export the complete chart as SVG, PNG, or PDF.
- Editing or resetting code invalidates the previous result and disables export until the next successful generation.

## Supported syntax

The parser deliberately accepts a structured subset rather than silently turning unfamiliar text into process boxes:

- Typed C/C++ functions and Java methods in simple class containers; Python functions and top-level scripts.
- Variable declarations and assignments, arithmetic and comparisons, function calls, arrays/indexing, and common input/output operations.
- Conditions, `while`, `for`, `do/while` (C/Java), `break`, `continue`, `return`, and conventional `switch/case` statements (C/Java).
- Python literals, tuples, lists, dictionaries, basic type annotations in function signatures, and imports.

Malformed tokens, expressions, declarations, parameters, indentation, and invalid control-flow contexts produce line-specific diagnostics. Bare text and expressions without an action are rejected. Assignment inside a condition is intentionally rejected; use an explicit assignment followed by a comparison.

This is syntax and control-flow validation, not a compiler or interpreter. It does not execute code, resolve types or undefined names, evaluate preprocessor macros, or prove runtime behavior. Classes with inheritance/constructors, C/C++ aggregate definitions, typedefs, exceptions, `goto`, Python comprehensions/generators, and other unsupported constructs need simplification before generating a chart. Function overloading is rejected because call resolution requires type information. Indirect/function-pointer calls are not expanded into helper links.

To keep diagrams responsive, inputs are limited to 50,000 characters, 12,000 tokens, 20 functions, 500 flowchart steps, and 100 helper call links. Excessive nesting is rejected with a diagnostic.

If Python contains only function definitions, the chart labels its first function as a function root with no entry point; it does not imply that defining a function executes it.

## Checks

Requires Node.js 22 or later for the dependency-free regression suite:

```sh
node --test tests/core.test.cjs
```

The suite covers all built-in examples, valid and invalid syntax, language detection, control-flow context, combined function charts, recursive calls, and renderer isolation from the parsed program.

The browser interaction suite additionally requires Playwright and Chromium:

```sh
npm install --no-save playwright
npx playwright install chromium
node --test tests/ui.test.cjs
```

It checks keyboard navigation, contrast in both themes, short-window errors, long-file error positioning, Reset recovery, PDF loading/retry, stale-export protection, and mobile control sizing. External services are intercepted during these checks.

Tab and Shift+Tab move between controls; Ctrl/Command + ] inserts four spaces in the editor. Reset exposes a Restore action, and Ctrl/Command + Z also recovers the cleared source until the next edit or example selection.

The page loads its existing jsPDF CDN dependency only when PDF export is requested, with retry feedback if loading fails. Visit-counter/analytics services remain unchanged. Custom interface icons are inline SVG with no external icon library.
