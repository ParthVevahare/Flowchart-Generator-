# Search discovery and sitemap operations

Canonical homepage: https://parthvevahare.github.io/Flowchart-Generator-/

Canonical sitemap: https://parthvevahare.github.io/Flowchart-Generator-/sitemap.xml

## Search Console: avoid a doubled slash

The property URL may already end in `/Flowchart-Generator-/`. In that case,
enter **`sitemap.xml`** in the Add a new sitemap field, **without a leading
slash**. The resulting complete URL must be:

```text
https://parthvevahare.github.io/Flowchart-Generator-/sitemap.xml
```

Do not enter `/sitemap.xml` after that prefix; it produces
`/Flowchart-Generator-//sitemap.xml`. If the field displays only the hostname
prefix, enter `Flowchart-Generator-/sitemap.xml` without a leading slash.
For a domain property with a full-URL field, paste the complete canonical URL.
Inspect the combined URL before submitting.

For an existing double-slash entry, remove that entry from Search Console and
submit the correct URL. Removing a sitemap report does not delete site content.
Use the already verified property and the existing verification file; do not
create a replacement property or regenerate verification tokens.

On 8 November 2026 the canonical live sitemap returned HTTP 200 and
`Content-Type: application/xml`; the hostname-root robots.txt returned 404,
with no `X-Robots-Tag` blocking the sitemap. The reported Search Console URL
contained a doubled slash. A subsequent fetch of that exact double-slash URL
also returned HTTP 200 XML without a redirect. Use the canonical single-slash
submission, but do not claim the extra slash conclusively caused Google's
fetch failure: that failure was not reproduced by either HTTP check. If the
canonical submission still says Could not fetch, check Search Console's last
read timestamp and detailed error, then use URL Inspection and the live health
check to distinguish a transient Google fetch from a current hosting problem.
These checks do not prove Google's next fetch or indexing result.

## Public content and keyword coverage

The sitemap contains 11 canonical URLs: the homepage, privacy and terms pages,
the guide index, and seven distinct articles:

| Guide | Relevant search intent |
| --- | --- |
| Python to flowchart | Python code to flowchart, Python if/else and loop visualization |
| C to flowchart | C program flowchart, factorial flowchart, C lab-report diagrams |
| C++ to flowchart | C++ flowchart converter, cin/cout program logic |
| Java to flowchart | Java main-method flowchart, Java loops and method panels |
| Loops and decisions | for/while/do-while flowcharts, break, continue, control flow |
| Algorithms and pseudocode | code to algorithm, step-by-step program explanation, pseudocode output |
| Export and settings | SVG/PNG/PDF flowcharts, A4 diagrams, themes and layout controls |

Each article has original educational content, a supported source example,
FAQs, related links, and a link that loads its example in the generator.
Examples are checked against the real parser. They are not executed. Copy
describes the structured language subset honestly and distinguishes diagrams
from runtime traces, UML, arbitrary pseudocode conversion and AI inference.

The homepage keeps the workspace prominent while exposing language-guide links
and a compact visible description. No hidden keyword blocks, doorway clones,
invented ratings/reviews, or unsupported language claims are added. Google does
not use the meta keywords tag; relevant search language belongs in useful page
content, titles, descriptions and links. No ranking or indexing guarantee is made.

All public pages have unique metadata and absolute canonicals. Guide Article
and BreadcrumbList schema describe the actual content and navigation. They do
not claim FAQ rich-result eligibility. The homepage retains WebSite and
WebApplication schema. Social cards reuse assets/logo-light.png. Example query
parameters and fragments are excluded from canonical URLs and the sitemap.

## Static generation and validation

The editorial source is scripts/guide-content.cjs. Run:

```sh
npm run build:guides
npm run check:guides
npm run check:sitemap
npm test
npm run test:ui
```

Generation writes the seven guide articles, index, local example fixtures and
sitemap. Generated files are committed because this site deploys static files
from main. Check mode detects stale generated output. Sitemap checks reject
malformed structure, duplicate URLs, doubled path slashes, off-site URLs,
missing pages and canonical mismatches. Browser tests independently parse XML
with DOMParser, visit links under the project base path, inspect metadata with
JavaScript disabled and load guide examples through the actual editor.

After deployment run:

```sh
npm run check:sitemap:live
```

This fetches the exact canonical sitemap without accepting a redirect, requires
HTTP 200 and an XML content type, compares all 11 entries, and fetches each
listed page to confirm HTTP 200 and canonical agreement. The Published sitemap
health GitHub workflow runs after successful github-pages deployments and can
also be triggered manually. It is a deployment check, not a crawler submission.
Before these changes deploy, the live sitemap may still contain the old three
entries; the live check correctly fails if the deployment is stale.

## GitHub Pages and robots.txt

This is a project site. Crawlers read robots rules at
https://parthvevahare.github.io/robots.txt, not inside the project directory.
A project-level robots file cannot repair a Search Console URL or change
hostname-root crawl rules, so none is added. If the separate hostname-root
repository later supplies robots.txt, preserve its other projects' rules and
optionally add the full canonical sitemap URL there. Search Console accepts
a direct sitemap submission without that line.

Preserve the Analytics initializer G-8VGN06RJCS and the original
`googlefde98e9521e001da.html` verification content. No DNS, domain, Pages source,
Firebase rules, legal policies or account data needs to change for this work.

## After the correct submission

Wait for Search Console to fetch the sitemap, then review any reported errors.
Use URL Inspection on the canonical homepage and representative guide URLs to
check the live rendered page and request indexing when eligible. Do not submit
private library records, example-query variants or the verification file.
Monitor impressions and queries in Performance over time; a successful fetch
does not guarantee indexing or rankings. Field Core Web Vitals require real
traffic data and are not established by local browser tests.

Official references:
- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://support.google.com/webmasters/answer/7451001
- https://developers.google.com/search/docs/crawling-indexing/robots/intro
