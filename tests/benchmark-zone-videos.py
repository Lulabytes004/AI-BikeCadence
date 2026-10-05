"""Offline detector comparison. Requires numpy, pillow, opencv-python,
onnxruntime and mediapipe. Does not upload videos or download weights.
python tests/benchmark-zone-videos.py --model weights.onnx --videos clips/*.mp4 --output results.json
Results are detector proposals, NOT verified bicycle counts or cadence accuracy.
"""
import argparse, json, time
from pathlib import Path
import cv2, numpy as np
from PIL import Image

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--model', required=True)
p.add_argument('--videos', nargs='+', required=True)
p.add_argument('--output', required=True)
a=p.parse_args()
if Path(a.model).suffix == '.onnx':
 import onnxruntime as ort
 ort.disable_telemetry_events()
 options=ort.SessionOptions(); options.intra_op_num_threads=2
 session=ort.InferenceSession(a.model, sess_options=options, providers=['CPUExecutionProvider'])
 inp=session.get_inputs()[0]; out=session.get_outputs()[0]
 if inp.shape != [1,3,640,640] or out.shape != [1,84,8400] or inp.type != 'tensor(float)':
  raise ValueError(f'Expected COCO float32 [1,3,640,640] -> [1,84,8400], got {inp.shape} {inp.type} -> {out.shape}')
 def detect(rgb):
  h,w=rgb.shape[:2]; scale=min(640/w,640/h); rw=int(w*scale+.5); rh=int(h*scale+.5)
  px=(640-rw)//2; py=(640-rh)//2
  canvas=Image.new('RGB',(640,640),(114,114,114)); canvas.paste(Image.fromarray(rgb).resize((rw,rh),Image.Resampling.BILINEAR),(px,py))
  tensor=np.asarray(canvas,dtype=np.float32).transpose(2,0,1)[None]/255
  pred=session.run(None,{inp.name:tensor})[0][0]; labels=pred[4:].argmax(axis=0); scores=pred[4:].max(axis=0)
  boxes=[]
  for i in np.where((labels<2)&(scores>=.45))[0]:
   cx,cy,bw,bh=pred[:4,i]; x1=max(0,float((cx-bw/2-px)/scale)); y1=max(0,float((cy-bh/2-py)/scale)); x2=min(w,float((cx+bw/2-px)/scale)); y2=min(h,float((cy+bh/2-py)/scale))
   if x2>x1 and y2>y1: boxes.append(dict(label=['person','bicycle'][labels[i]],score=float(scores[i]),x=x1,y=y1,w=x2-x1,h=y2-y1))
  kept=[]
  for b in sorted(boxes,key=lambda b:-b['score']):
   def redundant(c):
    inter=max(0,min(b['x']+b['w'],c['x']+c['w'])-max(b['x'],c['x']))*max(0,min(b['y']+b['h'],c['y']+c['h'])-max(b['y'],c['y']))
    return b['label']==c['label'] and inter/(b['w']*b['h']+c['w']*c['h']-inter)>.45
   if not any(redundant(c) for c in kept): kept.append(b)
   if len(kept)>=30: break
  return kept
else:
 import mediapipe as mp
 detector=mp.tasks.vision.ObjectDetector.create_from_options(mp.tasks.vision.ObjectDetectorOptions(base_options=mp.tasks.BaseOptions(model_asset_path=a.model),score_threshold=.45,max_results=30))
 def detect(rgb):
  result=detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=np.ascontiguousarray(rgb)))
  boxes=[]
  for d in result.detections:
   c=d.categories[0]; label=c.category_name
   if label in ['bicicleta','bicicleta_spinning']: label='bicycle'
   if label not in ['person','bicycle']:continue
   b=d.bounding_box; boxes.append(dict(label=label,score=c.score,x=b.origin_x,y=b.origin_y,w=b.width,h=b.height))
  return boxes
rows=[]
for path in a.videos:
 cap=cv2.VideoCapture(path)
 if not cap.isOpened(): raise ValueError('Cannot open '+path)
 started=time.monotonic()
 for t in [0,700,1400,2100,2800,3500]:
  cap.set(cv2.CAP_PROP_POS_MSEC,t); ok,bgr=cap.read()
  if not ok:raise ValueError(f'Cannot read {path} at {t} ms')
  h,w=bgr.shape[:2]; rgb=cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB); boxes=[]
  for x,y,cw,ch in [(0,0,1,1),(0,0,.6,.6),(.4,0,.6,.6),(0,.4,.6,.6),(.4,.4,.6,.6)]:
   x0,y0=int(x*w),int(y*h); tw,th=round(cw*w),round(ch*h)
   for b in detect(rgb[y0:y0+th,x0:x0+tw]):
    boxes.append(dict(b,x=(x0+b['x'])/w,y=(y0+b['y'])/h,w=b['w']/w,h=b['h']/h))
  rows.append(dict(source=Path(path).name,time=t,boxes=boxes))
 cap.release();print(Path(path).name,round(time.monotonic()-started,2),'s',flush=True)
Path(a.output).write_text(json.dumps(dict(model=Path(a.model).name,threshold=.45,rows=rows),indent=2))
