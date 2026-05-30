# Photography Portfolio

A lightweight, dependency-free framework for a photographer's portfolio
website. It is built with hand-authored, standards-compliant **HTML5 and
CSS**, a small amount of progressive-enhancement **JavaScript**, and ships
with **WCAG 2.1 AA** accessibility and **Schema.org** structured data baked
in.

There is no build step and no framework to learn — open the files, replace
the placeholder content, and deploy.

## What's included

```
portfolio/
├── index.html            # Home: hero, featured work, about teaser, services, CTA
├── gallery.html          # Full gallery with an accessible lightbox
├── about.html            # About the photographer
├── contact.html          # Contact form + details
├── css/
│   └── styles.css         # Design system (tokens), layout, components, dark mode
├── js/
│   └── main.js            # Mobile nav toggle, lightbox, copyright year
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

The site is fully usable with JavaScript disabled: the navigation stays
visible and gallery thumbnails open the full image directly.

## Structured data (Schema.org / JSON-LD)

Each page embeds a JSON-LD `@graph` so search engines understand the content:

| Page           | Types |
| -------------- | ----- |
| `index.html`   | `WebSite`, `ProfessionalService`, `Person` |
| `gallery.html` | `ImageGallery` + `ImageObject` (with licensing metadata), `BreadcrumbList` |
| `about.html`   | `AboutPage`, `Person`, `BreadcrumbList` |
| `contact.html` | `ContactPage`, `ProfessionalService` + `ContactPoint`, `BreadcrumbList` |

Entities are linked by stable `@id` references. After deploying, validate with
the [Schema Markup Validator](https://validator.schema.org/) and Google's
[Rich Results Test](https://search.google.com/test/rich-results).

## Validation

The markup validates against the W3C HTML specification. If you'd like to
lint it yourself:

```bash
npx html-validate index.html gallery.html about.html contact.html
```

A small `.htmlvalidate.json` ships with the project. It disables the
`no-redundant-role` and `prefer-native-element` rules because the lists use
`role="list"` **on purpose**: when `list-style: none` is applied, Safari +
VoiceOver stop announcing the element as a list, and the explicit role
restores that semantic. Strict linters flag the role as redundant, but the
accessibility benefit is real, so the rules are turned off rather than the
roles removed.

## Deploying

Upload the folder to any static host — GitHub Pages, Netlify, Cloudflare
Pages, Vercel, or plain object storage / a web server. No server-side runtime
is required.

## License

You are free to use this framework as the starting point for your own
portfolio. Replace the placeholder content and photographs with your own.
