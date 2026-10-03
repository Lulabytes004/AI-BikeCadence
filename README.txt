BIKE CADENCE VISION v0.3 — cámara y vídeo local

Medición: measure.html. Juego de plataformas: game.html.

Uso
1. Abrir measure.html desde HTTPS o localhost.
2. Elegir “Iniciar cámara” o “Cargar vídeo” (MP4 H.264 recomendado).
3. El vídeo se procesa en el dispositivo; no se envía a un servidor.
   La primera carga descarga MediaPipe y su modelo desde sus CDN.
4. Puede analizar hasta dos ciclistas con historiales independientes.
5. Reproducir, pausar, cambiar velocidad o avanzar un fotograma.
   Ajustar los FPS de avance al archivo (30 para los ejemplos).
6. Al buscar otra posición o repetir el vídeo, se reinicia la medición.
   Al pausar se conserva el último resultado, sin añadir ciclos.

Pruebas reproducibles
- Abrir “Pruebas y diagnóstico” y escribir las RPM conocidas según el orden
  izquierda/derecha inicial. Ejemplo: azul 85 y naranja 65; comprobar el orden
  en cada perspectiva.
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
- Identificación por proximidad de cadera: adecuada para bicicletas fijas;
  puede perder la identidad si las personas se cruzan u ocultan.
- Registro exportable limitado a los últimos 10 minutos por sesión.
