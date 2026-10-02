Datos de regresión extraídos de los MP4 sintéticos anteriores de dos ciclistas,
no señales ideales creadas para el detector. Cada archivo es JSON comprimido
con gzip y codificado en base64 para mantener los fixtures pequeños y legibles
por las herramientas de GitHub.

Modelo: pose_landmarker_lite/float16/1, MediaPipe Python 0.10.32, CPU,
modo VIDEO, num_poses=8, umbrales .5. 300 fotogramas a 30 fps por vista.
Contienen las posiciones reales devueltas por MediaPipe para hombros,
caderas, rodillas y tobillos; no son posiciones geométricas del generador.
Las demás posiciones no intervienen en estas pruebas.

Referencias del vídeo: naranja/izquierda 65 rpm, azul/derecha 85 rpm.
Los IDs del detector pueden diferir de A/B del vídeo.

Estos clips se han utilizado para corregir y ajustar el detector. Son pruebas
de regresión, no una validación independiente ni una prueba del navegador/GPU.
La vista lateral sigue teniendo cobertura baja por oclusión y puntos erróneos.
