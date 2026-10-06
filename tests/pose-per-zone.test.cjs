const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const load=name=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'..',name),'utf8').replace(/^import .*;\n/,'')).toString('base64'));
test('COCO points map to existing cadence joints without inventing foot landmarks',async()=>{
 const {cocoLandmarks}=await load('pose-models.js');
 const points=Array.from({length:17},(_,i)=>({x:i*10,y:i*20,score:.8}));
 const lm=cocoLandmarks(points,200,400);
 assert.equal(lm.length,33);assert.equal(lm[23].x,.55);assert.equal(lm[25].x,.65);assert.equal(lm[28].y,.8);assert.equal(lm[31].visibility,0);
});
test('per-zone inference uses separate crops and restores coordinates to the source image',async()=>{
 const {createCropPoseAdapter}=await load('pose-models.js');
 const draws=[],sizes=[];
 global.document={createElement:()=>({getContext:()=>({drawImage:(...args)=>draws.push(args)})})};
 try{
  const lm=Array.from({length:33},()=>({x:.5,y:.5,z:.1,visibility:.9}));
  const model=createCropPoseAdapter({detect:async input=>{sizes.push([input.width,input.height]);return [lm];},close(){}});
  const input={width:1000,height:600},zones=[{id:3,x:.1,y:.2,w:.2,h:.5},{id:7,x:.6,y:0,w:.3,h:.8}];
  const result=await model.infer(input,10,zones,'zones');
  assert.deepEqual(sizes,[[201,300],[300,480]]); // Floating point bounds are conservatively rounded.
  assert.deepEqual(result.zoneIds,[3,7]);assert.ok(Math.abs(result.landmarks[0][25].x-.2005)<1e-8);
  assert.equal(result.landmarks[0][25].y,.45);assert.equal(result.landmarks[1][25].x,.75);
  assert.equal(draws.length,2);
  sizes.length=0;assert.deepEqual((await model.infer(input,20,[],'zones')).landmarks,[]);assert.equal(sizes.length,0);
  assert.equal((await model.infer(input,30,[],'full')).landmarks.length,1);assert.deepEqual(sizes,[[1000,600]]);
 }finally{delete global.document;}
});
test('YOLO normalized coordinates retain confidence scores',async()=>{
 const {scaleNormalizedPose,decodeYolo}=await load('zone-detectors.js');
 const data=new Float32Array(57);data.set([.1,.2,.9,.95,.8,0]);for(let i=0;i<17;i++)data.set([.5,.6,.75],6+i*3);
 const scaled=scaleNormalizedPose(data,[1,1,57]);
 assert.equal(scaled[6],320);assert.equal(scaled[8],.75);assert.ok(Math.abs(scaled[4]-.8)<1e-6);
 const output=decodeYolo(scaled,[1,1,57],640,640,640,.25,['person'],{pose:true,classIds:[0]});
 assert.equal(output.detections[0].keypoints[0].score,.75);
});

test('YOLO11n-pose is selectable and its raw 56-channel output maps to cadence joints',async()=>{
 const {MODELS,decodeYolo}=await load('zone-detectors.js'),{POSE_MODELS,cocoLandmarks}=await load('pose-models.js');
 assert.equal(MODELS.yolo11pose.pose,true);assert.notEqual(MODELS.yolo11pose.normalizedPose,true);
 assert.equal(POSE_MODELS.yolo11pose.yolo,true);assert.match(MODELS.yolo11pose.url,/0d17b24163fbc33dec51d811d7be8db15b8df274\/yolo11n-pose\.onnx$/);
 const html=fs.readFileSync(path.join(__dirname,'../measure.html'),'utf8');assert.match(html,/<option value="yolo11pose">YOLO11n-pose<\/option>/);
 const data=new Float32Array(56);data.set([320,320,160,400,.9]);for(let i=0;i<17;i++)data.set([300+i,200+i,.8],5+i*3);
 const output=decodeYolo(data,[1,56,1],640,640,640,.25,['person'],{pose:true,classIds:[0]});
 assert.equal(output.detections.length,1);assert.equal(output.detections[0].keypoints.length,17);
 const lm=cocoLandmarks(output.detections[0].keypoints,640,640);assert.equal(lm[25].x,313/640);assert.ok(Math.abs(lm[25].visibility-.8)<1e-6);
});
