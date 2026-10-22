import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Satori reads static TTF/OTF only. Instrument Serif ships static, so the share images use the site's own
// display face; the variable Inter Tight and Geist Mono cannot be parsed and stay out of them.
export async function ogFonts() {
  const dir = join(process.cwd(), "src/assets/fonts");
  const [regular, italic] = await Promise.all([
    readFile(join(dir, "InstrumentSerif-Regular.ttf")),
    readFile(join(dir, "InstrumentSerif-Italic.ttf")),
  ]);
  return [
    { name: "Instrument Serif", data: regular, style: "normal" as const, weight: 400 as const },
    { name: "Instrument Serif", data: italic, style: "italic" as const, weight: 400 as const },
  ];
}
