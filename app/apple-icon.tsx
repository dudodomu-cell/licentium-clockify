import { ImageResponse } from "next/og";

// iOS "Add to Home Screen" prefers a PNG touch icon. Next.js routes this file
// to /apple-icon and injects <link rel="apple-touch-icon" href="/apple-icon">
// automatically. Satori (under next/og) rasterizes the JSX below to PNG.
//
// The design mirrors app/icon.svg — Mondaine railway clock at 10:10 with our
// teal second hand — but built with positioned <div>s because Satori has
// limited support for arbitrary SVG.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const S = 180;
const CENTER = S / 2;
const INK = "#0a0a0a";
const TEAL = "#5eead4";

// Outer rotating wrapper — rotating this wrapper rotates a child relative to
// the canvas center (since the wrapper covers the full canvas and Satori
// rotates around the center by default).
function rotated(angle: number, child: React.ReactNode) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: S,
        height: S,
        display: "flex",
        transform: `rotate(${angle}deg)`,
      }}
    >
      {child}
    </div>
  );
}

function marker(angle: number, w: number, h: number) {
  return (
    <div
      key={`m-${angle}-${w}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: S,
        height: S,
        display: "flex",
        transform: `rotate(${angle}deg)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: S * 0.045,
          left: (S - w) / 2,
          width: w,
          height: h,
          background: INK,
        }}
      />
    </div>
  );
}

function hand(angle: number, w: number, length: number, color: string, tail = 0) {
  return rotated(
    angle,
    <div
      style={{
        position: "absolute",
        top: CENTER - length,
        left: (S - w) / 2,
        width: w,
        height: length + tail,
        background: color,
      }}
    />,
  );
}

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: S,
          height: S,
          background: "#ffffff",
          borderRadius: S / 2,
        }}
      >
        {/* 4 cardinal hour markers (thicker) */}
        {[0, 90, 180, 270].map((a) => marker(a, S * 0.05, S * 0.095))}
        {/* 8 minor hour markers */}
        {[30, 60, 120, 150, 210, 240, 300, 330].map((a) =>
          marker(a, S * 0.025, S * 0.072),
        )}

        {/* Hour hand at 10 (300°) */}
        {hand(300, S * 0.06, S * 0.27, INK, S * 0.04)}

        {/* Minute hand at 2 (60°) */}
        {hand(60, S * 0.04, S * 0.36, INK, S * 0.045)}

        {/* Second hand (teal, straight up) */}
        {rotated(
          0,
          <div
            style={{
              position: "absolute",
              top: CENTER - S * 0.405,
              left: (S - S * 0.018) / 2,
              width: S * 0.018,
              height: S * 0.405 + S * 0.05,
              background: TEAL,
            }}
          />,
        )}
        {/* Mondaine-style disc on the second hand */}
        {rotated(
          0,
          <div
            style={{
              position: "absolute",
              top: CENTER - S * 0.36,
              left: (S - S * 0.09) / 2,
              width: S * 0.09,
              height: S * 0.09,
              borderRadius: S * 0.045,
              background: TEAL,
            }}
          />,
        )}

        {/* Center pin */}
        <div
          style={{
            position: "absolute",
            top: CENTER - S * 0.034,
            left: CENTER - S * 0.034,
            width: S * 0.068,
            height: S * 0.068,
            borderRadius: S * 0.034,
            background: INK,
          }}
        />
      </div>
    ),
    { ...size },
  );
}
