import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Generated at request time via Next's built-in ImageResponse (no external
 * asset/service) so link previews on Reddit/LinkedIn/Discord — the exact
 * channels docs/pitch.md's traction tactics rely on — show something
 * branded instead of a blank card.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FAF6F0",
        color: "#2B1B12",
        fontFamily: "Georgia, serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 96,
          height: 96,
          borderRadius: "50%",
          backgroundColor: "#C4702B",
          border: "3px solid #2B1B12",
          color: "#FAF6F0",
          fontSize: 56,
          fontWeight: 700,
          marginBottom: 36,
        }}
      >
        L
      </div>
      <div style={{ display: "flex", fontSize: 64, fontWeight: 700 }}>
        Coin Ledger
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 20,
          fontSize: 28,
          color: "#7A6A5C",
          fontFamily: "monospace",
        }}
      >
        AI proposes. Rules authorize. Humans approve.
      </div>
    </div>,
    { ...size },
  );
}
