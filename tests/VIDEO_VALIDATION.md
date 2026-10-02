# Prueba con los MP4 de dos ciclistas

MediaPipe Python 0.10.32 CPU, mismo modelo Lite y `num_poses=8`; puntos extraídos de 300 fotogramas por vista y reproducidos con `cadence.js`. Esto prueba el modelo y el cálculo en local, no la interfaz ni la GPU del navegador.

| Vista | Referencia RPM | Última lectura válida | Error absoluto medio al medir | Fotogramas con lectura / total |
|---|---:|---:|---:|---:|
| spinning_frontal_10s.mp4 | 85 | 84.62 | 0.42 | 228/300 |
| spinning_frontal_10s.mp4 | 65 | 65.13 | 0.41 | 209/299 |
| spinning_lateral_10s.mp4 | 85 | 85.42 | 1.24 | 75/300 |
| spinning_lateral_10s.mp4 | 65 | 65.37 | 0.60 | 104/297 |
| spinning_45_grados_10s.mp4 | 65 | 65.17 | 0.29 | 210/300 |
| spinning_45_grados_10s.mp4 | 85 | 84.12 | 0.45 | 226/300 |

La cobertura incluye el tiempo inicial necesario para adquirir la periodicidad. En lateral la medición continúa siendo intermitente; no se considera resuelto el reconocimiento de puntos con oclusiones. Estos clips se usaron para ajustar el detector: las cifras son regresión sobre esos clips, no una validación independiente.

En una segunda ejecución del frontal se congeló realmente el fotograma a los 5 s antes de pasarlo a MediaPipe. Después del margen de 650 ms, 130 fotogramas congelados devolvieron 0 RPM sin nuevos ciclos.

Fallos corregidos: borrado de historiales por pérdidas breves; saltos de landmarks; deriva lenta; selección de múltiplos del periodo; estimaciones transitorias al cambiar de señal. Se mantienen señales individuales y se compara su concordancia.

Reproducir el análisis:

```bash
python3 -m pip install mediapipe==0.10.32
python3 tests/extract-video-poses.py VIDEO.mp4 --model pose_landmarker_lite.task --poses 8 --output puntos.json
node tests/replay-landmarks.cjs puntos.json
node --test tests/*.test.cjs
```

El modelo usado es el mismo archivo indicado en `measure.js`. El exportador deja las referencias vacías: asignarlas según los números del detector antes de calcular errores.
