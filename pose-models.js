import {createZoneDetector,downloadModel} from './zone-detectors.js?v=v8pose1';
export const POSE_MODELS={
 yolov8pose:{name:'YOLOv8n-pose',yolo:true},
 mediapipe_lite:{name:'MediaPipe Pose Lite',variant:'lite'},
 mediapipe_full:{name:'MediaPipe Pose Full',variant:'full'},
 mediapipe_heavy:{name:'MediaPipe Pose Heavy',variant:'heavy'},
 yolo11pose:{name:'YOLO11n-pose',yolo:true},
 yolo26pose:{name:'YOLO26n-pose',yolo:true},
 yolo26spose:{name:'YOLO26s-pose',yolo:true}
};
const COCO_TO_MP=[0,2,5,7,8,11,12,13,14,15,16,23,24,25,26,27,28];
export function cocoLandmarks(points,width,height){
 const landmarks=Array.from({length:33},()=>({x:0,y:0,z:0,visibility:0}));
 points.forEach((p,i)=>{if(COCO_TO_MP[i]!==undefined)landmarks[COCO_TO_MP[i]]={x:p.x/width,y:p.y/height,z:0,visibility:Math.max(0,Math.min(1,p.score??0))};});
 return landmarks;
}
export function cropRectangle(zone,width,height){
 const x=Math.max(0,Math.floor(zone.x*width)),y=Math.max(0,Math.floor(zone.y*height));
 const right=Math.min(width,Math.ceil((zone.x+zone.w)*width)),bottom=Math.min(height,Math.ceil((zone.y+zone.h)*height));
 return {x,y,w:Math.max(0,right-x),h:Math.max(0,bottom-y)};
}
export function restoreLandmarks(landmarks,rect,width,height){
 return landmarks.map(p=>({...p,x:(rect.x+p.x*rect.w)/width,y:(rect.y+p.y*rect.h)/height,z:(p.z??0)*rect.w/width}));
}
export function selectCropPose(poses){
 // Prefer a visible torso near the crop centre over a neighbouring rider.
 return poses.slice().sort((a,b)=>rank(b)-rank(a))[0];
 function rank(p){const hip=(p[23].x+p[24].x)/2;return Math.min(...[11,12,23,24].map(i=>p[i].visibility??0))-.5*Math.abs(hip-.5);}
}
export async function createPoseModel(key,{onProgress=()=>{},maxPoses=32,scope='zones'}={}){
 const config=POSE_MODELS[key];if(!config)throw Error('Modelo de postura desconocido.');
 onProgress({stage:'runtime'});
 let backend;
 if(config.yolo){
  const detector=await createZoneDetector(key,null,.25,{classIds:[0],maxDet:scope==='zones'?1:maxPoses,onProgress});
  backend={async detect(input){const result=await detector.detect(input);return result.detections.map(d=>cocoLandmarks(d.keypoints??[],input.width,input.height));},close:()=>detector.close()};
 }else{
  const mod=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32');
  const vision=await mod.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');
  // IMAGE mode avoids sharing temporal tracking state between different zone crops.
  const bytes=await downloadModel(`https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${config.variant}/float16/1/pose_landmarker_${config.variant}.task`,onProgress);
  onProgress({stage:'prepare'});
  const options={baseOptions:{modelAssetBuffer:bytes,delegate:'GPU'},runningMode:'IMAGE',numPoses:scope==='zones'?1:maxPoses,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5};
  let model;try{model=await mod.PoseLandmarker.createFromOptions(vision,options);}catch{options.baseOptions.delegate='CPU';model=await mod.PoseLandmarker.createFromOptions(vision,options);}
  backend={detect:input=>model.detect(input).landmarks??[],close:()=>model.close()};
 }
 return createCropPoseAdapter(backend);
}
export function createCropPoseAdapter(backend){
 const crop=document.createElement('canvas'),ctx=crop.getContext('2d');
 return {async infer(input,t,zones,scope){
  if(scope==='full')return {landmarks:await backend.detect(input),zoneIds:[]};
  const landmarks=[],zoneIds=[];
  for(const zone of zones){
   const rect=cropRectangle(zone,input.width,input.height);if(rect.w<2||rect.h<2)continue;
   crop.width=rect.w;crop.height=rect.h;ctx.drawImage(input,rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);
   const selected=selectCropPose(await backend.detect(crop));
   if(selected){landmarks.push(restoreLandmarks(selected,rect,input.width,input.height));zoneIds.push(zone.id);}
  }
  return {landmarks,zoneIds};
 },close:()=>backend.close()};
}
