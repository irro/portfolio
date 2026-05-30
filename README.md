# Photography Portfolio

A lightweight framework for a photographer's portfolio website. It is built
with hand-authored, standards-compliant **HTML5 and CSS** and a small amount
of progressive-enhancement **JavaScript**, with **WCAG 2.1 AA** accessibility
and **Schema.org** structured data baked in. It is responsive from phones up
to 4K displays.

The core pages have **no dependencies**. The interactive globe on the map page
self-hosts one small library (`d3-geo`) plus an embedded world outline, so even
that makes **no external/CDN requests**.

There is no build step and no framework to learn — open the files, replace
the placeholder content, and deploy.

## What's included

```
portfolio/
├── index.html            # Home: hero, featured work, about teaser, services, CTA
├── gallery.html          # Full gallery with an accessible lightbox
├── globe.html            # Interactive globe / photo map by location
├── about.html            # About the photographer
├── contact.html          # Contact form + details
├── css/
│   └── styles.css         # Design tokens, layout, components, dark mode, globe, 4K
├── js/
│   ├── main.js            # Mobile nav toggle, lightbox, copyright year
│   ├── globe.js           # Interactive globe + location gallery modal
│   ├── globe-data.js      # GENERATED world land outline (do not edit by hand)
│   ├── build-globe-data.mjs  # Regenerates globe-data.js from the world-atlas package
│   └── vendor/            # Self-hosted d3-array + d3-geo (UMD) — no external CDN
├── images/
│   ├── favicon.svg        # Aperture logo / favicon
│   ├── hero.svg           # Hero background placeholder
│   ├── portrait.svg       # About-page portrait placeholder
│   ├── og-cover.svg       # Social-share image placeholder
│   ├── gallery-01..09.svg # Gallery image placeholders
│   └── generate-placeholders.mjs  # Regenerates the placeholders above
├── site.webmanifest       # PWA manifest
├── robots.txt             # Crawler directives
├── sitemap.xml            # XML sitemap
├── .htmlvalidate.json     # Optional html-validate config (see Validation)
└── README.md
```

## Preview locally

Because everything is static, any static file server works. For example:

```bash
# Python 3
python3 -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000>. Opening the HTML files directly with
`file://` also works, though a server better matches production.

## Customising the framework

The site ships with a sample identity — **"Alex Rivera Photography"** — so it
renders meaningfully out of the box. Replace it with your own. Look for
`TODO` comments in the HTML for the most important spots.

### 1. Name & branding

Search-and-replace across the `.html` files:

- `Alex Rivera` → your name
- `Alex Rivera Photography` → your business name
- Update the `<title>` and `<meta name="description">` on every page.

### 2. Your domain

The canonical URLs, Open Graph tags, structured data, `robots.txt` and
`sitemap.xml` all use `https://www.example.com`. Replace that placeholder
with your real domain everywhere (a project-wide find-and-replace is easiest).

### 3. Photos

Replace the SVG files in `images/` with your own photographs. Two options:

- **Keep the file names** (`gallery-01.svg` … `gallery-09.svg`,
  `hero.svg`, `portrait.svg`, `og-cover.svg`) — but use `.jpg`/`.webp` for real
  photos and update the `src`/`href` extensions in the HTML, or
- Use your own names and update the references in the HTML and `sitemap.xml`.

For each gallery image, update **four** things so it stays accessible and
indexable:

1. The `<img alt="…">` — a meaningful description of the photo.
2. The `<figcaption>` — the visible title and category.
3. The link's `data-caption` / `data-alt` — used by the lightbox.
4. The matching `ImageObject` entry in the `gallery.html` JSON-LD.

Add real intrinsic `width`/`height` attributes to every `<img>` to prevent
layout shift, and prefer `.webp`/`.avif` with a `.jpg` fallback for speed.

> Tip: the placeholders can be regenerated with
> `node images/generate-placeholders.mjs`.

### 4. Colours & fonts

All theming lives in the `:root` block at the top of `css/styles.css`. Change
the custom properties (e.g. `--color-accent`, `--font-display`) to re-skin the
whole site. A dark palette is provided automatically via
`@media (prefers-color-scheme: dark)`.

To use a web font, add its `<link>` to each page's `<head>` and update
`--font-body` / `--font-display`. The defaults are system-font stacks, so the
framework has zero external requests by default.

### 5. Social links

Replace the `https://www.instagram.com/example` style URLs in the footer of
each page **and** in the `sameAs` arrays in the JSON-LD.

### 6. Make the contact form work

`contact.html` contains a standard form with native HTML5 validation, but it
has no backend. Point its `action` at a form service or your own endpoint:

- **Formspree:** `action="https://formspree.io/f/your-id"` `method="post"`
- **Netlify Forms:** add the `netlify` attribute to the `<form>`.
- **Your own API:** set `action` to your endpoint.

After wiring it up, consider showing a success/error message on submit.

### 7. Social share image

`og-cover.svg` is referenced by the Open Graph / Twitter tags. Some platforms
do not render SVG share images — for best results, export a **1200×630 JPG or
PNG** and update the `og:image` / `twitter:image` URLs.

## The map / globe page

`globe.html` shows an interactive 3D-looking globe (an orthographic projection
rendered with `d3-geo`) with a marker at every photo location. Drag to rotate,
scroll/pinch to zoom, and the `+` / `−` / **Reset** buttons also control it.
Activating a marker — or a button in the **All locations** list — opens an
accessible `<dialog>` gallery of that place's photos.

### Adding or editing locations

The locations are **read straight from the markup** in `globe.html`, inside the
`<div data-locations>` block, so that block is the single source of truth (and
the no-JavaScript fallback). To add a place, copy a `<section class="location">`
and edit:

- `data-lat` / `data-lng` — the coordinates in decimal degrees (north and east
  positive; south and west negative).
- `<h2 class="location__name">` — the place name shown on the marker and modal.
- the `<ul class="gallery">` — one `<li class="gallery__item">` per photo (add
  `gallery__item--portrait` for tall images). These are normal gallery figures.

The globe markers, the index list and the modal are all generated from those
sections — there is nothing else to keep in sync. (Optionally mirror new places
in the `ItemList` JSON-LD for richer search results.)

### The world map data

`js/globe-data.js` is a **generated** file containing the world land outline
(Natural Earth 110m, from the `world-atlas` npm package). To regenerate it:

```bash
npm i -D world-atlas topojson-client
node js/build-globe-data.mjs
```

`js/vendor/` holds the self-hosted `d3-array` and `d3-geo` builds. Nothing is
loaded from a CDN. Without JavaScript, the globe is skipped and the location
galleries are shown as normal sections.

## Responsive design

Every page is fluid from small phones up to 4K monitors:

- A fluid type scale (`clamp()`) and intrinsic `auto-fill` grids mean galleries
  add columns as space allows, with no fixed breakpoints to fight.
- The navigation collapses into a toggle menu below ~768px.
- Wide-screen breakpoints at **100rem** and **160rem** widen the content
  container and nudge base font size up so 4K displays aren't mostly margin.
- The globe sizes itself to its container via `ResizeObserver`, and the photo
  galleries reflow to a single column on phones.

Test quickly with your browser's device toolbar (responsive mode) at, e.g.,
375px (phone), 768px (tablet), 1440px (HD) and 2560px+ (4K).

## Accessibility features

- Semantic landmarks (`header`, `nav`, `main`, `footer`) and one `<h1>` per page.
- A "Skip to main content" link as the first focusable element.
- Keyboard-operable mobile menu with `aria-expanded` / `aria-controls`, and
  Escape-to-close.
- `aria-current="page"` on the active navigation and breadcrumb items.
- Visible `:focus-visible` outlines on all interactive elements.
- An accessible lightbox built on the native `<dialog>` element (focus
  trapping, Escape-to-close, focus returned to the trigger).
- Descriptive `alt` text on every image; decorative SVGs use `aria-hidden`.
- A labelled contact form with hints wired up via `aria-describedby`.
- Colour contrast meets WCAG 2.1 AA in both light and dark schemes.
- Honours `prefers-reduced-motion` and `prefers-color-scheme`.
- On the map page, every globe marker is a focusable `role="button"`, and the
  **All locations** list gives a keyboard- and screen-reader-friendly path to
  the same galleries.

The site is fully usable with JavaScript disabled: the navigation stays
visible, gallery thumbnails open the full image directly, and the map page
falls back to listing every location with its photos.

## Structured data (Schema.org / JSON-LD)

Each page embeds a JSON-LD `@graph` so search engines understand the content:

| Page           | Types |
| -------------- | ----- |
| `index.html`   | `WebSite`, `ProfessionalService`, `Person` |
| `gallery.html` | `ImageGallery` + `ImageObject` (with licensing metadata), `BreadcrumbList` |
| `globe.html`   | `CollectionPage`, `ItemList` of `Place` (+ `GeoCoordinates`), `BreadcrumbList` |
| `about.html`   | `AboutPage`, `Person`, `BreadcrumbList` |
| `contact.html` | `ContactPage`, `ProfessionalService` + `ContactPoint`, `BreadcrumbList` |

Entities are linked by stable `@id` references. After deploying, validate with
the [Schema Markup Validator](https://validator.schema.org/) and Google's
[Rich Results Test](https://search.google.com/test/rich-results).

## Validation

The markup validates against the W3C HTML specification. If you'd like to
lint it yourself:

```bash
npx html-validate index.html gallery.html globe.html about.html contact.html
```

A small `.htmlvalidate.json` ships with the project. It disables the
`no-redundant-role` and `prefer-native-element` rules because the lists use
`role="list"` **on purpose**: when `list-style: none` is applied, Safari +
VoiceOver stop announcing the element as a list, and the explicit role
restores that semantic. Strict linters flag the role as redundant, but the
accessibility benefit is real, so the rules are turned off rather than the
roles removed.

## Deploying

No server-side runtime is required — host the folder anywhere static.

### GitHub Pages (included)

A ready-to-use workflow ships at `.github/workflows/deploy-pages.yml`. To turn
it on:

1. In the repository, go to **Settings → Pages → Build and deployment** and set
   **Source** to **GitHub Actions**.
2. Push to the default branch (`main`) — merge this branch into `main` if you
   developed on a feature branch. The workflow then builds and deploys the site
   automatically (you can also trigger it from the **Actions** tab).

The `.nojekyll` file disables Jekyll processing so every file is served as-is.

> Prefer no workflow? You can instead use **Settings → Pages → Deploy from a
> branch**, pick your branch and the `/ (root)` folder.

### Other hosts

Netlify, Cloudflare Pages, Vercel, or any web server / object storage all work
— just upload the folder.

## License

You are free to use this framework as the starting point for your own
portfolio. Replace the placeholder content and photographs with your own.
