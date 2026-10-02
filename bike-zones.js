// Geometry and temporal confirmation for automatic bicycle/occupied-station zones.
(function(root){
 'use strict';
 const clamp=v=>Math.max(0,Math.min(1,v));
 const area=b=>b.w*b.h;
 function overlap(a,b){const i=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));return {iou:i/(area(a)+area(b)-i||1),contained:i/(Math.min(area(a),area(b))||1)};}
 function bounded(b){const x=clamp(b.x),y=clamp(b.y);return {...b,x,y,w:clamp(b.x+b.w)-x,h:clamp(b.y+b.h)-y};}
 function nms(boxes){const out=[];for(const b of boxes.slice().sort((a,b)=>b.score-a.score)){if(!out.some(a=>{const o=overlap(a,b);return o.iou>.45||o.contained>.8;}))out.push(b);}return out;}
 function poseZoneBoxes(poses){
  return poses.flatMap(lm=>{
   if(![11,12,23,24].every(i=>lm[i]?.visibility>=.7))return [];
   const points=lm.filter(p=>p.visibility>=.5&&Number.isFinite(p.x)&&Number.isFinite(p.y));
   if(points.length<8)return [];
   const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y)),w=Math.max(...points.map(p=>p.x))-x,h=Math.max(...points.map(p=>p.y))-y;
   return w>=.03&&h>=.1?[{x,y,w,h,score:.65,label:'person'}]:[];
  });
 }
 function proposals(boxes){
  const valid=boxes.filter(b=>[b.x,b.y,b.w,b.h,b.score].every(Number.isFinite)&&b.score>=.45&&b.w>.015&&b.h>.03&&b.x<1&&b.y<1&&b.x+b.w>0&&b.y+b.h>0);
  const bikes=nms(valid.filter(b=>b.label==='bicycle')),people=nms(valid.filter(b=>b.label==='person')),used=new Set(),out=[];
  for(const bike of bikes){
   const candidates=people.map((p,i)=>({p,i,d:Math.abs(p.x+p.w/2-bike.x-bike.w/2)})).filter(({p,i,d})=>!used.has(i)&&d<Math.max(bike.w,p.w)*.65&&p.y<bike.y+bike.h*.6&&p.y+p.h>bike.y).sort((a,b)=>a.d-b.d);
   const match=candidates[0];let b=bike;
   if(match){used.add(match.i);const p=match.p,x=Math.min(b.x,p.x),y=Math.min(b.y,p.y);b={...b,x,y,w:Math.max(bike.x+bike.w,p.x+p.w)-x,h:Math.max(bike.y+bike.h,p.y+p.h)-y};}
   // Empty bikes get room above the equipment for a future rider.
   const top=match?b.h*.08:b.h*.8;
   out.push(bounded({...b,x:b.x-b.w*.12,y:b.y-top,w:b.w*1.24,h:b.h+top+b.h*.08,kind:'bicycle',anchor:bike}));
  }
  people.forEach((p,i)=>{if(!used.has(i))out.push(bounded({...p,x:p.x-p.w*.18,y:p.y-p.h*.05,w:p.w*1.36,h:p.h*1.2,kind:'occupied',anchor:p}));});
  return out;
 }
 function rowOrder(zones){
  const rows=[];
  for(const z of zones.slice().sort((a,b)=>(a.y+a.h/2)-(b.y+b.h/2))){
   const cy=z.y+z.h/2;let row=rows.find(r=>Math.abs(r.cy-cy)<Math.min(r.h,z.h)*.45);
   if(!row){row={cy,h:z.h,items:[]};rows.push(row);}row.items.push(z);
  }
  return rows.flatMap(r=>r.items.sort((a,b)=>a.x+a.w/2-b.x-b.w/2));
 }
 class BikeZones{
  constructor(max=8){this.max=max;this.reset();}
  reset(){this.candidates=[];this.zones=[];this.locked=false;this.lastTime=-Infinity;}
  update(boxes,t){
   if(this.locked||!Number.isFinite(t)||t<=this.lastTime)return this.zones;this.lastTime=t;
   this.candidates=this.candidates.filter(c=>t-c.seen<1800);
   const used=new Set();
   for(const p of proposals(boxes)){
    let best=null,bestScore=.25;
    for(const c of this.candidates){if(used.has(c))continue;const score=overlap(c.anchor,p.anchor).iou;if(score>bestScore){best=c;bestScore=score;}}
    if(!best){best={...p,first:t,seen:t,hits:0};this.candidates.push(best);}
    else{for(const k of ['x','y','w','h'])best[k]=best[k]*.65+p[k]*.35;best.anchor=p.anchor;best.kind=p.kind;best.score=p.score;}
    best.seen=t;best.hits++;used.add(best);
   }
   this.zones=rowOrder(this.candidates.filter(c=>c.hits>=3&&t-c.seen<=900&&t-c.first>=800).sort((a,b)=>b.hits-a.hits||b.score-a.score).slice(0,this.max)).map((c,i)=>({id:i+1,x:c.x,y:c.y,w:c.w,h:c.h,kind:c.kind,score:c.score}));
   return this.zones;
  }
  lock(){this.locked=this.zones.length>0;return this.zones;}
 }
 const api={BikeZones,bikeZoneProposals:proposals,poseZoneBoxes};if(typeof module!=='undefined'&&module.exports)module.exports=api;else Object.assign(root,api);
})(typeof globalThis!=='undefined'?globalThis:this);
