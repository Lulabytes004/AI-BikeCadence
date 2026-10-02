// One detector per person; timestamps are source video milliseconds, not wall time.
(function(root) {
  'use strict';
  const median = a => { const s=a.slice().sort((a,b)=>a-b); return s[Math.floor(s.length/2)]; };
  const span = a => a.length ? Math.max(...a)-Math.min(...a) : 0;
  const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  function correlation(a,b) {
    const ma=a.reduce((s,v)=>s+v,0)/a.length, mb=b.reduce((s,v)=>s+v,0)/b.length;
    let dot=0,va=0,vb=0;
    for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;dot+=x*y;va+=x*x;vb+=y*y;}
    return va*vb>1e-12 ? dot/Math.sqrt(va*vb) : 0;
  }
  function regularize(h,step=50) {
    const samples=[]; let j=0;
    for(let t=h[0].t;t<=h.at(-1).t;t+=step){
      while(j<h.length-2 && h[j+1].t<t)j++;
      const a=h[j],b=h[j+1];if(!b)break;
      samples.push(a.v+(b.v-a.v)*(t-a.t)/(b.t-a.t));
    }
    return samples;
  }
  function analyzeWindow(h,type) {
    const minAmp=type==='angle'?12:.12;
    if(h.length<30 || h.at(-1).t-h[0].t<1700)return null;
    const recent=h.filter(s=>h.at(-1).t-s.t<=900);
    if(recent.length<8 || span(recent.map(s=>s.v))<minAmp*.35)return null;
    const q=h.slice(-20).reduce((s,x)=>s+x.q,0)/Math.min(h.length,20);
    const amp=span(h.map(s=>s.v));
    if(q<.5 || amp<minAmp)return null;
    const raw=regularize(h);
    const clean=raw.map((v,i)=>median(raw.slice(Math.max(0,i-1),Math.min(raw.length,i+2))));
    const xs=clean.map((v,i)=>{
      const window=clean.slice(Math.max(0,i-24),Math.min(clean.length,i+25));
      return v-window.reduce((sum,x)=>sum+x,0)/window.length;
    }), candidates=[];
    // 25–180 rpm. A valid estimate needs at least 2.5 periods of evidence.
    const minLag=Math.ceil(60000/180/50), maxLag=Math.min(Math.floor(60000/25/50),Math.floor((xs.length-1)/2.5));
    if(maxLag<minLag)return null;
    const cs={};
    for(let lag=minLag-1;lag<=maxLag+1;lag++)cs[lag]=correlation(xs.slice(lag),xs.slice(0,-lag));
    for(let lag=minLag;lag<=maxLag;lag++){
      const c=cs[lag];
      if(c<.55 || c<cs[lag-1] || c<cs[lag+1])continue;
      const half=Math.round(lag/2), opposite=correlation(xs.slice(half),xs.slice(0,-half));
      if(opposite>0)continue; // monotone drift and flat trajectories are not cycles.
      candidates.push({lag,c});
    }
    if(!candidates.length)return null;
    // Prefer the fundamental, avoiding the 2x/3x-period peaks of autocorrelation.
    const pick=candidates[0];
    const denominator=cs[pick.lag-1]-2*pick.c+cs[pick.lag+1];
    const sub=denominator ? clamp(.5*(cs[pick.lag-1]-cs[pick.lag+1])/denominator,-.5,.5) : 0;
    const period=(pick.lag+sub)*50;
    return {rpm:60000/period,period,quality:q*pick.c*clamp(amp/minAmp,0,1),amp};
  }
  function analyze(h,type){
    const end=h.at(-1)?.t;if(end===undefined)return null;
    let best=null;
    for(const duration of [3000,4500,6500]){
      const samples=h.filter(x=>end-x.t<=duration);
      const estimate=analyzeWindow(samples,type);
      if(estimate && (!best || estimate.quality>best.quality))best=estimate;
    }
    return best;
  }
  class CadenceDetector {
    constructor(){this.reset();}
    reset(){this.signals=new Map();this.lastTime=-Infinity;this.best=null;this.cycles=0;this.lastAccepted=-Infinity;this.lastValid=-Infinity;this.rpm=null;this.lastAnalysis=-Infinity;this.lastObservation=-Infinity;this.acceptedRpm=null;this.pendingRpm=null;this.pendingSince=0;this.pendingSeen=-Infinity;this.result={rpm:null,cycles:0,quality:0,method:null,state:'waiting'};}
    noMotion(t){
      if(t<=this.lastTime)return this.result;
      this.lastTime=t;
      this.signals.clear();this.best=null;this.rpm=null;this.lastValid=-Infinity;this.lastAccepted=-Infinity;this.acceptedRpm=null;this.pendingRpm=null;
      this.result={rpm:0,cycles:this.cycles,quality:0,method:null,state:'still'};return this.result;
    }
    missing(t){
      if(t<=this.lastTime)return this.result;
      this.lastTime=t;if(t-this.lastObservation>300){this.signals.clear();this.best=null;this.lastAccepted=-Infinity;this.acceptedRpm=null;this.pendingRpm=null;}this.rpm=null;
      this.result={rpm:null,cycles:this.cycles,quality:0,method:null,state:'missing'};return this.result;
    }
    update(t,values){
      if(!Number.isFinite(t)||t<=this.lastTime)return this.result; // never count a repeated decoded frame.
      if(this.lastObservation!==-Infinity && t-this.lastObservation>300){this.signals.clear();this.best=null;this.rpm=null;this.lastAccepted=-Infinity;this.acceptedRpm=null;this.pendingRpm=null;}
      this.lastTime=t;this.lastObservation=t;
      const valid=new Set();
      for(const value of values){
        const {name,v,q,type='position'}=value;
        if(!Number.isFinite(v)||q<.5)continue;
        valid.add(name);
        let s=this.signals.get(name);
        if(!s){s={h:[],type,estimate:null,armed:false,peak:null,lastCycle:null};this.signals.set(name,s);}
        s.h.push({t,v,q});while(s.h.length && t-s.h[0].t>6500)s.h.shift();
      }
      for(const [name,s] of this.signals)if(t-s.h.at(-1).t>300)this.signals.delete(name);
      if(t-this.lastAnalysis>=180){
        this.lastAnalysis=t;
        for(const s of this.signals.values())s.estimate=analyze(s.h,s.type);
      }
      let chosen=null,score=0;
      const candidates=[...this.signals].filter(([name,s])=>valid.has(name)&&s.estimate);
      for(const [name,s] of candidates){
        const matching=candidates.filter(([,v])=>Math.abs(v.estimate.rpm-s.estimate.rpm)<s.estimate.rpm*.10);
        if(matching.length<2 && s.estimate.quality<.45)continue;
        const sc=matching.reduce((sum,[,v])=>sum+v.estimate.quality,0);
        if(sc>score){chosen=name;score=sc;}
      }
      if(chosen){
        const target=this.signals.get(chosen).estimate.rpm;
        const matching=candidates.filter(([,v])=>Math.abs(v.estimate.rpm-target)<target*.10);
        matching.sort((a,b)=>b[1].estimate.quality-a[1].estimate.quality);
        chosen=matching[0][0];
        const previous=this.signals.get(this.best);
        if(valid.has(this.best)&&previous?.estimate&&Math.abs(previous.estimate.rpm-target)<target*.10&&previous.estimate.quality>=matching[0][1].estimate.quality*.85)chosen=this.best;
      }
      if(chosen){
        const estimate=this.signals.get(chosen).estimate;
        if(this.acceptedRpm===null || Math.abs(estimate.rpm-this.acceptedRpm)>this.acceptedRpm*.15){
          if(this.pendingRpm===null || Math.abs(estimate.rpm-this.pendingRpm)>this.pendingRpm*.12 || t-this.pendingSeen>350){
            this.pendingRpm=estimate.rpm;this.pendingSince=t;
          }
          this.pendingSeen=t;
          if(t-this.pendingSince<600)chosen=null;
          else{this.acceptedRpm=estimate.rpm;this.pendingRpm=null;}
        }else{this.acceptedRpm=this.acceptedRpm*.9+estimate.rpm*.1;this.pendingRpm=null;}
      }
      this.best=chosen;
      // Every signal keeps its own phase and period. No shared peak-time between knees/feet.
      for(const [name,s] of this.signals){
        s.lastCycle=null;
        if(!valid.has(name))continue;
        if(!s.estimate){s.armed=false;s.peak=null;continue;}
        const tail=s.h.filter(x=>t-x.t<=Math.max(1000,s.estimate.period*1.8));
        const low=Math.min(...tail.map(x=>x.v)),high=Math.max(...tail.map(x=>x.v)), latest=s.h.at(-1);
        if(latest.v<low+(high-low)*.32)s.armed=true;
        if(s.armed && latest.v>low+(high-low)*.68){
          if(s.peak!==null){
            const dt=t-s.peak;
            if(dt>=333 && dt<=2520 && Math.abs(dt-s.estimate.period)<s.estimate.period*.28)s.lastCycle=t;
          }
          s.peak=t;s.armed=false;
        }
      }
      if(chosen){
        const s=this.signals.get(chosen),e=s.estimate;
        this.rpm=e.rpm;this.lastValid=t;
        if(s.lastCycle!==null && t-this.lastAccepted>e.period*.7){this.cycles++;this.lastAccepted=t;}
        this.result={rpm:e.rpm,cycles:this.cycles,quality:e.quality,method:chosen,state:'measuring'};
      }else{
        // Erase stale cadence as soon as recent trajectories show no movement.
        const still=this.signals.size>0 && [...this.signals.values()].every(s=>{
          const r=s.h.filter(x=>t-x.t<=900);
          return r.length>=8 && r.at(-1).t-r[0].t>=700 && span(r.map(x=>x.v))<(s.type==='angle'?4.2:.042);
        });
        this.rpm=null;
        this.result={rpm:still?0:null,cycles:this.cycles,quality:0,method:null,state:still?'still':'waiting'};
      }
      return this.result;
    }
  }
  function poseSignals(lm,aspect=1){
    const p=lm.map(p=>({...p,x:p.x*aspect}));
    const visibility=(...ps)=>Math.min(...ps.map(p=>p?.visibility??0));
    const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const torso=(dist(p[11],p[23])+dist(p[12],p[24]))/2;
    const scale=Math.max(.08,torso*2); // stable torso scale; do not divide by a moving hip–ankle distance.
    const angle=(a,b,c)=>{const ux=a.x-b.x,uy=a.y-b.y,vx=c.x-b.x,vy=c.y-b.y;return Math.acos(clamp((ux*vx+uy*vy)/(Math.hypot(ux,uy)*Math.hypot(vx,vy)||1),-1,1))*180/Math.PI;};
    const signals=[];
    for(const [side,hi,ki,ai] of [['Izq.',23,25,27],['Der.',24,26,28]]){
      const h=p[hi],k=p[ki],a=p[ai];
      const upper=dist(h,k),lower=dist(k,a),bend=angle(h,k,a);
      const reliableAngle=upper>torso*.3&&lower>torso*.3&&upper/lower>.4&&upper/lower<2.5&&bend>=20;
      signals.push({name:'Ángulo '+side,v:bend,q:reliableAngle?visibility(h,k,a):0,type:'angle',points:[hi,ki,ai]},
        {name:'Rodilla '+side,v:(k.y-h.y)/scale,q:visibility(h,k,p[11],p[12]),points:[hi,ki]},
        {name:'Pie '+side,v:(a.y-h.y)/scale,q:visibility(h,a,p[11],p[12]),points:[hi,ai]});
    }
    signals.push({name:'Pies L-R',v:(p[27].y-p[28].y)/scale,q:visibility(p[23],p[24],p[27],p[28],p[11],p[12]),points:[27,28]});
    return signals;
  }
  class PoseTracks {
    constructor(maxTracks=8){this.maxTracks=maxTracks;this.tracks=[];}
    reset(){this.tracks=[];}
    update(poses,t,aspect=1,still=false){
      this.tracks=this.tracks.filter(x=>t-x.seen<1200);
      const existing=this.tracks.slice();
      const center=(lm,a,b)=>({x:(lm[a].x+lm[b].x)/2,y:(lm[a].y+lm[b].y)/2});
      const distance=(a,b)=>Math.hypot((a.x-b.x)*aspect,a.y-b.y);
      const observations=poses.map(lm=>{
        const hip=center(lm,23,24),shoulder=center(lm,11,12);
        return {lm,...hip,anchor:Math.min(lm[11].visibility,lm[12].visibility)>=.5?shoulder:hip,shoulder,torso:distance(hip,shoulder),headQuality:lm[0]?.visibility??0};
      }).sort((a,b)=>b.headQuality-a.headQuality);
      const unique=[];
      for(const p of observations){
        // Multi-pose inference can return the same head/shoulders with different hips.
        // Keep one observation before matching so a duplicate cannot steal an ID.
        const duplicate=unique.some(q=>p.headQuality>=.5&&q.headQuality>=.5&&
          distance(p.lm[0],q.lm[0])<Math.min(p.torso,q.torso)*.25&&
          distance(p.shoulder,q.shoulder)<Math.min(p.torso,q.torso)*.25);
        if(!duplicate)unique.push(p);
      }
      const ordered=unique.slice(0,this.maxTracks).sort((a,b)=>Math.round(a.y/.18)-Math.round(b.y/.18)||a.x-b.x);
      // Minimum-total-distance assignment; eight tracks need at most 256 masks.
      // An unmatched pose costs .28, so a distant person cannot steal a history.
      const memo=new Map();
      function assign(i,mask){
        if(i===ordered.length)return {cost:0,matches:[]};
        const key=i+':'+mask;if(memo.has(key))return memo.get(key);
        const next=assign(i+1,mask);let best={cost:.28+next.cost,matches:[-1,...next.matches]};
        for(let j=0;j<existing.length;j++){
          if(mask&(1<<j))continue;
          const d=distance(ordered[i].anchor,existing[j].anchor);
          if(d>=.28)continue;
          const rest=assign(i+1,mask|(1<<j)),cost=d+rest.cost;
          if(cost<best.cost)best={cost,matches:[j,...rest.matches]};
        }
        memo.set(key,best);return best;
      }
      const matches=assign(0,0).matches,seen=new Set();
      for(let i=0;i<ordered.length;i++){
        const p=ordered[i];let track=matches[i]===-1?null:existing[matches[i]];
        if(!track){
          if(this.tracks.length>=this.maxTracks)continue;
          const used=new Set(this.tracks.map(x=>x.id));let id=1;while(used.has(id))id++;
          track={id,detector:new CadenceDetector()};this.tracks.push(track);
        }
        seen.add(track);Object.assign(track,p,{seen:t});
        track.signals=poseSignals(p.lm,aspect);track.result=still?track.detector.noMotion(t):track.detector.update(t,track.signals);
      }
      for(const track of this.tracks)if(!seen.has(track)){track.result=track.detector.missing(t);track.lm=null;}
      this.tracks.sort((a,b)=>a.id-b.id);
      return this.tracks;
    }
    still(t){for(const track of this.tracks)track.result=track.detector.noMotion(t);return this.tracks;}
  }
  const api={CadenceDetector,PoseTracks,poseSignals};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else Object.assign(root,api);
})(typeof globalThis!=='undefined'?globalThis:this);
