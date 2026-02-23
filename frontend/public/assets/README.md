# SpringBank Frontend Assets

All assets in this directory are **self-contained SVG files** authored in-house for the SpringBank demo project.

## Asset Inventory

| File | Description |
|------|-------------|
| `logo.svg` | SpringBank wordmark with leaf/spring icon |
| `hero-banking.svg` | Abstract fintech hero illustration for landing/marketing pages |
| `dashboard-bg.svg` | Subtle geometric background pattern for dashboard views |
| `icons.svg` | SVG sprite containing all UI icons as `<symbol>` elements |

## Licensing & Usage Policy

- **No external CDNs** — all assets are served from this repository. No third-party font CDNs, image CDNs, or icon pack CDNs are used.
- **No unlicensed icon packs** — all icons are original vector artwork drawn for this project. They are not derived from FontAwesome, Material Icons, Heroicons, or any other third-party library.
- **No stock imagery** — illustrations are procedurally generated SVG shapes, not rasterised photos or licensed stock vectors.
- All SVG files are safe to inline directly into HTML; they contain no scripts, no external references (`xlink:href` to remote URLs), and no embedded raster images from external sources.

## Using the Icon Sprite

Reference an icon from `icons.svg` via the SVG `<use>` element:

```html
<svg width="24" height="24" aria-hidden="true">
  <use href="/assets/icons.svg#icon-transfer"></use>
</svg>
```

Available symbol IDs: `icon-account`, `icon-transfer`, `icon-deposit`, `icon-withdrawal`, `icon-security`, `icon-settings`, `icon-admin`, `icon-logout`.

## Contributing New Assets

1. Keep files self-contained — no `<image>` elements pointing to external URLs.
2. Optimise with [SVGO](https://github.com/svg/svgo) before committing (`npx svgo <file>`).
3. Use the SpringBank palette: `#00b4b4` (teal), `#0066cc` (blue), `#1a2332` (dark), `#f0f9ff` (light).
4. Update this README table when adding new files.
