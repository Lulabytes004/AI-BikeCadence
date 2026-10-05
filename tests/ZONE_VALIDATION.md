# Detección automática de zonas

Primera capa experimental: dibuja y exporta zonas estables Z1–Z8. El análisis de postura/cadencia existente todavía usa la imagen completa; no se afirma que ya existan ocho procesos de postura independientes.

El modelo EfficientDet-Lite0 busca `bicycle` y `person`, en la imagen completa y cuatro recortes solapados. Las poses de MediaPipe aportan propuestas adicionales de personas cuando el detector de objetos no las encuentra. Una bicicleta y su ocupante se unen en una zona. Sin una bicicleta reconocida, la zona se identifica explícitamente como estimada por una persona, con borde discontinuo. Esto también puede incluir personas que no estén pedaleando.

Se toman seis muestras separadas por al menos 650 ms. Una zona necesita tres observaciones durante al menos 800 ms; se tolera una observación perdida; dos muestras consecutivas sin verla la eliminan. Al finalizar la exploración se fijan las zonas. Cambiar la fuente, buscar otra posición o reiniciar la medición las borra. “Volver a detectar zonas” inicia otra exploración. Si se mueve la cámara, hay que repetirla. El JSON versión 3 incluye `zones` y `zones_locked`; los números Z son independientes de los números C del seguimiento actual.

## Comprobación local

MediaPipe Python 0.10.32 CPU, EfficientDet-Lite0 float32/1 y PoseLandmarker Lite float16/1 en modo IMAGE. Se extrajeron detecciones de seis instantes (0; 0,7; 1,4; 2,1; 2,8; 3,5 s) de cada MP4 sintético generado anteriormente y se procesaron con `bike-zones.js`. El fixture contiene cajas detectadas, no zonas dibujadas a mano.

| Vídeo | Ocupantes conocidos | Zonas confirmadas |
|---|---:|---:|
| Dos, frontal | 2 | 2 |
| Dos, lateral | 2 | 2 |
| Dos, 45° | 2 | 2 |
| Ocho, frontal | 8 | 2 |
| Ocho, lateral | 8 | 8 |
| Ocho, 45° | 8 | 8 |

Todas estas zonas proceden de personas: el detector no clasificó los dibujos de bicicletas como `bicycle`. La vista frontal de ocho sigue incompleta. No se ha validado reconocimiento de bicicletas de spinning reales ni rendimiento/GPU del navegador. En la web, el respaldo de poses usa el modelo VIDEO ya existente, por lo que sus resultados pueden diferir del muestreo IMAGE de esta prueba.

Pruebas de geometría, duplicados, confirmación temporal, fijación, reinicio y exportación: `node --test tests/bike-zones.test.cjs tests/zone-ui.test.cjs`. La prueba de interfaz usa modelos simulados; no reemplaza una ejecución del navegador con los modelos descargados.

Modelos oficiales utilizados:
- https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite
- https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
