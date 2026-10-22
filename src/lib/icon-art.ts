import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// One outlined master for the SVG favicon and every raster size. No installed font is involved.
export async function iconArt() {
  const artwork = await readFile(join(process.cwd(), 'src/app/icon.svg'), 'base64');
  return `data:image/svg+xml;base64,${artwork}`;
}
