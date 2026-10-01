import { useId } from "react";

export function Crosshatch({ className }: { className: string }) {
  const patternId = useId();

  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={patternId} width="12" height="12" patternUnits="userSpaceOnUse">
          <path
            d="M0 12L12 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.6"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
