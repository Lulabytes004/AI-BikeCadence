BIKE CADENCE VISION v0.4 — rama feat/eight-cyclists — cámara y vídeo local

Medición: measure.html. Juego de plataformas: game.html.

Uso
1. Abrir measure.html desde HTTPS o localhost.
2. Elegir “Iniciar cámara” o “Cargar vídeo” (MP4 H.264 recomendado).
3. El vídeo se procesa en el dispositivo; no se envía a un servidor.
   La primera carga descarga MediaPipe y su modelo desde sus CDN.
4. Puede analizar hasta ocho ciclistas con historiales independientes.
5. Reproducir, pausar, cambiar velocidad o avanzar un fotograma.
   Ajustar los FPS de avance al archivo (30 para los ejemplos).
6. Al buscar otra posición o repetir el vídeo, se reinicia la medición.
   Al pausar se conserva el último resultado, sin añadir ciclos.

Pruebas reproducibles
- Abrir “Pruebas y diagnóstico” y escribir las RPM conocidas según los
  números C1–C8 que aparecen sobre cada persona.
- Activar “Congelar imagen de entrada” durante reproducción. Tras 650 ms de
  cuadros idénticos, la lectura debe ser 0 y no debe contar nuevos ciclos.
- Exportar CSV para revisar RPM, confianza, método y ciclos por fotograma.
- Exportar puntos JSON para repetir el cálculo sin cámara ni navegador:
    node tests/replay-landmarks.cjs cadence-landmarks.json
    node tests/replay-landmarks.cjs cadence-landmarks.json --freeze-from=5000
- Ejecutar las pruebas del detector:
    node --test tests/*.test.cjs
- Servir la copia local:
    python3 -m http.server 8080
  Abrir http://localhost:8080/measure.html.

Detector
- cadence.js contiene el cálculo puro, compartido por navegador y pruebas.
- Cada señal (ángulos, rodillas, tobillos y diferencia de pies) mantiene su
  historial y fase. Cambiar de señal no combina tiempos de picos distintos.
- Se exige amplitud mínima, periodicidad y al menos 2,5 periodos de evidencia.
  El rango de búsqueda es 25–180 rpm.
- Los tiempos proceden del vídeo: reproducir a 0,5× o 2× no multiplica las RPM.
- La visibilidad sola no acredita movimiento. Las fluctuaciones pequeñas de
  los puntos no deben producir ciclos. Se borran lecturas obsoletas al detenerse.
- La escala se obtiene del torso, evitando dividir por la longitud variable
  entre cadera y tobillo. Los ángulos corrigen la relación de aspecto del vídeo.

Límites de esta versión
- Las pruebas automáticas verifican el cálculo con señales y poses controladas;
  no certifican que el modelo reconozca correctamente cada vídeo real.
- Las animaciones esquemáticas pueden no ser reconocidas como personas.
  Se necesitan clips reales para ajustar los umbrales y validar la pose.
- Se cuentan ciclos confirmados después de adquirir la periodicidad; no se
  reconstruyen las primeras vueltas del clip.
- Identificación por asignación global de caderas (hasta ocho): adecuada para bicicletas fijas;
  puede perder la identidad si las personas se cruzan u ocultan.
- Registro exportable limitado a los últimos 10 minutos por sesión.

Rama de ocho ciclistas
- Configura MediaPipe con numPoses=8, ocho colores y ocho referencias RPM.
- Mantiene como máximo ocho historiales con números reutilizables tras una
  ausencia de 1,2 s. La asignación global evita que un emparejamiento voraz
  mezcle dos personas cercanas. No es un sistema de reconocimiento personal.
- El reconocimiento de ocho cuerpos y el rendimiento en móvil requieren
  validación con vídeo real. No se garantiza tiempo real en todos los equipos.
- Vídeos sintéticos de prueba: 10 s / 30 fps / 1920×1080, ocho paneles sin
  solapamiento y referencias de 50,60,70,80,90,100,110,120 RPM.

Corrección tras probar los MP4 anteriores de dos ciclistas
- Se conservan pérdidas de puntos de hasta 300 ms sin mostrar una lectura
  cuando la persona o la señal no están visibles.
- Mediana de tres muestras y eliminación de deriva lenta; comparación
  de ventanas de 3, 4,5 y 6,5 s y concordancia de las señales.
- Una cadencia nueva requiere 600 ms de estimaciones consistentes.
- Se descartan ángulos con segmentos colapsados o geometría inverosímil.
- Los fixtures ahora incluyen puntos detectados por MediaPipe en los tres
  MP4 de dos ciclistas. Ver tests/VIDEO_VALIDATION.md para cifras y límites.
- La vista lateral sigue ofreciendo lecturas intermitentes; el cambio no
  acredita detección continua con ocho personas ni funcionamiento en GPU.

Comparar modelos de zonas
------------------------
En measure.html, el selector «Detector de bicicletas» permite alternar EfficientDet-Lite0 original, EfficientDet-Lite2, EfficientDet entrenado mediante archivo local y YOLO11n/s/m COCO. No cambia el modelo de postura ni el algoritmo de cadencia. Cada cambio pausa el vídeo y reinicia el historial; reproduce el mismo fragmento desde el inicio para comparar. Las cajas continuas son bicicletas confirmadas, las discontinuas siguen siendo estimaciones por personas. El JSON exportado identifica el detector.
YOLO11n descarga sus pesos públicos al seleccionarlo por primera vez. Para el detector entrenado, extrae tu ZIP y pulsa «Cargar modelo entrenado» para elegir model.tflite; se carga en memoria y no se publica ni se sube. No hay que subir el vídeo a ningún servicio. Los runtimes externos y el EfficientDet original requieren red en la primera carga.

Modelos ampliados y análisis de vídeos lentos
- «Analizar zonas / repetir» pausa el vídeo y examina seis instantes, esperando
  cada inferencia. Después restaura la posición y deja el vídeo en pausa.
- Las zonas necesitan tres observaciones en un intervalo de al menos 800 ms.
  Se retienen durante una observación perdida y se borran tras dos; un modelo
  lento ya no las pierde solo por tardar más de 1,8 segundos entre muestras.
- YOLO11s y YOLO11m usan exportaciones COCO float32 640×640 con 80 clases,
  revisión fija 8b180c762d5cf217886d16e64403508042207e4d de giangndm/yolo11-onnx.
  Pesos públicos: unos 39 MB y 81 MB. Se mantienen las licencias del proveedor
  y los metadatos Ultralytics AGPL-3.0. No se incluyen vídeos ni pesos privados.
- Prueba reproducible por CLI: tests/benchmark-zone-videos.py. Ver
  tests/ADVANCED_MODEL_VALIDATION.md para resultados y limitaciones.

INTERFAZ DE COMPARACIÓN DE MODELOS
1. Modelo: EfficientDet-Lite0/1/2/3 INT8, EfficientDet local, YOLOv8n/m,
   YOLO11n/s o local, YOLO26n/s y YOLO26n/s-pose.
2. Objetos: Todo (80 categorías COCO), Persona, Bicicleta o Moto.
   Pose solo admite Persona. Los modelos entrenados de bicicletas admiten
   Todo o Bicicleta; mantienen las categorías del archivo personalizado.
   Confianza inicial 0,25; máximo de detecciones inicial 20, configurable.
3. Capas: únicamente Detector comienza activo. Recortes, Confirmar zonas,
   Posturas y Cadencia se activan por separado. Cadencia requiere Posturas.
   «Solo detector» apaga las capas adicionales y conserva el objeto elegido.
Los tamaños EfficientDet son aproximados y corresponden al archivo INT8.
Lite3 se descarga desde el enlace oficial y se carga como archivo .tflite.

El selector muestra el tamaño real aproximado del archivo servido, en MiB,
formato y latencia de referencia. YOLO: ONNX 640×640, CPU de ordenador.
EfficientDet: Pixel 4 CPU, 4 hilos, entradas Lite0 320, Lite1 384, Lite2 448,
Lite3 512. No son mediciones del navegador ni incluyen capas adicionales.
Los modelos personalizados muestran el tamaño del archivo cargado.

CARGA DE MODELOS
Seleccionar un modelo activa el Detector e inicia su carga directamente.
El aviso junto al selector muestra motor, descarga con bytes y preparación.
«LISTO» significa sesión inicializada, no garantiza detecciones correctas.
La reproducción y ajustes permanecen bloqueados durante la carga.
El cambio pausa el vídeo: al ver LISTO, pulsa Reproducir.
Los errores de descarga e inferencia se muestran junto al selector.
YOLOv8n y m muestran referencias .pt 6,2 y 52 MB, separadas de los tamaños
ONNX reales utilizados por el navegador.
