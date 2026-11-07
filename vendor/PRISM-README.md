# PrismJS 1.30.0

`prism-code.js` concatenates the unmodified minified `core`, `clike`, `c`, `cpp`,
`java` and `python` components from `prismjs@1.30.0`, preceded by a browser-only
configuration enabling manual highlighting. No automatic DOM highlighting or
worker message handling runs. It is bundled locally for GitHub Pages.

Source: https://github.com/PrismJS/prism/tree/v1.30.0
Package: https://www.npmjs.com/package/prismjs/v/1.30.0
License: MIT; see PRISM-LICENSE.
Package tarball SHA-1: d9709969d9d4e16403f6f348c63553b19f0975a9

The source editor calls the pure wrapper in `code-colors.js`; grammar changes
must pass its unit tests and the browser typing/scroll/contrast checks.
