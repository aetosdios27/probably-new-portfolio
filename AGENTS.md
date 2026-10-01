<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Design spacing

Read `docs/spacing.md` before changing layout spacing. Use the shared `--space-*` tokens for new or revised page spacing. Keep related content close and reserve larger gaps for boundaries between groups; do not use viewport-height spacers to make a short page look full.

## Motion quality

Read `docs/motion.md` before adding or changing animations. Use the shared motion/easing tokens, choose timing by purpose, preserve spatial origins, support interruption and reduced motion, and verify entry, held, exit, and rapid reversal states. Quiet, deliberate polish is the standard; do not add motion merely to fill space or demonstrate an effect.
