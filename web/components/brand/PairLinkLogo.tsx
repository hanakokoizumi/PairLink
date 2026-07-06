import { PAIRLINK_ICON } from "@/lib/brand/pairlink-icon";
import { cn } from "@/lib/utils";

type Props = {
  size?: number;
  className?: string;
};

export function PairLinkLogo({ size = 32, className }: Props) {
  const markSize = Math.round(size * PAIRLINK_ICON.markScale);
  const radius = Math.round(size * PAIRLINK_ICON.borderRadiusRatio);

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      style={{
        width: size,
        height: size,
        background: PAIRLINK_ICON.background,
        borderRadius: radius,
        border: `${PAIRLINK_ICON.borderWidth}px solid ${PAIRLINK_ICON.accent}`,
      }}
      aria-hidden
    >
      <svg
        width={markSize}
        height={markSize}
        viewBox={PAIRLINK_ICON.markViewBox}
        fill="none"
        stroke={PAIRLINK_ICON.accent}
        strokeWidth={PAIRLINK_ICON.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PAIRLINK_ICON.linkPaths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  );
}
