# Internal motion rules

Motion should make an interaction feel responsive, legible, and deliberate. There is no universal best duration. These are portfolio defaults, not claims that every designer uses the same values.

Use the shared tokens in `src/app/globals.css`:

| Purpose | Token | Duration | Easing |
| --- | --- | --- | --- |
| Immediate press/state feedback | `--motion-feedback` | 120ms | `--ease-out` |
| Quiet hover/color changes | `--motion-hover` | 180ms | CSS `ease` |
| Small entrances and positional feedback | `--motion-standard` | 240ms | `--ease-out` |
| Deliberate decorative reveals | `--motion-reveal` | 400ms | `--ease-in-out` |

`--ease-out` is `cubic-bezier(0.23, 1, 0.32, 1)`: immediate progress with a gentle settling tail. `--ease-in-out` is `cubic-bezier(0.77, 0, 0.175, 1)`: acceleration and deceleration for a visible, deliberate reveal. Keep routine UI transitions under 300ms. Reserve the 400ms reveal token for deliberate decorative motion.

- Name the animation's purpose before adding it. Prefer no animation for repetitive keyboard actions or effects that distract from reading.
- Maintain spatial consistency. Playground keeps up to five visited letters pixelated as a pointer trail, with 60ms entry and 240ms release using the shared ease-out curve. On a pause, retire trailing letters oldest first at 180ms, 300ms, 420ms, and 540ms, leaving the current letter active. This deliberate catch-up sequence settles completely after 780ms; each individual transition remains below 300ms. These are local timings, not a prescribed Emil preset. Cancel pending deadlines on new letter entry, pointer leave, cancellation, blur, and unmount. Reduced motion uses only the current letter. Choose a random color on each letter entry from the local pistachio, rose, apricot, cream, cyan, and lavender palette; hold that color while active. Keep the letter cells stationary and the pixel glyphs proportional. No underline, word-wide sweep, loop, bounce, or overshoot.
- Use CSS transitions for reversible hover effects so moving away mid-animation reverses from the current state. Never replay a fixed keyframe sequence on every pointer event.
- Highlight Project links remain monochrome. A solid underline swipes over the subtle idle dashed underline in 400ms using the reveal/in-out tokens, growing and retracting from the same left origin. The northeast arrow fades in over 180ms with a restrained 2px diagonal reveal in 240ms. Its space stays reserved to avoid layout shifts. Keyboard focus shows both immediately; reduced motion removes transitions. No letter effects or color trails.
- This is the default for ordinary content links throughout the portfolio. Reuse `EditorialLink` with `LinkLabel`; Selected Work and Open source share the same implementation, as do the ordinary Playground index, Dispatches return link, and source link. Section layout and typography stay local. The deliberately bespoke Playground word and compact top navigation keep their established treatments.
- ContextTooltip uses Radix with a 350ms hover delay on every trigger (no skip-delay flashes), immediate keyboard opening, and a 180ms opacity transition using the shared hover/ease-out tokens. Prefer left placement with an 8px offset and collision handling. No translation, scale, arrow, or shadow. CSS starting styles fade entry; a nonvisual 180ms exit-lifetime marker lets Radix Presence retain the element during its reversible opacity transition, then unmount the dismissal layer. Reduced motion disables both. Fixed sentences stay still; reserve Scritto for text that changes while already visible.
- Prefer transforms and opacity for movement. Color transitions are acceptable for subtle text feedback. Avoid layout-changing animation and `transition: all`.
- Gate pointer hover movement with `(hover: hover) and (pointer: fine)`. Keyboard focus must be immediate and visible; do not make keyboard users wait for the decorative reveal.
- Respect the existing reduced-motion override: no animated transforms or scrolling. Keep the final state and focus affordance visible.
- Use springs only for interactions that benefit from velocity or direct manipulation. Do not add an animation dependency for a text underline.
- Review initial, entering, held, leaving, interrupted, keyboard-focus, touch, and reduced-motion states. Check for layout movement and unintended pointer flicker; do not approve based only on a still screenshot or a successful build.

## Sources

- [Emil Kowalski: 7 Practical Animation Tips](https://emilkowal.ski/ui/7-practical-animation-tips): easing controls perceived responsiveness; match the curve to the action.
- [Emil Kowalski: You Don't Need Animations](https://emilkowal.ski/ui/you-dont-need-animations): consider purpose, frequency, and speed; routine UI should generally stay below 300ms.
- [Emil's animation guidance](https://github.com/emilkowalski/skill/blob/main/skills/animate/SKILL.md): source for the easing values and interruption/pointer principles. Our duration tokens are local defaults selected within the relevant ranges.
- [Rauno Freiberg: Invisible Details of Interaction Design](https://rauno.me/craft/interaction-design): spatial consistency, responsiveness, interruption, and frequency matter more than a single timing preset.
