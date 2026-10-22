import { ImageResponse } from 'next/og';

export const alt = 'Pushpendra Singh, aetos — systems engineer';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Uses ImageResponse's bundled default font (Geist Regular). The repo's Inter Tight
// file is a variable font, which Satori cannot parse.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 96,
          background: '#0e0e0e',
          color: '#f2f2f2',
        }}
      >
        <div style={{ fontSize: 104, lineHeight: 1.05, display: 'flex' }}>Pushpendra Singh</div>
        <div style={{ marginTop: 32, fontSize: 40, color: '#9a9a9a', display: 'flex' }}>
          aetos — systems engineer
        </div>
      </div>
    ),
    size,
  );
}
