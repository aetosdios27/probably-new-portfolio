# Typography

## Font roles

- Instrument Serif is the display face for page headings, especially page h1 and h2.
- Inter Tight is the body face, set at 14px for the redesign.
- Geist Mono is for metadata, dates, and status labels.

## Tokens

- `--font-display`: Instrument Serif with system serif fallbacks.
- `--font-mono`: Geist Mono with system monospace fallbacks.
- `--text-display`: `44px`.
- `--text-h2`: `22px`.
- `--text-body`: `14px`.
- `--text-meta`: `12px`.
- `--leading-display`: `1.1`.
- `--tracking-display`: `-0.025em`.

Use `.type-display` for display typography and `.type-meta` for compact metadata.
Do not set bold on Instrument Serif; it has a single weight. Build heading
hierarchy through size.
