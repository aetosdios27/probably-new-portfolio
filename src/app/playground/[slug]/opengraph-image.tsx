import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { getProject, getSelectedProjects, isSelected } from '@/lib/playground/projects';
import { projectDither } from '@/lib/dither-themes';
import { ogFonts } from '@/lib/og-fonts';
import { OG_RAIL, OG_SIZE, pondArt } from '@/lib/og-art';

export const alt = 'A project from the playground';
export const size = OG_SIZE;
export const contentType = 'image/png';

export function generateStaticParams() {
  return getSelectedProjects().map(({ slug }) => ({ slug }));
}

// Each project card carries the page's own dither colour, shaded into three steps for the margin art.
function shades(hex: string): [string, string, string] {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const mix = (k: number) => `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
  return [mix(0.32), mix(0.6), mix(0.9)];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const project = getProject((await params).slug);
  if (!project || !isSelected(project.slug)) notFound();
  const name = project?.name ?? 'Playground';
  const descriptor = project?.descriptor ?? '';
  const languages = (project?.languages ?? []).slice(0, 4).join('  ·  ');
  const color = project ? projectDither(project.slug).color : '#B6CE8A';
  const art = pondArt({ palette: shades(color), seed: [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 3), windows: false, koi: false });
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#000', color: '#ece8e1' }}>
        <img src={art} width={OG_SIZE.width} height={OG_SIZE.height} alt="" style={{ position: 'absolute', left: 0, top: 0 }} />
        <div style={{ position: 'absolute', left: OG_RAIL.left + 48, top: 144, width: OG_RAIL.right - OG_RAIL.left - 96, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 22, color, letterSpacing: 2, display: 'flex' }}>playground</div>
          <div style={{ marginTop: 16, fontFamily: 'Instrument Serif', fontSize: name.length > 14 ? 88 : 120, lineHeight: 1.02, letterSpacing: -3, display: 'flex' }}>{name}</div>
          <div style={{ marginTop: 24, fontSize: 28, lineHeight: 1.4, color: '#a9a49b', display: 'flex' }}>{descriptor.length > 150 ? `${descriptor.slice(0, 147)}...` : descriptor}</div>
          <div style={{ marginTop: 24, fontSize: 22, color: '#a9a49b', letterSpacing: 1, display: 'flex' }}>{languages}</div>
          <div style={{ marginTop: 24, fontSize: 22, color: '#a9a49b', display: 'flex' }}>aetos / aetosdios.xyz</div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
