import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// One outlined master for the SVG favicon and every raster size. No installed font is involved.
const artwork = readFile(join(process.cwd(), 'src/app/icon.svg'), 'base64');

export async function iconArt() {
  return `data:image/svg+xml;base64,${await artwork}`;
}
