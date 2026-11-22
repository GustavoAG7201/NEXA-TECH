-- Use the same publication lock as the administrative command and checkout.
SELECT pg_advisory_xact_lock(752196, 1);

ALTER TABLE public.legal_document DROP CONSTRAINT legal_document_valid;
ALTER TABLE public.legal_document ADD CONSTRAINT legal_document_valid CHECK (
  kind IN ('TERMS', 'PRIVACY', 'SHIPPING', 'CANCELLATION', 'RETURN', 'WARRANTY', 'SUPPORT')
  AND version > 0 AND length(btrim(title)) BETWEEN 1 AND 150 AND length(btrim(body)) BETWEEN 1 AND 50000
  AND sha256 = encode(sha256(convert_to(body, 'UTF8')), 'hex')
  AND (withdrawn_at IS NULL OR (published_at IS NOT NULL AND published_at <= withdrawn_at))
);

CREATE TEMP TABLE nexa_store_policies (kind text PRIMARY KEY, title text, body text) ON COMMIT DROP;
INSERT INTO nexa_store_policies VALUES
  ('PRIVACY', 'Aviso de privacidad', $privacy$NexaTech es el nombre comercial del sitio. La identidad y el domicilio del responsable del tratamiento y el medio de contacto para solicitudes de privacidad se publican en esta página una vez validados por la administración.

La plataforma trata el nombre, correo electrónico, teléfono cuando se proporciona, direcciones de entrega y datos de pedidos y solicitudes. Utiliza esta información para administrar la cuenta, autenticar el acceso, guardar preferencias y direcciones, cotizar y registrar pedidos, generar comprobantes, atender solicitudes y proteger el servicio. El navegador conserva información de sesión, carrito y favoritos para que estas funciones estén disponibles. No se solicitan datos bancarios ni tarjetas.

Limita los datos que compartes a los necesarios para la función que usas. Evita adjuntar identificaciones o datos sensibles a los tickets. Los datos se conservan mientras sean necesarios para las finalidades indicadas y, cuando corresponda, durante los plazos de conservación aplicables. Cualquier transferencia se sujeta a los supuestos y obligaciones previstos por la legislación de protección de datos.

Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición (ARCO), solicitar la revocación del consentimiento o pedir que se limite el uso o divulgación de tus datos. Utiliza el contacto de privacidad publicado en esta página. Identifica el derecho que deseas ejercer y proporciona un medio de respuesta y la información necesaria para localizar los datos. La acreditación de la identidad o de la representación se hará por el medio seguro que indique el responsable. La determinación se comunica en el plazo legal de 20 días hábiles y, si procede, se hace efectiva en los 15 días hábiles siguientes, con las ampliaciones que permita la ley.

Los cambios a este aviso se comunican en esta página. Su referencia es la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.$privacy$),
  ('TERMS', 'Términos y condiciones', $terms$NexaTech permite consultar el catálogo, cotizar y registrar pedidos. Todos los importes se expresan en pesos mexicanos. Antes de confirmar, revisa los artículos, variantes, cantidades, disponibilidad, descuentos, impuestos, envío y total de la cotización. La disponibilidad y las condiciones se verifican al confirmar el pedido.

La modalidad disponible es el registro de pedido. No se realizan cargos reales. El pedido no genera un despacho físico. El comprobante identifica el registro mediante un folio y carece de validez fiscal.

Mantén tus datos actualizados, protege tus credenciales y usa la cuenta para fines lícitos. En Mis pedidos puedes consultar el estado, descargar el comprobante e iniciar las solicitudes disponibles. Las políticas de envío, cancelación, devolución, garantías y privacidad complementan estos términos.

En una compraventa efectiva, las personas consumidoras tienen derecho a información clara sobre el proveedor, el producto, el importe total y las condiciones de entrega, así como a los remedios que establezca la Ley Federal de Protección al Consumidor. Estos términos no limitan los derechos irrenunciables previstos en esa ley. La identidad, el domicilio y los canales de contacto validados del proveedor se publican en esta página.$terms$),
  ('SHIPPING', 'Política de envíos', $shipping$La cotización de paquetería está disponible para Tamaulipas y Ciudad de México. El sistema muestra el importe, los impuestos, los descuentos de envío cuando proceden y el intervalo estimado según el destino antes de confirmar. Revisa el nombre de quien recibe, el teléfono y el código postal antes de cotizar.

Las fechas, guías y eventos de seguimiento se registran como referencia del pedido. No se realizan entregas físicas. Puedes consultar el estado en Mis pedidos e informar de discrepancias desde Soporte.

En una compraventa efectiva, cualquier cobertura, cargo y plazo de entrega debe informarse antes de la aceptación y respetarse conforme a las condiciones acordadas y a la Ley Federal de Protección al Consumidor.$shipping$),
  ('CANCELLATION', 'Política de cancelaciones', $cancellation$Solicita la cancelación desde el detalle de Mis pedidos mientras el pedido esté confirmado o en preparación. Selecciona el motivo, describe la solicitud y conserva el folio. Si el estado del pedido ya no admite cancelación en pantalla, usa Soporte para pedir una revisión. Puedes consultar la resolución en Mis solicitudes.

No se realizan cargos reales. Si corresponde registrar un reembolso, el importe queda asociado al folio para su consulta y no genera una transferencia.

Cuando resulte aplicable el artículo 56 de la Ley Federal de Protección al Consumidor a una compraventa efectiva, la persona consumidora puede revocar su consentimiento dentro de cinco días hábiles contados desde la entrega del bien o la firma del contrato, lo que ocurra después. La solicitud puede comunicarse por un medio que deje constancia. El estado en pantalla no restringe los derechos legales aplicables.$cancellation$),
  ('RETURN', 'Política de devoluciones', $returns$Desde el detalle de un pedido con despacho o entrega registrados, abre una solicitud de devolución o cambio. Selecciona los artículos y cantidades, indica el motivo y describe el problema. Consulta las instrucciones y la resolución en Mis solicitudes. Puedes adjuntar evidencia del producto si es necesaria para documentar el caso.

La revisión registra la recepción, la inspección y la resolución que proceda. Conserva el comprobante, los accesorios y las referencias del producto para facilitar la revisión. La plataforma no recibe artículos físicos ni devuelve dinero.

En una compraventa efectiva, ante un producto que no corresponda a lo ofrecido o presente deficiencias, se aplican los derechos de reposición, devolución y, cuando corresponda, bonificación de la Ley Federal de Protección al Consumidor. El trámite interno no sustituye los medios de reclamación legal.$returns$),
  ('WARRANTY', 'Política de garantías', $warranty$Para registrar una incidencia de garantía, abre el pedido en Mis pedidos, selecciona Garantía, indica los artículos afectados y describe la falla. Conserva el folio, el comprobante y, si existe, el número de serie. En Mis solicitudes puedes consultar si se requiere información adicional y revisar la resolución de reparación, reposición o cierre. La atención en la plataforma se limita al registro y seguimiento de casos.

Cuando se ofrezca una garantía en una compraventa efectiva, la póliza debe describir la vigencia, cobertura, condiciones, procedimiento y medios para hacerla válida. De acuerdo con el artículo 77 de la Ley Federal de Protección al Consumidor, la vigencia ofrecida no puede ser inferior a 90 días desde la entrega. Para cada producto rigen las condiciones informadas en su póliza y los derechos que establezca la ley. Este sitio no emite pólizas comerciales ni promete cobertura de un fabricante.$warranty$),
  ('SUPPORT', 'Atención a clientes y soporte', $support$Inicia sesión y abre Soporte para registrar una consulta o reclamación. Describe lo ocurrido, incluye el folio del pedido si corresponde y explica la solución que solicitas. El ticket conserva un folio para consultar las respuestas y dar seguimiento al caso. Evita incluir contraseñas, datos bancarios o documentos de identidad en el mensaje.

Para ejercer derechos sobre tus datos personales, utiliza el contacto de privacidad que se indica en el Aviso de privacidad. Los canales externos de NexaTech se publican una vez validados.

En una relación de consumo efectiva, puedes solicitar orientación o presentar una reclamación ante la Procuraduría Federal del Consumidor (Profeco) por los canales que correspondan al proveedor. El seguimiento interno de una solicitud no condiciona ese derecho.$support$);

UPDATE public.legal_document d SET withdrawn_at = statement_timestamp()
FROM nexa_store_policies p
WHERE d.kind = p.kind AND d.withdrawn_at IS NULL AND d.published_at <= statement_timestamp();

INSERT INTO public.legal_document (kind, version, title, body, sha256, published_at)
SELECT p.kind, coalesce(max(d.version), 0) + 1, p.title, p.body,
  encode(sha256(convert_to(p.body, 'UTF8')), 'hex'), statement_timestamp()
FROM nexa_store_policies p LEFT JOIN public.legal_document d ON d.kind = p.kind
GROUP BY p.kind, p.title, p.body;
