# Modelos ampliados: comprobación del 5 de octubre de 2026

Se añaden YOLO11s, YOLO11m y EfficientDet-Lite2 al selector existente. No se cambia el modelo de postura ni se afirma que las RPM de ocho ciclistas estén resueltas.

## Detección en los seis vídeos esquemáticos

Lite0, Lite2 y YOLO11s: seis instantes por vídeo (0; 0,7; 1,4; 2,1; 2,8; 3,5 s), imagen completa y cuatro recortes de 60% solapados, umbral 0,45. Inferencia CPU nativa y confirmación posterior con el `BikeZones` de esta rama. Esta tabla aísla el detector de objetos, **sin las propuestas adicionales del modelo de postura**. Son zonas propuestas mediante personas, no bicicletas verificadas ni una medida de exactitud.

| Vídeo | Ocupantes de referencia | Lite0 | Lite2 | YOLO11s |
|---|---:|---:|---:|---:|
| Dos, frontal | 2 | 0 | 0 | 0 |
| Dos, lateral | 2 | 2 | 0 | 0 |
| Dos, 45° | 2 | 1 | 0 | 0 |
| Ocho, frontal | 8 | 2 | 0 | 0 |
| Ocho, lateral | 8 | 8 | 0 | 0 |
| Ocho, 45° | 8 | 8 | 0 | 4 |

Ninguno produjo cajas de clase `bicycle` sobre el umbral en estas muestras. Los resultados no justifican cambiar el detector por defecto a uno mayor.

YOLO11m se comprobó por separado en Chromium 134, ONNX Runtime Web 1.22.0 WASM, con el preprocesado y decodificador reales de `zone-detectors.js`. Se tomó el instante 2 s de cada uno de los seis vídeos, con los mismos cinco recortes. No produjo cajas de bicicletas; solo una propuesta de persona en la vista de ocho a 45°. Este muestreo **no equivale a seis observaciones temporales** ni permite comparar zonas confirmadas con la tabla anterior. Cada conjunto de cinco recortes tardó aproximadamente 16,5–19 segundos en este entorno; no es un tiempo garantizado para otros equipos.

Un experimento independiente con posturas sobre seis recortes adicionales tampoco mejoró consistentemente la cobertura e introdujo una tercera zona en un vídeo con dos ocupantes. No se incorporó ese experimento al producto.

## Correcciones funcionales

- Las zonas caducaban por tiempo antes de recibir otra inferencia lenta. Ahora se eliminan tras dos observaciones consecutivas sin coincidencia. Siguen necesitando tres observaciones y al menos 800 ms de vídeo para confirmarse.
- «Analizar zonas / repetir» toma seis muestras mientras el archivo está pausado. Espera a que termine cada inferencia, restaura la posición inicial y reinicia el historial de cadencia; las muestras de exploración no generan lecturas RPM.
- Para cámara, el botón reinicia la exploración y reanuda la captura.

## Verificación

`node --test tests/*.test.cjs`: 41 pruebas superadas, incluyendo regresiones de cadencia, fotograma congelado, caducidad con detección lenta y exploración pausada sin inferencias solapadas.

Chromium: selector con seis opciones; carga e inferencia real de Lite2, YOLO11s y YOLO11m; cero detecciones en el lienzo blanco usado como comprobación básica. Exploración completa del vídeo frontal de ocho con Lite2: seis muestras, posición restaurada a 0 s, vídeo pausado e historial RPM vacío. Ese caso no confirmó zonas; el flujo funciona, el reconocimiento sigue fallando.

Los recursos públicos se descargaron previamente y se sirvieron al navegador durante la prueba porque la conexión directa del navegador al CDN fallaba en este entorno. No se ha validado aquí la descarga directa del CDN desde el equipo del usuario ni el rendimiento de un móvil. No se incorporan vídeos, fotogramas ni modelos privados al repositorio.

## Repetir la comparación local

Instalar `numpy`, `pillow`, `opencv-python-headless`, `onnxruntime` y `mediapipe` en un entorno independiente. Descargar los pesos correspondientes a las URLs fijadas en `zone-detectors.js` y ejecutar:

```sh
python tests/benchmark-zone-videos.py --model /ruta/modelo.onnx --videos /ruta/videos/*.mp4 --output resultados.json
```

También admite modelos `.tflite` con metadatos compatibles con MediaPipe. Genera propuestas normalizadas por muestra; no calcula AP, ni deduce las cadencias a partir de los rótulos del vídeo. Los datos se mantienen en el equipo.

El paso pendiente es adaptar y validar el reconocimiento sobre dibujos esquemáticos, manteniendo ejemplos de prueba separados por escena. El aumento de tamaño del modelo no ha resuelto esa diferencia de aspecto. El análisis de postura por zona y la validación completa de ocho RPM siguen pendientes.
