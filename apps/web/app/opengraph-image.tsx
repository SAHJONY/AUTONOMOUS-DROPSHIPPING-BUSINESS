import { ImageResponse } from "next/og";
import { OCHOSI_ART_DATA_URI } from "./generated/ochosi-art";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "BOTANICA OCHOSI — Botánica Cubana Online";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "72px 84px",
          background: "linear-gradient(135deg,#07110b 0%,#0d2416 58%,#07110b 100%)",
          color: "#f5f0df",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: "650px" }}>
          <div style={{ fontSize: 26, letterSpacing: 8, color: "#dfc66c", marginBottom: 26 }}>BOTANICA OCHOSI</div>
          <div style={{ fontSize: 64, lineHeight: 1.05, fontWeight: 700, marginBottom: 28 }}>Tu botánica cubana, ahora online.</div>
          <div style={{ fontSize: 28, lineHeight: 1.4, color: "#d9d4c7" }}>Lucumí · Yoruba · Ifá · compra segura · atención completamente en línea</div>
          <div style={{ fontSize: 22, marginTop: 42, color: "#dfc66c" }}>www.botanicaochosi.com</div>
        </div>
        <div
          style={{
            width: "360px",
            height: "360px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            overflow: "hidden",
            border: "7px solid #dfc66c",
            boxShadow: "0 28px 90px rgba(0,0,0,.45)",
          }}
        >
          <img
            src={OCHOSI_ART_DATA_URI}
            width="438"
            height="438"
            style={{ objectFit: "cover", objectPosition: "center 42%" }}
          />
        </div>
      </div>
    ),
    size,
  );
}
