import type { CSSProperties, ReactNode } from "react";
import construction from "@/components/construction.module.css";
import { GutterDither } from "@/components/gutter-dither";
import { SectionBreak } from "@/components/section-break";
import type { DitherTheme } from "@/lib/dither-themes";

export function PageFrame({
  className,
  gutters,
  children,
}: {
  className?: string;
  gutters?: DitherTheme;
  children: ReactNode;
}) {
  return (
    <main id="main" className={`${className ?? ""} ${construction.frame}`} style={gutters ? ({ "--accent": gutters.text } as CSSProperties) : undefined}>
      {gutters ? <GutterDither theme={gutters} /> : null}
      <div aria-hidden="true" className={`${construction.rail} ${construction.leftRail}`} />
      <div aria-hidden="true" className={`${construction.rail} ${construction.rightRail}`} />
      <SectionBreak cap="top" />
      {children}
      <SectionBreak cap="bottom" />
    </main>
  );
}
