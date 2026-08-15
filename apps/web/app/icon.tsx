import { ImageResponse } from "next/og";
import { OCHOSI_ART_DATA_URI } from "./generated/ochosi-art";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: "50%",
          overflow: "hidden",
          border: "8px solid #dfc66c",
        }}
      >
        <img
          src={OCHOSI_ART_DATA_URI}
          width="620"
          height="620"
          style={{ objectFit: "cover", objectPosition: "center 42%" }}
        />
      </div>
    ),
    size,
  );
}
