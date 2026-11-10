<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Design spacing

Read `docs/spacing.md` before changing layout spacing. Use the shared `--space-*` tokens for new or revised page spacing. Keep related content close and reserve larger gaps for boundaries between groups; do not use viewport-height spacers to make a short page look full.

## Motion quality

Read `docs/motion.md` before adding or changing animations. Use the shared motion/easing tokens, choose timing by purpose, preserve spatial origins, support interruption and reduced motion, and verify entry, held, exit, and rapid reversal states. Quiet, deliberate polish is the standard; do not add motion merely to fill space or demonstrate an effect.

## Link behavior

Use `EditorialLink` and `LinkLabel` from `src/components/editorial-link.tsx` for ordinary content links. The default is a subtle dashed underline at rest, a solid swipe that grows and retracts from the same left origin, and a northeast arrow visible only on hover or keyboard focus. Share this behavior rather than inventing a new effect per section. Back links (a label that already starts with ←, or "Back to…") pass `arrow={false}` to `LinkLabel`: the northeast arrow means "leaves this page" and contradicts a back arrow. Preserve reduced motion, immediate keyboard focus, stable hit areas, and interruption. Compact navigation and the intentionally bespoke Playground word retain their established treatments; do not spread pixelation or multicolor trails to other links.

## Open-source feed

Qualifying organizations are explicitly curated in `src/lib/open-source-policy.ts`; never expand this feed to all personal/friend/startup PRs or use activity volume as a quality signal. Display at most seven contributions, one per repository, selecting merged first and at most one open PR, then sort the selected list newest first. GitHub data is fetched only on the server and revalidated hourly. Keep credentials out of client code and use the verified snapshot if the API is unavailable.

## Theme

Light and dark share one design. All colour lives in tokens in `src/app/globals.css`, defined for `:root[data-theme="dark"]` (also the bare `:root`, so a page without JavaScript stays dark) and `:root[data-theme="light"]`; never hardcode a colour in a component. Author an accent once as `--accent-source` (the luminous hue made for the black canvas) and paint with `--accent`, which each theme derives from it; an element that sets its own source adds the global `accent-scope` class so `--accent` re-derives there. `PageFrame` does this for page and project hues, and the homepage accent follows `html[data-season]`. `dither-themes.test.ts` reads `--accent-light-l`/`--accent-light-c` and checks 4.5:1 in both themes; use `atLightness` from `src/lib/color.ts` when JavaScript needs the same derivation (the gutter dither). Read and change the theme only through `src/lib/theme.ts` (`currentTheme`, `setTheme`, `onThemeChange`, `followSystemTheme`, `THEME_BACKGROUND`); never touch `data-theme` or the storage key elsewhere. Anything that must be right on first paint, like the dock switch's icon, is driven by CSS on `html[data-theme]`, not React state. `?theme=light|dark` previews a theme without storing it. On paper the section bands stop at the rails instead of crossing the whole canvas, so backdrops in the gutters (the pond, the gutter dither) run unbroken from top to bottom; on black the full-width bands stay, because there they vanish into the page and read as windows.
