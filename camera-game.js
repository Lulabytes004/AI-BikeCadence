import {createPoseModel,cropRectangle,restoreLandmarks} from './pose-models.js?v=mptracking2';
import {createZoneDetector} from './zone-detectors.js?v=webgpu1';
const $=id=>document.getElementById(id),video=$('cameraVideo'),overlay=$('cameraOverlay'),ctx=overlay.getContext('2d');
const input=document.createElement('canvas'),ic=input.getContext('2d',{willReadFrequently:true});
const crop=document.createElement('canvas'),cc=crop.getContext('2d');
const small=document.createElement('canvas');small.width=96;small.height=54;const sc=small.getContext('2d',{willReadFrequently:true});
let stream=null,model=null,detector=null,generation=0,busy=false,loading=false,reconfiguring=false,raf=null,scanCount=0,lastScan=-Infinity,baseline=null,lastPixels=null,lastMotion=0,fpsStart=0,fpsFrames=0,shownFPS=0;
let poses=[],backend='';const zones=new globalThis.BikeZones(32),tracks=new globalThis.PoseTracks(32);
const links=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[0,2],[0,5],[2,7],[5,8]];
const zoneMode=()=>$('cameraModel').value==='mediapipe_zone';
const good=p=>p&&p.visibility>=.3&&Number.isFinite(p.x)&&Number.isFinite(p.y);
function cameraFeedback(button,text){button.classList.add('pressed');setTimeout(()=>button.classList.remove('pressed'),180);status(text);}
function status(text){$('cameraStatus').textContent=text;}
function resetData(){zones.reset();tracks.reset();scanCount=0;lastScan=-Infinity;baseline=null;poses=[];lastPixels=null;lastMotion=performance.now();fpsStart=performance.now();fpsFrames=0;shownFPS=0;}
function stopCapture(){generation++;if(raf!==null)cancelAnimationFrame(raf);raf=null;stream?.getTracks().forEach(t=>t.stop());stream=null;video.pause();video.srcObject=null;$('cameraStop').disabled=true;$('cameraRescan').disabled=true;$('cameraStart').classList.remove('camera-active');$('cameraStart').textContent='Iniciar cámara';}
async function closeModels(){const old=model,od=detector;model=null;detector=null;await old?.close();await od?.close();}
async function deadline(promise,message){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error(message)),20000))]);}finally{clearTimeout(timer);}}
async function start(){
 if(loading)return;loading=true;$('cameraStart').disabled=true;stopCapture();const token=generation;$('cameraStart').textContent='Iniciando cámara…';
 try{
  while(busy)await new Promise(r=>setTimeout(r,20));await closeModels();resetData();
  if(!navigator.mediaDevices?.getUserMedia)throw Error('La cámara necesita HTTPS o localhost.');
  status('Solicitando permiso de cámara…');const resolution=$('cameraResolution').value;const size=resolution==='640x480'?[640,480]:[1280,720];
  let expired=false;const request=navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:$('cameraFacing').value},...(resolution==='auto'?{}:{width:{ideal:size[0]},height:{ideal:size[1]}})}});
  request.then(s=>{if(expired||token!==generation)s.getTracks().forEach(t=>t.stop());},()=>{});
  try{stream=await deadline(request,'La cámara no respondió. Revisa los permisos.');}catch(e){expired=true;throw e;}
  if(token!==generation)return;video.srcObject=stream;await deadline(video.play(),'No se reciben imágenes de cámara.');
  status('Cargando modelo…');backend='';const key=zoneMode()?'mediapipe_lite':$('cameraModel').value;
  const created=await createPoseModel(key,{scope:'full',maxPoses:zoneMode()?1:32,videoTracking:$('cameraTracking').checked,useWebGPU:$('cameraGPU').checked,onBackend:info=>{backend=info.backend+(info.fallbackReason?' · '+info.fallbackReason:'');},onProgress:info=>status(info.stage==='download'?'Descargando modelo · '+(info.loaded/1048576).toFixed(1)+' MiB':'Preparando modelo…')});
  if(token!==generation){await created.close();return;}model=created;
  if(zoneMode()){
   detector=await createZoneDetector('yolov8n',null,.25,{classIds:[0],maxDet:32,useWebGPU:$('cameraGPU').checked});
   if(token!==generation){await closeModels();return;}
  }
  $('cameraView').style.aspectRatio=`${video.videoWidth}/${video.videoHeight}`;$('cameraStop').disabled=false;$('cameraRescan').disabled=!zoneMode();
  $('cameraStart').textContent='Cámara activa · reiniciar';$('cameraStart').classList.add('camera-active');$('cameraPlayer').replaceChildren();status(zoneMode()?'Identificando zonas (0/6)…':'Cámara lista · selecciona un jugador e inicia el nivel.');loop(token);
 }catch(e){if(token===generation){stopCapture();await closeModels();status('Error: '+e.message);}}finally{loading=false;$('cameraStart').disabled=false;}
}
function playerChoices(items){
 const select=$('cameraPlayer'),old=select.value,ids=items.map(p=>String(p.id));
 if([...select.options].map(o=>o.value).join(',')===ids.join(','))return;
 select.replaceChildren(...items.map(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=(zoneMode()?'Zona ':'Ciclista ')+p.id;return o;}));
 select.value=ids.includes(old)?old:(ids[0]||'');if(select.value!==old)baseline=null;
}
function draw(){overlay.width=video.videoWidth;overlay.height=video.videoHeight;ctx.clearRect(0,0,overlay.width,overlay.height);
 if(zoneMode())for(const z of zones.zones){ctx.strokeStyle=String(z.id)===$('cameraPlayer').value?'#ffb84d':'#777';ctx.lineWidth=2;ctx.strokeRect(z.x*overlay.width,z.y*overlay.height,z.w*overlay.width,z.h*overlay.height);ctx.fillStyle=ctx.strokeStyle;ctx.fillText('Z'+z.id,z.x*overlay.width,z.y*overlay.height+15);}
 if(!$('cameraSkeleton').checked)return;
 poses.forEach(lm=>{ctx.strokeStyle='#50e6ad';ctx.fillStyle='#50e6ad';ctx.lineWidth=3;for(const [a,b] of links){if(!good(lm[a])||!good(lm[b]))continue;ctx.beginPath();ctx.moveTo(lm[a].x*overlay.width,lm[a].y*overlay.height);ctx.lineTo(lm[b].x*overlay.width,lm[b].y*overlay.height);ctx.stroke();}for(const p of lm){if(!good(p))continue;ctx.beginPath();ctx.arc(p.x*overlay.width,p.y*overlay.height,3,0,Math.PI*2);ctx.fill();}});
}
function still(t){sc.drawImage(input,0,0,96,54);const pixels=sc.getImageData(0,0,96,54).data;let diff=Infinity;if(lastPixels){let sum=0;for(let i=0;i<pixels.length;i+=4)sum+=(Math.abs(pixels[i]-lastPixels[i])+Math.abs(pixels[i+1]-lastPixels[i+1])+Math.abs(pixels[i+2]-lastPixels[i+2]))/3;diff=sum/(pixels.length/4);}if(diff>.08)lastMotion=t;lastPixels=new Uint8ClampedArray(pixels);return t-lastMotion>=650;}
async function frame(token){
 const t=performance.now();input.width=video.videoWidth;input.height=video.videoHeight;ic.drawImage(video,0,0);
 if(zoneMode()&&!zones.locked){
  if(t-lastScan>=650){lastScan=t;const out=await detector.detect(input);if(token!==generation)return;
   zones.update(out.detections.map(d=>{const b=d.boundingBox;return {label:'person',score:d.categories[0].score,x:b.originX/input.width,y:b.originY/input.height,w:b.width/input.width,h:b.height/input.height};}),t);scanCount++;if(scanCount>=6){zones.lock();$('cameraRescan').textContent='Volver a detectar zonas';playerChoices(zones.zones);status(zones.zones.length+' zonas · selecciona el jugador e inicia el nivel.');}else status('Identificando zonas ('+scanCount+'/6)…');draw();
  }return;
 }
 let result;const selectedZone=zoneMode()?zones.zones.find(z=>String(z.id)===$('cameraPlayer').value):null;
 if(zoneMode()&&!selectedZone){status('No hay zonas. Pulsa Volver a detectar zonas.');return;}
 const begun=performance.now();
 if(selectedZone){const r=cropRectangle(selectedZone,input.width,input.height);crop.width=r.w;crop.height=r.h;cc.drawImage(input,r.x,r.y,r.w,r.h,0,0,r.w,r.h);result=await model.infer(crop,t,[],'full');result.landmarks=result.landmarks.map(lm=>restoreLandmarks(lm,r,input.width,input.height));}
 else result=await model.infer(input,t,[],'full');
 if(token!==generation)return;const ms=performance.now()-begun;poses=result.landmarks;
 const found=tracks.update(poses,t,input.width/input.height,still(t));if(!zoneMode())playerChoices(found);
 const chosen=selectedZone?found[0]:found.find(p=>String(p.id)===$('cameraPlayer').value);
 if(chosen){const identity=String($('cameraPlayer').value)+':'+chosen.id,cycles=chosen.result.cycles??0;
  if(!baseline||baseline.identity!==identity||cycles<baseline.cycles)baseline={identity,cycles};
  else{const delta=Math.min(20,Math.max(0,cycles-baseline.cycles));baseline.cycles=cycles;for(let i=0;i<delta;i++)window.platformCameraPedal?.();}
 }
 fpsFrames++;const elapsed=performance.now()-fpsStart;if(elapsed>=1000){shownFPS=fpsFrames*1000/elapsed;fpsStart=performance.now();fpsFrames=0;}
 $('cameraMetrics').textContent='Procesamiento: '+ms.toFixed(0)+' ms · FPS de análisis: '+shownFPS.toFixed(1)+' · '+poses.length+' posturas · Cadencia: '+(chosen?.result.rpm==null?'--':chosen.result.rpm.toFixed(0))+' RPM · '+(backend||'MediaPipe');draw();
}
function loop(token){if(token!==generation||!stream)return;raf=requestAnimationFrame(async()=>{raf=null;if(token!==generation)return;busy=true;try{if(!reconfiguring&&video.readyState>=2&&video.videoWidth)await frame(token);}catch(e){status('Error de análisis: '+e.message);stopCapture();}finally{busy=false;}loop(token);});}
$('cameraStart').onclick=()=>{cameraFeedback($('cameraStart'),'Iniciando cámara…');return start();};
$('cameraStop').onclick=async()=>{cameraFeedback($('cameraStop'),'Deteniendo cámara…');stopCapture();while(busy)await new Promise(r=>setTimeout(r,20));await closeModels();status('Cámara detenida.');};
for(const id of ['cameraModel','cameraFacing','cameraResolution','cameraGPU','cameraTracking'])$(id).onchange=()=>{if(stream)return start();};
$('cameraSkeleton').onchange=draw;
$('cameraPlayer').onchange=async()=>{reconfiguring=true;const token=generation;try{while(busy)await new Promise(r=>setTimeout(r,20));if(token!==generation)return;tracks.reset();baseline=null;await model?.resetTracking?.();}catch(e){status('Error de seguimiento: '+e.message);}finally{reconfiguring=false;}};
$('cameraRescan').onclick=async()=>{if(!zoneMode())return;const button=$('cameraRescan');cameraFeedback(button,'Volviendo a detectar zonas…');button.textContent='Detectando zonas…';try{await start();}finally{if(!stream)button.textContent='Volver a detectar zonas';}};
window.addEventListener('pagehide',stopCapture);
