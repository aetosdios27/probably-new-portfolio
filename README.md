# Pushpendra Singh — Portfolio

An editorial portfolio built with Next.js App Router, React, TypeScript, Tailwind v4, and Bun. Work lives at `/`, with foundations for `/about` and `/dispatches`.

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

- `src/content/portfolio.ts`: identity, links, project order/copy, additional work, open-source PRs, and Playground title. The first selected project receives the featured treatment.
- `src/content/resume-source.txt`: full text extracted from the supplied résumé, retained as an editorial source rather than displayed wholesale.
- `src/content/resume-links.json`: embedded links extracted from the résumé.
- `public/resume.pdf`: supplied downloadable résumé.
- `public/images/pushpendra.jpg`: the real GitHub avatar.

Public repository descriptions/READMEs and the supplied résumé ground project copy. PR statuses were checked on 2026-10-01. Raijin remains explicitly provisional; the booking URL is unset until supplied. About copy is a first-pass draft. Dispatches has an honest empty state with no publishing infrastructure.

## Contribution calendar

`src/components/contribution-heatmap.tsx` is an isolated presentation component accepting a typed `ContributionCalendar`. Its default source is a real GitHub contribution snapshot in `src/content/contributions.json`, visibly dated on the page. It is not a live activity feed and requires no runtime credentials.

Refresh the snapshot using GitHub's GraphQL `user.contributionsCollection.contributionCalendar` fields (`totalContributions`, and `weeks.contributionDays` containing `date`, `contributionCount`, and `contributionLevel`), then add `capturedAt` as an ISO date. Credentials belong only in the tooling used to fetch it, never in checked-in files or client code. A previously built heatmap can later be ported at this component boundary.

## References

The brief draws on Emil Kowalski and Juliette's restraint and interaction care, without cloning either site. Design Engineer Tools was reviewed for resource direction. Designeer returned a security checkpoint, so its resources could not be reviewed. No component-library UI or generated project screenshots were imported.
