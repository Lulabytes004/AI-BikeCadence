BIKE CADENCE VISION — prototipo

1. La cámara del navegador requiere HTTPS en iPhone (salvo localhost).
2. Publica index.html en GitHub Pages, Netlify, Vercel o cualquier hosting HTTPS.
3. Abre la URL en Safari y pulsa “Iniciar cámara”.
4. Da permiso de cámara.
5. Coloca el teléfono aproximadamente lateral al ciclista, mostrando cadera, rodilla y tobillo.

Algoritmo: MediaPipe Pose Landmarker local en navegador. Selecciona la pierna con mayor visibilidad, calcula el ángulo cadera-rodilla-tobillo y detecta mínimos periódicos de flexión. El intervalo entre mínimos se convierte a RPM y se suaviza.

Nota: es un prototipo experimental; hay que validar y ajustar umbrales con vídeos reales de ciclismo.
