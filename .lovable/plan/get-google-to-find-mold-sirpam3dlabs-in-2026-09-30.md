# Get Google to find mold.sirpam3dlabs.in

Status key: DONE = already in place, NOW = I fix in this round, YOU = needs you, SKIP = not worth doing.

## Checklist

| # | Item | Status | What happens |
|---|---|---|---|
| 1 | Pages built on the server | DONE | Google already gets full page content. |
| 2 | sitemap.xml | DONE | Lists every public page and guide automatically. |
| 3 | robots.txt lets Google in | DONE | Only private pages (account, admin, checkout, sign-in) are blocked. |
| 4 | No "noindex" tag | DONE | Confirm with a scan. |
| 5 | No redirect chains | DONE | Confirm with a scan. |
| 6 | Titles and descriptions per page | DONE | Re-check every page, fill gaps. |
| 7 | Broken links / 404s | NOW | Crawl every link on every page and fix dead ones. |
| 8 | One main heading per page | NOW | Check each page; add or fix where missing or doubled. |
| 9 | Canonical tag per page | NOW | Each public page points to itself. |
| 10 | Breadcrumbs | NOW | Visible trail + search breadcrumb data on guide pages and deeper pages. |
| 11 | Orphan pages | NOW | Make sure guides, shop, help, about are linked from header, footer or home. |
| 12 | Image descriptions (alt text) | NOW | Every image gets a plain description; decorative ones marked as such. |
| 13 | WebP images + reserved image space | NOW | Convert any remaining large images; give images fixed sizes so the page doesn't jump. |
| 14 | Author bio | NOW | Short "About Sirpam 3D Labs" bio on About and guide pages, plus organisation info for Google. |
| 15 | Wording accuracy review | NOW | List made-up details (materials, print size, prices, reply time) for you to confirm. |
| 16 | Publish the site | YOU | Press Publish (or ask me to). |
| 17 | Connect mold.sirpam3dlabs.in | YOU | Project Settings → Domains, then add the record at your domain provider. |
| 18 | Submit sitemap to Search Console | NOW after 16–17 | I verify ownership and submit once the site is live. |
| 19 | Speed under 2s, layout shift | NOW after 16 | Measure on the live site, fix what's slow. |
| 20 | Link from sirpam3dlabs.in | YOU | Add a "Design a mold" link on your main site — your best real backlink. |
| 21 | FAQ schema | SKIP | Google no longer shows it for most sites. |
| 22 | "Remove AI content" | SKIP | Replaced by #15 — accuracy matters, not authorship. |
| 23 | Forbes backlink | SKIP | Only comes from press/PR, can't be built. |

## Order

```text
Round 1 (now):      7-15, then a full SEO scan
Round 2 (you):      16, 17, 20
Round 3 (after live): 18, 19, final checklist report
```

## Technical details

- Canonical and og:url use relative paths on each leaf route head(); none on __root.
- BreadcrumbList JSON-LD in guides.$slug head() scripts; visible breadcrumb component.
- Organization JSON-LD on index; author block on about and guides.
- Link crawl via Playwright over sitemap paths; images get width/height and loading="lazy" below the fold.
- Sitemap submission uses the Search Console connector against the verified property.
