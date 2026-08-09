import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BOTANICA OCHOSI",
    short_name: "OCHOSI",
    description: "Botánica cubana online · tienda espiritual · compra segura y atención en línea.",
    start_url: "/shop",
    display: "standalone",
    background_color: "#07110b",
    theme_color: "#07110b",
    orientation: "portrait-primary",
    categories: ["shopping", "lifestyle"],
    lang: "es",
    scope: "/",
    shortcuts: [
      { name: "Comprar", short_name: "Tienda", url: "/shop#catalogo" },
      { name: "Carrito", short_name: "Carrito", url: "/shop?cart=1" },
    ],
  };
}
