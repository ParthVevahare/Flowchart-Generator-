# Search discovery and deployment

Canonical homepage: https://parthvevahare.github.io/Flowchart-Generator-/

Sitemap: https://parthvevahare.github.io/Flowchart-Generator-/sitemap.xml

## Public URLs

The sitemap contains the homepage, `privacy.html` and `terms.html`. The directory URL is canonical; `index.html`, fragments, the Google verification file and private library records are not sitemap entries. There are no separate login/account routes. My Codes loads account-scoped data through Firebase and must continue to use the existing Firestore access rules. Robots directives are not an access-control mechanism.

All three public pages have unique titles/descriptions, absolute canonical URLs, indexing directives, Open Graph and Twitter card tags. Social cards reuse `assets/logo-light.png` (1024 × 1024). The homepage contains a short, three-step help dialog with SVG explanations, opened using How to use, plus WebSite and WebApplication JSON-LD. Help content is present in the initial HTML; the dialog is closed until requested. No ratings, reviews, company information, breadcrumb hierarchy or prices are invented. Free use is described by `isAccessibleForFree`; this does not promise eligibility for Google's software rich results.

Keep the existing `G-8VGN06RJCS` Analytics initializer and `googlefde98e9521e001da.html` verification file. Do not add another Analytics loader or verification method. Legal-page policy text has not been changed by this SEO update.

## GitHub Pages and robots

This repository is a project site, not the root of `parthvevahare.github.io`. Google reads robots rules at **https://parthvevahare.github.io/robots.txt**, not at `/Flowchart-Generator-/robots.txt`. No misleading project-level robots file is added. The hostname-root robots URL returned 404 when checked on 7 November 2026; it therefore supplied no crawl restrictions at that time. Check it again after deployment and if the separate hostname-root site ever changes.

If the owner later manages robots.txt in the separate hostname-root repository, preserve any rules needed by its other sites and optionally add:

```text
Sitemap: https://parthvevahare.github.io/Flowchart-Generator-/sitemap.xml
```

The sitemap can be submitted directly to Search Console without that line. Do not disallow CSS, JavaScript or assets needed to render the public pages. No domain, DNS, Firebase or Pages configuration changes are needed for this update. The existing successful Pages workflow deploys from `main`; merge the reviewed changes there and wait for **pages build and deployment** to succeed. No application build step is required.

## Post-deployment checks

1. Confirm the homepage, both policy pages, sitemap and `assets/logo-light.png` return HTTP 200 over HTTPS under `/Flowchart-Generator-/`.
2. View the homepage source and confirm the new title, canonical link, JSON-LD and help dialog are present. Check that no HTTP `X-Robots-Tag: noindex` or blocking hostname-root robots rule has appeared.
3. Confirm the existing Google verification file still returns its original content.
4. Generate a chart, test export, and check Google Sign-In and an existing saved program with your own account. Automated tests use isolated fixtures/emulators, not your production account.
5. Review Core Web Vitals in Search Console when sufficient real-user data is available. Local layout and interaction tests do not establish field LCP, INP or CLS scores. GitHub Pages controls HTTP caching; there is no unsupported cache-header configuration in this repository.

## Submit to the existing Search Console property

1. Open [Google Search Console](https://search.google.com/search-console) and select the already verified property covering the exact homepage URL. Do not create a replacement property.
2. Open **Sitemaps**. In **Add a new sitemap**, submit `https://parthvevahare.github.io/Flowchart-Generator-/sitemap.xml`. If the field already displays the project URL prefix, enter only `sitemap.xml`; if it displays only the hostname prefix, enter `Flowchart-Generator-/sitemap.xml`. Check the complete submitted URL before submitting.
3. Wait for **Success** and inspect any reported fetch/parsing errors. The sitemap lists three canonical URLs.
4. Paste `https://parthvevahare.github.io/Flowchart-Generator-/` into **URL Inspection**. Choose **Test live URL**, review crawl/indexing availability and the rendered page, then choose **Request indexing** if eligible. An owner or full user is required.
5. Later, check the indexed URL's Google-selected canonical, Page indexing report and Performance report. A successful live test and sitemap submission do not guarantee indexing or rankings; repeated requests do not make Google crawl faster.

Official references: [sitemap submission](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [URL Inspection and recrawl requests](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl), [robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro).

## Verification commands

Use the versions pinned by `package-lock.json`, Node.js 24 and Java 21 or later:

```sh
npm ci
npx playwright install chromium
npm test
npm run test:ui
npm run test:rules
```

The browser suite includes `tests/seo.test.cjs`: JavaScript-disabled content, metadata, XML/JSON-LD parsing, canonical agreement, base-path links/assets, help opening, step navigation, Escape/focus behavior and a popup that fits mobile/landscape screens without scrolling. Static checks disable page JavaScript; interactive checks intercept external requests so automated runs do not affect production Analytics or the visit counter. Existing library tests exercise sign-in transitions, autosave, recovery and account switching with fixtures; Firestore tests verify access rules using an isolated demo project.
