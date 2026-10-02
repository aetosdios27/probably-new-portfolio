# Pushpendra Singh — Portfolio

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

## Design foundation

The background is fixed at `#0E0E0E`. Tokens, the centered 760px content column, spacing, responsive layouts, hover states, and reduced-motion behavior live in `src/app/globals.css`.

Inter Tight is self-hosted through `next/font/local`. The variable font and its OFL license are in `src/assets/fonts/`; builds do not need Google Fonts network access. Icons come from React Icons (Font Awesome brand icons and Lucide utility icons).

## Content

- `src/content/portfolio.ts`: identity, links, Selected Work shortlist, editorial contribution descriptions, and Playground title.
- `src/lib/open-source-policy.ts`: qualifying organization allowlist, merged-first selection, one-PR-per-repository limit, and newest-first ordering.
- `src/lib/open-source.ts`: server-side GitHub search with hourly revalidation and an eight-second timeout. The homepage refreshes on visits after the cache expires; it does not poll or rearrange rows during reading. Set optional server-only `GITHUB_TOKEN` in deployment for higher GitHub API limits; public search also works without it.
- `src/content/open-source-snapshot.json`: verified API snapshot used if GitHub is unavailable or rate limited. Both live data and fallback use the same filtering policy. Add qualifying organizations deliberately, with a matching local logo asset under `public/images/organizations`.
- `src/content/resume-source.txt`: full text extracted from the supplied résumé, retained as an editorial source rather than displayed wholesale.
- `src/content/resume-links.json`: embedded links extracted from the résumé.
- `public/resume.pdf`: supplied downloadable résumé.
- `public/images/pushpendra.jpg`: the real GitHub avatar.

Public repository descriptions/READMEs, the supplied résumé, and explicit user copy ground project descriptions. PR statuses were checked on 2026-10-01. Raijin’s descriptor follows the supplied third-pass brief; the booking URL is unset until supplied. About copy is a first-pass draft. Dispatches has an honest empty state with no publishing infrastructure.

Navigation uses the compact top header on Playground and Dispatches; the personal homepage omits it per the wireframe. There is no floating navigation dock. No project previews, diagrams, or hover-media systems are included.

Spacing follows an 8px scale defined as `--space-*` tokens in `globals.css`. See [the internal spacing rules](docs/spacing.md) before changing page rhythm.

Ordinary content links use the shared `EditorialLink` / `LinkLabel` components: dashed idle underline, reversible solid swipe from a fixed left origin, and an arrow visible only on hover/focus. Keep the Playground word's bespoke interaction and compact navigation treatment. Run `bun test src/lib/open-source-policy.test.ts` to verify contribution filtering, ordering, freshness settings, and API-failure fallback.

## Contribution calendar

`src/components/contribution-heatmap.tsx` is an isolated presentation component accepting a typed `ContributionCalendar`. Its default source is a real GitHub contribution snapshot in `src/content/contributions.json`, visibly dated on the page. It is not a live activity feed and requires no runtime credentials.

Refresh the snapshot using GitHub's GraphQL `user.contributionsCollection.contributionCalendar` fields (`totalContributions`, and `weeks.contributionDays` containing `date`, `contributionCount`, and `contributionLevel`), then add `capturedAt` as an ISO date. Credentials belong only in the tooling used to fetch it, never in checked-in files or client code. A previously built heatmap can later be ported at this component boundary.

## References

The brief draws on Emil Kowalski and Juliette's restraint and interaction care, without cloning either site. Design Engineer Tools was reviewed for resource direction. Designeer returned a security checkpoint, so its resources could not be reviewed. No component-library UI or generated project screenshots were imported.
