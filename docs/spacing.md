# Internal spacing rules

Use an 8px base rhythm for page layout. Shared tokens in `src/app/globals.css` cover 8, 16, 24, 32, 48, 64, 72, 80, and 96px. Token suffixes count 8px units, so `--space-3` means 24px. Reserve 4px increments for compact UI and optical adjustments; do not round image dimensions, type sizes, or line heights onto the spacing scale.

Choose gaps by relationship, not available screen area:

- 8px: tightly associated labels and metadata.
- 16px: consecutive paragraphs in one thought.
- 24px: transitions within a content group, including a prose invitation.
- 32px: a small visual introduction followed by text.
- 48–64px: separation between distinct content groups.
- 72–96px: independent sections or page-edge breathing room.

About is one connected personal introduction, not several sections. Desktop uses 96px above the portrait, 32px from portrait to greeting, 24px from greeting to prose, no extra paragraph gap between the introduction and university context, and 24px before the Playground invitation. Those two sentences form one continuous thought; keep their normal line height. Mobile uses a 64px top inset and 24px from portrait to greeting. Align the portrait and all prose to the same left edge. Let copy wrap naturally within a readable measure inside the shared site container.

Center the entire About composition as one column: `width: 100%; max-width: 620px; margin-inline: auto`. Keep text left-aligned within that column. Do not attach a narrower prose column to the shared container's left edge; that creates unequal outer margins. Check equal column margins at wide, tablet, and mobile widths, allowing subpixel rounding.

Keep whitespace outside the composition generous while preserving proximity within it. Avoid viewport-relative gaps inside the biography, artificial minimum heights on individual content blocks, and stacked bottom padding plus footer margins. Never add filler to occupy leftover space.

Page framing is separate from content spacing. The shared `.page-shell` must fill at least the visible viewport, with a flexible main region and a footer that stays at the bottom on short pages. On longer pages, the footer follows the complete content in normal document flow. Its existing margin supplies a minimum separation from the prose; the shell absorbs additional available space. Do not use fixed positioning, hard-coded footer offsets, or expanded paragraph gaps to achieve this.

## Research grounding

- [NN/g: Proximity Principle in Visual Design](https://www.nngroup.com/articles/gestalt-proximity/): closer elements read as a group; larger whitespace separates groups. This informs the relationship between paragraph and section gaps, not their exact numeric values.
- [MDN: Sticky footers](https://developer.mozilla.org/en-US/docs/Web/CSS/How_to/Layout_cookbook/Sticky_footers): fill the viewport on short pages while letting longer content push the footer down. The shared shell uses the documented flex-column pattern.
- [Emil Kowalski: Train Your Judgement](https://emilkowal.ski/ui/train-your-judgement): name visible problems and compare alternatives rather than accepting code that merely works. This article concerns motion; it is a review discipline reference, not authority for our spacing values.

Apply these rules to new or revised spacing. Preserve existing components outside the requested scope instead of mechanically replacing every numeric value. Verify desktop and mobile, including wrapping, page edges, footer separation, keyboard focus, and anchor navigation. Check short and long pages: a passing short-page check requires the footer bottom to align with the viewport bottom, with no empty canvas beneath it; a passing long-page check requires no overlap or content clipping.
