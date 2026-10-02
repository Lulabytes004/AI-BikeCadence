import argparse, json, time
from pathlib import Path
import cv2, numpy as np, mediapipe as mp
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import PoseLandmarker, PoseLandmarkerOptions, RunningMode
p=argparse.ArgumentParser();p.add_argument('video');p.add_argument('--model',required=True);p.add_argument('--poses',type=int,default=8);p.add_argument('--output',required=True);p.add_argument('--freeze-at',type=float);a=p.parse_args()
cap=cv2.VideoCapture(a.video)
if not cap.isOpened():raise RuntimeError('No se pudo abrir el vídeo')
fps=cap.get(cv2.CAP_PROP_FPS)
if not fps>0:raise RuntimeError('El vídeo no informa de una frecuencia de fotogramas válida')
width=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH));height=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
options=PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=a.model),running_mode=RunningMode.VIDEO,num_poses=a.poses,min_pose_detection_confidence=.5,min_pose_presence_confidence=.5,min_tracking_confidence=.5)
frames=[];i=0;counts={};started=time.monotonic();frozen=None
with PoseLandmarker.create_from_options(options) as model:
 while True:
  ok,bgr=cap.read()
  if not ok:break
  if a.freeze_at is not None and i/fps>=a.freeze_at:
   if frozen is None:frozen=bgr.copy()
   bgr=frozen
  rgb=cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB)
  result=model.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB,data=np.ascontiguousarray(rgb)),int(round(i*1000/fps)))
  poses=[[{'x':v.x,'y':v.y,'z':v.z,'visibility':v.visibility,'presence':v.presence} for v in pose] for pose in result.pose_landmarks]
  frames.append({'time_ms':i*1000/fps,'poses':poses,'frozen_pixels':a.freeze_at is not None and i/fps>=a.freeze_at+.65})
  counts[len(poses)]=counts.get(len(poses),0)+1;i+=1
  if i%100==0:print(json.dumps({'video':Path(a.video).name,'frames':i,'pose_counts':counts}),flush=True)
cap.release()
Path(a.output).write_text(json.dumps({'version':1,'source':str(Path(a.video).name),'engine':'MediaPipe Python CPU '+mp.__version__,'num_poses':a.poses,'width':width,'height':height,'references':[None]*a.poses,'frames':frames}))
print(json.dumps({'video':Path(a.video).name,'frames':i,'pose_counts':counts,'seconds':time.monotonic()-started,'output':a.output}),flush=True)
