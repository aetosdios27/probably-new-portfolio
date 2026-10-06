# Playground verification

14 included projects, statically generated. Build, lint, typecheck and 11 tests pass. Both unknown and excluded slugs return HTTP 404.

Source checksums confirm no changes to homepage content/styles, global tokens, construction styles, or dock source/styles during Playground work. The separately requested shared-link patch hides the dashed decoration on hover/focus.

All 14 project routes checked at 360, 390 and 768 CSS px. Every document's scrollWidth equals clientWidth. The preview uses a classic 15px vertical scrollbar on taller documents, so scrollWidth can be 345/375/753 when innerWidth is 360/390/768. No horizontal page overflow.

Index project names occupy one 24px line. Four generated descriptors end in an ellipsis; CSS truncation remains a narrow-column safety net. At 1440px, one descriptor cell needs the CSS safety net. Only Raijin is name-only, deliberately force-included.

Real pointer hover: preview visible, zero row movement, dashed underline becomes transparent. Keyboard focus opens the same preview. The last mobile row clears the native dock by approximately 12px.

Back verified: home → Playground → Kurogane → Back → Playground → Back → home. Direct Kurogane landing → Back → home. No dock code changes. No application console errors or hydration warnings in final navigation checks.

Current eligible READMEs contain no qualifying PNG/JPG/WebP screenshots, so every thumbnail uses the generated card. No screenshot example was fabricated.

OG generation was attempted with Next's built-in ImageResponse and the existing Inter Tight variable font. The renderer failed to parse that font. The failing experimental route was removed; no new font or dependency was added.

## Quality patch source diff

Compared to the files at the start of the quality-gate patch (earlier Playground/dock feature work is already uncommitted):

| File | Added | Removed |
| --- | ---: | ---: |
| scripts/generate-projects.ts | 77 | 12 |
| src/data/projects.config.ts | 20 | 50 |
| src/app/playground/project-index.tsx | 1 | 1 |
| src/app/playground/playground.module.css | 4 | 3 |

The generated JSON snapshot and the derived audit/review reports were refreshed as data artifacts. No deep-dive layout changes in the quality patch.

## Index viewport screenshots

| Width | Position | Screenshot |
| --- | --- | --- |
| 1440 | top | [View](/home/aetos/.t3/userdata/browser-artifacts/browser-screenshot-localhost-muwehwrf-33ee41c0.png) |
| 1440 | bottom | [View](/home/aetos/.t3/userdata/browser-artifacts/browser-screenshot-localhost-muweig8f-85b7d861.png) |
| 390 | top | [View](/home/aetos/.t3/userdata/browser-artifacts/browser-screenshot-localhost-muweesqp-b253d5ce.png) |
| 390 | bottom | [View](/home/aetos/.t3/userdata/browser-artifacts/browser-screenshot-localhost-muweet44-de02f2c8.png) |

![Desktop hover](/home/aetos/.t3/userdata/browser-artifacts/browser-screenshot-localhost-muweih05-66585333.png)

## Deep-dive and 404 screenshots

| Width | Route | Screenshot |
| --- | --- | --- |
| 1440 | /playground/webnotes | [View](/home/aetos/.t3/userdata/browser-artifacts/browser-screenshot-localhost-muwea8ko-bf4de907.png) |
| 1440 | /playground/kurogane | [View](/home/aetos/.t3/userdata/browser-artifacts/browser-screenshot-localhost-muwea9bh-39d3f23d.png) |
| 1440 | /playground/not-a-project | [View](/home/aetos/.t3/userdata/browser-artifacts/browser-screenshot-localhost-muweaa0y-08571e38.png) |
| 768 | /playground/webnotes | [View](/home/aetos/.t3/userdata/browser-artifacts/browser-screenshot-localhost-muweaayw-54a7355d.png) |
| 768 | /playground/kurogane | [View](/home/aetos/.t3/userdata/browser-artifacts/browser-screenshot-localhost-muweabof-64ad770c.png) |
| 768 | /playground/not-a-project | [View](/home/aetos/.t3/userdata/browser-artifacts/browser-screenshot-localhost-muweaccw-9447e260.png) |
| 768 | /playground | [View](/home/aetos/.t3/userdata/browser-artifacts/browser-screenshot-localhost-muweihrc-4cb9d95b.png) |
| 390 | /playground/webnotes | [View](/home/aetos/.t3/userdata/browser-artifacts/browser-screenshot-localhost-muweadwq-8fa04db0.png) |
| 390 | /playground/kurogane | [View](/home/aetos/.t3/userdata/browser-artifacts/browser-screenshot-localhost-muweaemy-eeea1677.png) |
| 390 | /playground/not-a-project | [View](/home/aetos/.t3/userdata/browser-artifacts/browser-screenshot-localhost-muweafao-51b4abec.png) |

## Every project route: overflow checks

| Viewport | Route | clientWidth | scrollWidth | Back present |
| ---: | --- | ---: | ---: | --- |
| 360 | /playground/kiban | 345 | 345 | true |
| 360 | /playground/kurogane | 360 | 360 | true |
| 360 | /playground/styx | 360 | 360 | true |
| 360 | /playground/scribe | 360 | 360 | true |
| 360 | /playground/raijin | 360 | 360 | true |
| 360 | /playground/susano | 360 | 360 | true |
| 360 | /playground/shiden | 360 | 360 | true |
| 360 | /playground/konto | 360 | 360 | true |
| 360 | /playground/iris | 360 | 360 | true |
| 360 | /playground/webnotes | 345 | 345 | true |
| 360 | /playground/axiom-core | 360 | 360 | true |
| 360 | /playground/vmrl | 360 | 360 | true |
| 360 | /playground/android-lab-project | 360 | 360 | true |
| 360 | /playground/folio | 360 | 360 | true |
| 390 | /playground/kiban | 375 | 375 | true |
| 390 | /playground/kurogane | 390 | 390 | true |
| 390 | /playground/styx | 390 | 390 | true |
| 390 | /playground/scribe | 390 | 390 | true |
| 390 | /playground/raijin | 390 | 390 | true |
| 390 | /playground/susano | 390 | 390 | true |
| 390 | /playground/shiden | 390 | 390 | true |
| 390 | /playground/konto | 390 | 390 | true |
| 390 | /playground/iris | 390 | 390 | true |
| 390 | /playground/webnotes | 375 | 375 | true |
| 390 | /playground/axiom-core | 390 | 390 | true |
| 390 | /playground/vmrl | 390 | 390 | true |
| 390 | /playground/android-lab-project | 390 | 390 | true |
| 390 | /playground/folio | 390 | 390 | true |
| 768 | /playground/kiban | 753 | 753 | true |
| 768 | /playground/kurogane | 768 | 768 | true |
| 768 | /playground/styx | 768 | 768 | true |
| 768 | /playground/scribe | 768 | 768 | true |
| 768 | /playground/raijin | 768 | 768 | true |
| 768 | /playground/susano | 768 | 768 | true |
| 768 | /playground/shiden | 768 | 768 | true |
| 768 | /playground/konto | 768 | 768 | true |
| 768 | /playground/iris | 768 | 768 | true |
| 768 | /playground/webnotes | 768 | 768 | true |
| 768 | /playground/axiom-core | 768 | 768 | true |
| 768 | /playground/vmrl | 768 | 768 | true |
| 768 | /playground/android-lab-project | 768 | 768 | true |
| 768 | /playground/folio | 768 | 768 | true |

To refresh: bun run projects:generate (or bun run build, which refreshes first). GITHUB_TOKEN is optional; if anonymous API limits are exhausted, set it in the environment. The script stops on GitHub failure without replacing its last verified snapshot.

