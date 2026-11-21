# Catálogo académico de NexaTech

Verificación del 20 de noviembre de 2026. Los nombres comerciales, configuraciones y precios de la semilla corresponden a líneas ficticias de NexaTech, Auralis y Sonus. Las especificaciones, la disponibilidad inicial y los precios anteriores son datos académicos. Los precios están expresados en MXN y guardados como enteros en centavos. Las **153 fichas tienen precios simulados**. La semilla E1 no incluye precios de mercado verificados.

| Categoría | Fichas anteriores | Nuevas | Total |
| --- | ---: | ---: | ---: |
| Computadoras | 5 | 45 | 50 |
| Audio | 5 | 45 | 50 |
| Smartphones | 5 | 45 | 50 |
| Accesorios, Monitores y Wearables | 3 | 0 | 3 |
| **Total** | **18** | **135** | **153** |

Las nuevas fichas combinan quince familias con nueve configuraciones cada una. La semilla registra una variante vendible por ficha, con SKU único, precio, acabado y existencias. Añade peso y dimensiones de referencia en las nuevas variantes. Los quince artículos inicialmente agotados tienen inventario cero. El resto tiene un movimiento de apertura por variante. Las fichas conservan los UUID, SKU, slugs e IDs legados de las 18 entradas previas.

La [semilla de E1](../dataconnect/seed/catalog-e1.sql) carga después de [demo.sql](../dataconnect/seed/demo.sql) en la misma transacción. Solo completa metadatos de fichas conocidas cuando `specs` está vacío. En la posición principal reemplaza las referencias identificadas de Unsplash del prototipo. Otras imágenes existentes se conservan. La [guía local](implementacion-local.md) documenta la carga y las pruebas.

## Registro de imágenes

Los JPG de [public/catalogo](../public/catalogo) son ilustraciones de referencia reutilizadas por familia de dispositivos. El color y la forma de cada entrega académica pueden variar respecto a la ilustración. El catálogo conserva el texto alternativo y crédito por ficha. La verificación consistió en revisar las dos composiciones generadas y confirmar los JPG, sus rutas y la atribución después de aplicar la semilla.

| Archivos | Fuente y autoría | Licencia o autorización de uso | Verificación |
| --- | --- | --- | --- |
| `portatil.jpg`, `audifonos.jpg`, `telefono.jpg`, `reloj.jpg`, `monitor.jpg`, `teclado.jpg` | NexaTech E1, generación original mediante OpenAI ImageGen integrado, primera composición de estudio | Material generado expresamente para uso en NexaTech, sin licencia de terceros asociada | 20 de noviembre de 2026 |
| `mini-pc.jpg`, `buds.jpg`, `altavoz.jpg`, `telefono-perfil.jpg`, `portatil-detalle.jpg`, `audifonos-detalle.jpg` | NexaTech E1, generación original mediante OpenAI ImageGen integrado, segunda composición de estudio | Material generado expresamente para uso en NexaTech, sin licencia de terceros asociada | 20 de noviembre de 2026 |

## Instrucciones usadas en ImageGen

1. Product mockup for fictional NexaTech electronics catalog. Create one LANDSCAPE 3:2 contact sheet of exactly SIX distinct studio product photographs on a seamless very pale icy blue-gray background (#edf3f8). Exactly 3 equal columns and 2 equal rows, no visible dividing lines, each object entirely within its cell with generous 12% clear margins on all four sides for clean cropping. Top row: slim open midnight-blue laptop in three-quarter view with abstract deep cobalt screen, cream wireless over-ear headphones in three-quarter view, two midnight-blue smartphones one facing front one back with abstract cobalt screen. Bottom row: graphite smartwatch, premium widescreen monitor with slate-cobalt abstract screen, compact graphite keyboard. Photorealistic rendered product photography, crisp soft directional shadows, minimalist Spanish tech store editorial art direction, no persons, no logos, no text, no watermark, no props.
2. Fictional NexaTech electronics product catalog, LANDSCAPE 3:2 contact sheet, EXACTLY 3 columns and 2 rows, 6 evenly spaced separate studio product shots. Background seamless very pale icy blue-gray (#edf3f8), soft crisp grounding shadows. Each object entirely inside its cell with generous 12% crop margins, no gridlines. Top row: dark compact rectangular mini PC with small blue light; pair of cream true wireless earbuds with charging case; small dark navy portable cylindrical Bluetooth speaker. Bottom row: thin blue phone in side profile with a back view floating beside it; macro still-life of the edge and keyboard of a midnight blue laptop with cobalt screen from above; close detail of cream over-ear headphone headband and ear cushion. Fine clean product photography, original industrial designs, ultra realistic, no logos, lettering, watermarks, or props.
