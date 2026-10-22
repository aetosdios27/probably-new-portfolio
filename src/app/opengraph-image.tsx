import { ImageResponse } from 'next/og';
import { ogFonts } from '@/lib/og-fonts';
import { OG_SIZE } from '@/lib/og-art';

export const alt = 'aetos';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#ece8e1', fontFamily: 'Instrument Serif', fontSize: 184, letterSpacing: -5, lineHeight: 1 }}>
      aetos
    </div>,
    { ...size, fonts: await ogFonts() },
  );
}
