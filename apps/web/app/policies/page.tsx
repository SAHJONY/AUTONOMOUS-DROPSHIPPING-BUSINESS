import type { Metadata } from "next";
import styles from "./policies.module.css";

export const metadata: Metadata = {
  title: "Políticas de la tienda | BOTANICA OCHOSI",
  description: "Información de compra, envío, devoluciones, privacidad y contacto de BOTANICA OCHOSI.",
};

const SUPPORT_EMAIL = "suppliers@botanicaochosi.com";

export default function PoliciesPage() {
  return <main className={styles.shell}>
    <nav className={styles.nav}><a href="/shop" className={styles.brand}><span>O</span><strong>BOTANICA OCHOSI</strong></a><a href="/shop">Volver a la tienda</a></nav>
    <header className={styles.hero}><span>INFORMACIÓN PARA EL CLIENTE</span><h1>Compra clara,<br/><em>de principio a fin.</em></h1><p>Consulta aquí cómo procesamos pedidos, envíos, devoluciones y datos personales. Los términos definitivos mostrados durante el checkout prevalecen para cada compra.</p></header>
    <nav className={styles.index} aria-label="Índice de políticas"><a href="#envios">Envíos</a><a href="#devoluciones">Devoluciones</a><a href="#privacidad">Privacidad</a><a href="#terminos">Términos</a><a href="#contacto">Contacto</a></nav>
    <div className={styles.content}>
      <section id="envios"><span>01</span><div><h2>Envíos y entrega</h2><p>El costo de envío y los destinos disponibles se muestran antes de pagar. Los plazos son estimaciones y comienzan cuando el pedido queda preparado, no necesariamente el día de compra.</p><ul><li>La dirección debe revisarse antes de completar el pago.</li><li>Los artículos frágiles y líquidos pueden requerir embalaje o restricciones adicionales.</li><li>Cuando exista seguimiento, se enviará por los canales digitales registrados en el pedido.</li><li>Daños, faltantes o entregas incorrectas deben informarse con fotografías del paquete y del producto.</li></ul></div></section>
      <section id="devoluciones"><span>02</span><div><h2>Devoluciones y reembolsos</h2><p>Solicita revisión antes de devolver cualquier artículo. Por razones de higiene, seguridad e integridad del producto, artículos abiertos, usados, personalizados, consumibles o líquidos pueden no ser elegibles, salvo que hayan llegado dañados o incorrectos.</p><ul><li>No envíes una devolución sin autorización e instrucciones.</li><li>Conserva el producto, empaque, etiqueta y evidencia fotográfica.</li><li>Un reembolso aprobado se procesa al método de pago original; el banco determina cuándo aparece.</li><li>Los derechos que la ley aplicable no permita excluir permanecen vigentes.</li></ul></div></section>
      <section id="privacidad"><span>03</span><div><h2>Privacidad y pagos</h2><p>Recopilamos la información necesaria para procesar pedidos, prevenir fraude, entregar compras y atender solicitudes. El pago se procesa mediante Stripe; BOTANICA OCHOSI no necesita almacenar el número completo de tu tarjeta.</p><ul><li>No vendemos datos personales.</li><li>Proveedores de pago, alojamiento y entrega reciben solo lo necesario para prestar sus servicios.</li><li>Puedes solicitar acceso o corrección de tus datos por correo.</li><li>No envíes información médica, religiosa confidencial ni credenciales por formularios comerciales.</li></ul></div></section>
      <section id="terminos"><span>04</span><div><h2>Términos y uso responsable</h2><p>Los productos se ofrecen según disponibilidad. Podemos corregir errores evidentes de precio, descripción o inventario antes del despacho y reembolsar el pago correspondiente.</p><ul><li>La información cultural o espiritual es descriptiva y no promete resultados.</li><li>No sustituye consejo médico, legal ni orientación religiosa personalizada.</li><li>El cliente es responsable de seguir etiquetas, advertencias y uso seguro.</li><li>La compra no concede derechos sobre marcas, fotografías o contenido del sitio.</li></ul></div></section>
      <section id="contacto"><span>05</span><div><h2>Contacto digital</h2><p>Para preguntas sobre pedidos, envíos, daños, privacidad o devoluciones, escribe a <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Incluye el número de pedido, pero nunca datos completos de tarjeta o contraseñas.</p><p className={styles.note}>Estas políticas son una base operativa y deben ser revisadas por el propietario y asesoría profesional antes del lanzamiento público.</p></div></section>
    </div>
    <footer className={styles.footer}><span>BOTANICA OCHOSI</span><span>Última actualización: agosto de 2026</span><a href="/shop">Comprar</a></footer>
  </main>;
}
