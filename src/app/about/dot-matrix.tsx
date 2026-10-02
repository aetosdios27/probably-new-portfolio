import { useId } from "react";

export function DotMatrix({ className }: { className: string }) {
  const patternId = useId();

  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={patternId} width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="6" cy="6" r="0.75" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
