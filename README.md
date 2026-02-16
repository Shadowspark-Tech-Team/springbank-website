# Spring Bank – Production-Ready Banking Website

A Chase.com-parity static banking website built with semantic HTML5, CSS custom properties, and vanilla JavaScript. Zero dependencies. One-click deployable to Netlify or Vercel.

---

## Project Structure

```
SPRING/
├── index.html          # Personal banking homepage
├── business.html       # Business banking homepage
├── signin.html         # Dedicated sign-in page
├── atm-branch.html     # ATM & branch locator
├── contact.html        # Contact Us page
├── help.html           # FAQ & Help Center
├── privacy.html        # Privacy Policy
├── security.html       # Security Policy
├── terms.html          # Terms of Use
├── 404.html            # Custom 404 error page
├── es/
│   └── index.html      # Spanish personal homepage
├── styles.css          # Main design system (Chase-parity)
├── signin.css          # Sign-in page styles
├── main.js             # All interactivity
├── sitemap.xml         # XML sitemap
├── robots.txt          # Search engine directives
├── netlify.toml        # Netlify deployment config
├── vercel.json         # Vercel deployment config
└── README.md           # This file
```

---

## Features

### Chase.com Feature Parity
- **Brand bar** — Personal / Business / Commercial segment switcher with active state
- **Utility nav** — ATM & Branch, Contact Us, Help, Español links
- **Mega-menus** — Hover/click dropdowns for Checking & Savings, Credit Cards, Mortgages, Investing
- **Hero carousel** — Multi-slide with auto-rotate, pause on hover, touch swipe, keyboard nav, ARIA live region
- **Stats bar** — Key numbers at a glance
- **Product cards** — 6-column grid with hover lift effects
- **Why section** — Alternating image/text layout blocks
- **Quad tile grid** — Featured products with overlay text
- **Industry solutions** — 5-item grid with SVG icons (business page)
- **Solution Advisor** — Interactive finder with 9 recommendation profiles
- **FAQ Accordion** — Keyboard-accessible, ARIA-compliant
- **Sign-in modal** — Focus trap, ESC close, form validation, backdrop click to dismiss
- **Full-page sign-in** — Two-panel layout with loading spinner
- **Expanded footer** — 5 columns: brand + 4 link categories + social icons + FDIC/EHL badges
- **Español page** — Bilingual support with hreflang links

### Accessibility (WCAG 2.1 AA)
- Skip to main content link
- `lang` and `dir` attributes on all pages
- Semantic HTML5 (`header`, `nav`, `main`, `section`, `article`, `footer`)
- All interactive elements have visible focus indicators
- `aria-label`, `aria-expanded`, `aria-haspopup`, `aria-controls`, `aria-live` throughout
- Carousel with `aria-roledescription="carousel"` and live announcements
- Color contrast ratios meet AA minimum (4.5:1 text, 3:1 UI components)
- Keyboard navigation for all components
- `alt` text on all meaningful images; decorative images have `alt=""`

### Performance
- Google Fonts loaded with `preconnect` hints
- All below-fold images have `loading="lazy"`
- Intersection Observer scroll-reveal for cards and sections
- CSS custom properties for consistent theming without repetition
- Minification-ready (no transpilation needed — ES5-compatible main.js)

### SEO
- Unique `<title>` and `<meta name="description">` on every page
- Open Graph and Twitter Card tags on main pages
- JSON-LD LocalBusiness structured data on homepage
- `sitemap.xml` with `lastmod`, `changefreq`, `priority`, and hreflang links
- `robots.txt` with sitemap reference
- `<link rel="canonical">` on every page
- `hreflang="en"` / `hreflang="es"` alternate links

### Security
- `Content-Security-Policy` meta tag on all pages
- `X-Content-Type-Options: nosniff` meta tag
- `X-Frame-Options: DENY` meta tag
- Security headers enforced via `netlify.toml` / `vercel.json`
- HSTS with 1-year max-age + includeSubDomains + preload
- Forms do not submit to any backend (static site)

---

## Deploy

### Netlify (Recommended)
```bash
# Option 1: Netlify CLI
npm install -g netlify-cli
netlify deploy --dir=. --prod

# Option 2: Drag & drop
# Go to app.netlify.com → Add new site → Deploy manually
# Drag the SPRING folder into the upload zone
```

### Vercel
```bash
npm install -g vercel
vercel --prod
```

### GitHub Pages
1. Push this folder to a GitHub repository
2. Go to Settings → Pages → Source: main branch / root
3. Your site will be live at `https://username.github.io/repo-name/`

---

## Customization

### Replace placeholder content
- **Analytics:** Replace `GA_MEASUREMENT_ID` in each HTML file with your Google Analytics 4 ID
- **Phone numbers:** Replace `1-800-SPRING-1` with real contact numbers
- **Domain:** Replace `springbank.com` in `sitemap.xml`, `robots.txt`, and canonical URLs
- **Images:** Unsplash images are placeholders — replace with owned/licensed images for production
- **Colors:** Edit CSS variables in `styles.css` `:root` block

### Add real authentication
The sign-in form is static (no backend). To add real auth:
- Integrate with Supabase Auth, Auth0, AWS Cognito, or similar
- Replace the form's `submit` handler in `main.js` with a real API call

### Add real ATM/branch map
Replace the map placeholder in `atm-branch.html` with:
- Google Maps JavaScript API, or
- Mapbox GL JS

---

## Browser Support
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Responsive: 320px – 2560px
- Tested on iOS Safari and Android Chrome

---

## License
This is a demonstration project. All Spring Bank branding, copy, and design is fictional. Unsplash images are used under the Unsplash License. Do not use for commercial purposes without replacing all placeholder content.
