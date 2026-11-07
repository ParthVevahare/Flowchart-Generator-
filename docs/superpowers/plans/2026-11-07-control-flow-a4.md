# Control flow and A4 implementation plan

> Execute inline using the executing-plans skill. User approved preserving parsers and replacing the graph/layout pipeline on 2026-11-07.

**Goal:** Generate accurate, compact flowcharts and sharp A4 exports with direct SVG copying.

**Architecture:** Keep the existing validated C/C++, Java and Python statement AST. Build a separate control-flow graph with explicit successors, prune unreachable nodes, validate graph contracts, then pass it to a locally bundled ELK layered layout engine. Render vector shapes and orthogonal connectors, and fit uniformly inside A4 margins.

**Tech stack:** Browser JavaScript, ELK, SVG, Canvas, existing jsPDF, node:test, Playwright.

**Spec:** User request in this chat and approved approach. Preserve existing source, algorithms, pseudocode, library behavior, and supported language scope. Reject unsupported constructs rather than inventing paths.

## Global constraints
- No parser rewrite or unrelated interface redesign.
- Semantic edges are independent of coordinates; return has no fallthrough, continue targets the correct loop phase, break targets the nearest loop/switch exit.
- Standard shapes, bounded text wrapping, consistent semantic colors and explicit Yes/No labels.
- A4 portrait 210 by 297 mm, uniform scaling, 10 mm margins, PNG 2480 by 3508 pixels, direct SVG text copy.
- Single-page fit can make very large programs small; never distort shapes or delete logic to fit.

## Review focus
- Empty and unconditional loops: no invented exit or skipped do body.
- Nested switch/loop abrupt transfers: nearest break and enclosing-loop continue.
- Shared destinations and early returns: no duplicated continuation or unreachable output.
- Async layout after source changes: stale result must never replace the new chart.
- Long labels and many helper functions: no unbounded node width or horizontal strip.

## Task 1: Semantic graph
- [x] Write failing graph tests for branch joins, grouping, for/while/do, nested break/continue/return, empty bodies, constant predicates, switch fallthrough, entry points and AST immutability.
- [x] Implement FlowGraph.build(program) and FlowGraph.validate(graph) in flowchart.js.
- [x] Run node --test tests/flowchart.test.cjs; inspect every failure.

## Task 2: Automatic layout and rendering
- [x] Write failing geometry and A4/export contract tests.
- [x] Bundle pinned ELK with license, implement FlowGraph.layout(graph), replace legacy positioning with async buildProgram, retain helper references as annotations rather than execution edges.
- [x] Update core tests to await layout, run npm test.

## Task 3: A4 exports and UI
- [x] Add failing browser tests for PNG dimensions, SVG aspect ratio/copy, and stale generation.
- [x] Implement uniform A4 framing, 300-DPI PNG, A4 PDF, explicit Copy SVG with existing clipboard fallback.
- [x] Run core and browser suites; inspect desktop/mobile and representative diagrams visually.

## Task 4: Review and delivery
- [x] Review graph contracts and rendering with independent reviewer; fix substantive issues and rerun affected suites.
- [x] Package source and patch as deliverables; report verification and any limitations. No merge or deployment without authorization.

## Ledger
- Baseline: 92 core/library tests passed; clean checkout at 125b02c.
- Ruling: reuse clean existing checkout on feature branch improve-control-flow-a4, following app preference to reuse a suitable checkout.
- Ruling: user's “Do it” approves the proposed approach and continued implementation; no repeated design/plan approval.

- Tasks 1–4 complete: 108 core/graph/library tests and 24 browser tests passed. Six built-in layouts checked with zero node overlaps or connectors through node interiors. Desktop/mobile and A4 PNG inspected visually.
- Independent review found language-specific boolean folding, self-loop attachment and long heading overflow; all three reproduced in failing tests, corrected and verified.
- Ruling: ELK forceNodeModelOrder was removed after reproduction showed it could flip fixed ports and route feedback through nodes; semantic model order remains a preference while geometry can minimize crossings.
- PNG exports include 11811 pixels/metre density (300 DPI), SVG has physical A4 dimensions, and PDF uses uniform scaling of the same high-resolution page.
