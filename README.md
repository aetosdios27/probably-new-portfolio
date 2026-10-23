# aetos — Portfolio

An editorial portfolio built with Next.js App Router, React, TypeScript, Tailwind v4, and Bun. The personal About composition lives at `/`; `/about` redirects home. Playground lives at `/playground`, with foundations for `/dispatches`.

## Develop

```sh
export PATH="$HOME/.bun/bin:$PATH"
bun install
bun run dev
```

Open http://localhost:3000.

```sh
bun run lint
bun run typecheck
bun run build
bun run start
```

Set `NEXT_PUBLIC_SITE_URL` (for example `https://aetosdios.xyz`) in deployment. It drives `metadataBase`, canonical URLs, the sitemap, and robots; without it, the build falls back to `https://aetosdios.xyz`.

Playground project data builds from the committed `src/data/projects.generated.json` snapshot. The open-source section can call GitHub during a build when `GITHUB_TOKEN` is configured. To refresh that snapshot, run `bun run projects:generate` manually (optionally with `GITHUB_TOKEN` set for higher API limits), then commit the result.

## Design foundation

The background is fixed at `#0E0E0E`. Tokens, the centered 760px content column, spacing, responsive layouts, hover states, and reduced-motion behavior live in `src/app/globals.css`.

Inter Tight is self-hosted through `next/font/local`. The variable font and its OFL license are in `src/assets/fonts/`; builds do not need Google Fonts network access. Icons come from React Icons (Font Awesome brand icons and Lucide utility icons).

## Content

- `src/content/portfolio.ts`: identity, the homepage highlight shortlist (`highlightProjects`), and the editorial open-source descriptions (`openSource`, read by `src/lib/open-source.ts`). Contact links are not here; they live in the `CONTACT` object in `src/components/socials-dock.tsx`.
- `src/lib/open-source-policy.ts`: qualifying organization allowlist, merged-first selection, one-PR-per-repository limit, and newest-first ordering.
- `src/lib/open-source.ts`: server-only authored-PR feed, cached after validation and refreshed hourly on visits. It traverses the public authored history with GraphQL cursors, then applies the curated policy; adding PRs to an approved organization requires no code changes. New organizations must be approved in `src/lib/open-source-policy.ts`. `GITHUB_TOKEN` is required for live GraphQL refreshes and must stay server-only. Failed, partial, empty, or timed-out refreshes cannot replace a good cached result. With no cached result, the site uses `src/content/open-source-snapshot.json`.
- `src/content/open-source-snapshot.json`: verified API snapshot used if GitHub is unavailable or rate limited. Both live data and fallback use the same filtering policy. Add qualifying organizations deliberately, with a matching local logo asset under `public/images/organizations`.
- `src/content/resume-source.txt`: full text extracted from the supplied résumé. No code imports it; it is an editorial reference, not displayed wholesale.
- `src/content/resume-links.json`: embedded links extracted from the résumé. No code imports it; it is an editorial reference.
- `public/resume.pdf`: supplied downloadable résumé. No page links to it at present, since the socials dock does not list a résumé entry.
- `public/images/avatar.jpg`: the real GitHub avatar.

Public repository descriptions/READMEs, the supplied résumé, and explicit user copy ground project descriptions. PR statuses were checked on 2026-10-01. Raijin’s descriptor follows the supplied third-pass brief; the booking URL is unset until supplied. About copy is a first-pass draft. Dispatches has an honest empty state with no publishing infrastructure.

Navigation uses the compact top header on Playground and Dispatches; the personal homepage omits it per the wireframe. The socials dock (`src/components/socials-dock.tsx`) floats on every route, showing the contact links and a Back button on non-home routes. Its contact destinations live in the `CONTACT` object in that file. No project previews, diagrams, or hover-media systems are included.

Spacing follows an 8px scale defined as `--space-*` tokens in `globals.css`. See [the internal spacing rules](docs/spacing.md) before changing page rhythm.

Ordinary content links use the shared `EditorialLink` / `LinkLabel` components: dashed idle underline, reversible solid swipe from a fixed left origin, and an arrow visible only on hover/focus. Keep the Playground word's bespoke interaction and compact navigation treatment. Run `bun test src/lib/open-source-policy.test.ts` to verify contribution curation and ordering. `bun test src/lib/open-source-github.test.ts scripts/generate-open-source.test.ts` verifies pagination, rejection of unusable responses, and snapshot preservation.

To update the committed open-source fallback, run `bun run open-source:snapshot` with `GITHUB_TOKEN` set, review the resulting seven public contributions, and commit the snapshot. The command follows pagination until all history is examined or older pages cannot change the seven merged selections, then writes atomically; an API failure preserves the existing file. Unchanged results leave the file untouched. The manual snapshot is a deployment safety net; normal hourly refresh uses Next’s persistent validated-result cache.

## GitHub activity

The homepage activity panel (`src/components/github-activity.tsx`) is a client component. It fetches the public contribution calendar for `aetosdios27` from `github-contributions-api.jogruber.de` in the browser, so it needs no credentials and nothing is checked in. On network failure it keeps its reserved space empty.

## References

The brief draws on Emil Kowalski and Juliette's restraint and interaction care, without cloning either site. Design Engineer Tools was reviewed for resource direction. Designeer returned a security checkpoint, so its resources could not be reviewed. No component-library UI or generated project screenshots were imported.
