import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#070b12",
          color: "#e9eef6",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 30, letterSpacing: 6, color: "#34d399", marginBottom: 16 }}>
          NETSETTLE
        </div>
        <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1, marginBottom: 24 }}>
          $312,000 gross → $40,000 net.
        </div>
        <div style={{ fontSize: 30, color: "#93a0b8" }}>
          One atomic Canton transaction. Bank-ready payment file out.
        </div>
      </div>
    ),
    { ...size },
  );
}
