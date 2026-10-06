Detector layer validation

Added YOLO26n/s/m and YOLO26n-pose; source URLs are pinned in zone-detectors.js.
Downloaded real artifacts and passed onnx.checker.check_model for all four and YOLO11m.
YOLO26 detection input: pixel_values float32 [batch_size,3,640,640]; outputs logits [batch_size,300,80] and pred_boxes [batch_size,300,4], normalized xywh.
Pose input same; logits [batch_size,300,57], normalized xyxy and 17 point triplets. Export graph divides boxes and point triplets by 640. Reader restores coordinates and point confidence before letterbox reversal.
YOLO11m: images float32 [1,3,640,640], output0 [1,84,8400]. Structure valid; no image accuracy claim.
47 automated tests pass, including class filtering, max_det, processed/split layouts and pose.
Native runtime inference was blocked by automatic review because of Microsoft telemetry; not retried. Browser inference and matching image accuracy remain unverified for these new models.
COCO filters apply before application max_det (default20, range1..300). All classes bypasses category filtering, not confidence or raw-output NMS. Split end-to-end output is not externally suppressed.
Pose is detector output only: does not calculate cadence. Tests should use Only bicycles mode to isolate this layer.
