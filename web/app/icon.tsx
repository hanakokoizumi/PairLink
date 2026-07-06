import { ImageResponse } from "next/og";
import { PAIRLINK_ICON } from "@/lib/brand/pairlink-icon";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  const markSize = Math.round(size.width * PAIRLINK_ICON.markScale);
  const radius = Math.round(size.width * PAIRLINK_ICON.borderRadiusRatio);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: PAIRLINK_ICON.background,
          borderRadius: radius,
          border: `${PAIRLINK_ICON.borderWidth}px solid ${PAIRLINK_ICON.accent}`,
        }}
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
      </div>
    ),
    { ...size },
  );
}
