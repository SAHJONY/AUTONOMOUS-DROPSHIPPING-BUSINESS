import { ImageResponse } from "next/og";
import { OCHOSI_ART_DATA_URI } from "./generated/ochosi-art";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07110b",
          borderRadius: "38px",
          overflow: "hidden",
          border: "4px solid #dfc66c",
        }}
      >
        <img
          src={OCHOSI_ART_DATA_URI}
          width="218"
          height="218"
          style={{ objectFit: "cover", objectPosition: "center 42%" }}
        />
      </div>
    ),
    size,
  );
}
