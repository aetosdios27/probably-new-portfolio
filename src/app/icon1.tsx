import { ImageResponse } from 'next/og';
import { iconArt } from '@/lib/icon-art';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default async function Icon() {
  return new ImageResponse(
    <img src={await iconArt()} width={size.width} height={size.height} alt="" />,
    size,
  );
}
