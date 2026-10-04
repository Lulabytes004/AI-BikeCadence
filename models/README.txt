Modelos para comparar detección de zonas; ninguno estima RPM.

Modelo entrenado del usuario: NO se incluye en el repositorio. Extraer el ZIP del resultado y elegir model.tflite en «Cargar modelo entrenado». Se conserva únicamente en memoria del navegador durante la sesión; no se sube ni persiste. Las categorías españolas se normalizan a bicycle. No contiene person; las zonas estimadas por postura siguen disponibles.

yolo11n.onnx: YOLO11n preentrenado COCO, conversión ONNX distribuida por webnn/yolo11n en Hugging Face. Revisión 9c5acfdd74aaff2d0f47c51b878506361039a51f, archivo onnx/yolo11n.onnx. Entrada float32 RGB NCHW [1,3,640,640], salida [1,84,8400]. Letterbox 114, escala 0..1, NMS por categoría. Se conservan person y bicycle. Modelo de Ultralytics: revisar AGPL-3.0/Enterprise antes de distribuir en una aplicación cerrada.

El EfficientDet original se descarga desde la URL oficial de MediaPipe. Los runtimes se descargan desde jsDelivr la primera vez; no se envían los vídeos a un servidor. Esto no equivale a funcionamiento completamente offline sin preparar la caché.

Cambiar el selector pausa el vídeo y reinicia historial y zonas. Para comparar, sitúa el mismo vídeo al inicio y reproduce cada modelo. El JSON de diagnóstico incluye zone_model y zone_model_name.
