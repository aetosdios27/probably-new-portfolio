import { useId } from "react";

export function DottedRule({
  axis,
  className,
}: {
  axis: "horizontal" | "vertical";
  className: string;
}) {
  const patternId = useId();
  const horizontal = axis === "horizontal";

  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <defs>
        <pattern
          id={patternId}
          width={horizontal ? 6 : 1.5}
          height={horizontal ? 1.5 : 6}
          patternUnits="userSpaceOnUse"
        >
          <rect
            x={horizontal ? 0.5 : 0.25}
            y={horizontal ? 0.25 : 0.5}
            width={horizontal ? 2.5 : 1}
            height={horizontal ? 1 : 2.5}
            rx="0.5"
            fill="currentColor"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
