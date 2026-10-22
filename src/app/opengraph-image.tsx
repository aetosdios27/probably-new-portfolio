import { ImageResponse } from 'next/og';
import { ogFonts } from '@/lib/og-fonts';
import { OG_RAIL, OG_SIZE, pondArt } from '@/lib/og-art';

export const alt = 'Pushpendra Singh, aetos — systems engineer';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  const art = pondArt({ palette: ['#10252e', '#1a3d49', '#2c5965'] });
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#000', color: '#ece8e1' }}>
        <img src={art} width={OG_SIZE.width} height={OG_SIZE.height} alt="" style={{ position: 'absolute', left: 0, top: 0 }} />
        <div style={{ position: 'absolute', left: OG_RAIL.left + 48, top: 196, width: OG_RAIL.right - OG_RAIL.left - 96, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: 'Instrument Serif', fontSize: 128, lineHeight: 1.02, letterSpacing: -3, display: 'flex' }}>Pushpendra Singh</div>
          <div style={{ marginTop: 24, fontFamily: 'Instrument Serif', fontStyle: 'italic', fontSize: 42, color: '#a9a49b', display: 'flex' }}>
            aetos, a systems engineer.
          </div>
          <div style={{ marginTop: 48, fontSize: 24, color: '#a9a49b', letterSpacing: 1, display: 'flex' }}>aetosdios.xyz</div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
