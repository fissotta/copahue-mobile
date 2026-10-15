/* Copahue Field Campaign — MOBILE layer (independent project, comic look only)
   - Overhead map view as the default camera (pinch zoom, auto-fit to the next target, tap a site to select it)
   - Contextual camera: map -> first person at sampling sites and in 3D mini-games -> back to map
   - Touch HUD, rotate hint, fullscreen, PWA (manifest + service worker), perf overlay (?perf=1)
   The game core (game.js/world.js) is only touched through the small, marked `MOB` hooks and the `window.__CFC` bridge. */
(function(){
'use strict';
const MOB=window.MOB={on:true,zoomMul:1,auto:false,H:12,zone:null,baseH:12};
const D=document,root=D.documentElement;
root.classList.add('mobile');
const addBody=()=>{D.body.classList.add('touch','mobile');};
if(D.body)addBody();else addEventListener('DOMContentLoaded',addBody);
const G=()=>window.__CFC;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const LANG=()=>((D.documentElement.lang||navigator.language||'es')+'').slice(0,2)==='en'?'en':'es';
const tx=(en,es)=>LANG()==='en'?en:es;

/* ---------- helpers ---------- */
function pos(){const g=G();return g.pl.inTruck?[g.truck.x,g.truck.z]:[g.pl.x,g.pl.z];}
function targetPos(){const g=G(),t=g.S.target;if(t==='base')return [g.base.x,g.base.z,'BASE MEL'];if(t&&t.ax!=null)return [t.ax,t.az,t.c.replace('_','–')];return null;}
function nearestOpen(){const g=G(),[x,z]=pos();let b=null,bd=1e9;g.M.forEach(m=>{if(g.st(m.c).done)return;const d=Math.hypot(x-m.ax,z-m.az);if(d<bd){bd=d;b=m;}});return [b,bd];}
function ensureTarget(){const g=G();if(!g.S.target){const [m]=nearestOpen();g.S.target=m||'base';}}
const view=()=>({W:innerWidth,H:innerHeight});

/* ---------- overhead map camera (called from updateCamera) ---------- */
let ground=0;
MOB.mapWant=function(tgt,dt){
  const g=G(),W=window.WORLD,cam=W.camera,[px,pz]=pos();let cx=px,cz=pz,H=MOB.baseH;
  if(!g.pl.inTruck){g.cam.yaw=Math.PI/2;g.cam.dragYaw=0;}   // on foot in the map: forward = screen up (north), like a classic top-down game
  const tp=targetPos(),th=Math.tan(cam.fov*Math.PI/360),asp=cam.aspect||2;
  if(tp&&MOB.auto){const dx=tp[0]-px,dz=tp[1]-pz;cx=px+dx*.5;cz=pz+dz*.5;   // optional "show target" mode (button)
    H=Math.max((Math.abs(dx)/2+.45)/(th*asp),(Math.abs(dz)/2+.45)/th);}
  H=clamp(H*MOB.zoomMul,4,72);
  MOB.H+=(H-MOB.H)*(1-Math.exp(-dt*6));
  const gy=W.heightAt(cx,cz);ground+=(gy-ground)*(1-Math.exp(-dt*4));
  tgt.set(cx,ground,cz);
  // stay above the surrounding peaks (terrain relief is exaggerated)
  let hm=gy;const R=Math.max(1.2,MOB.H*.8);for(let i=0;i<8;i++){const an=i*Math.PI/4,h=W.heightAt(cx+Math.cos(an)*R,cz+Math.sin(an)*R);if(h>hm)hm=h;}
  const alt=Math.max(ground+MOB.H,hm+MOB.H*.35+.5);MOB.alt=(MOB.alt==null?alt:MOB.alt+(alt-MOB.alt)*(1-Math.exp(-dt*4)));
  return new window.THREE.Vector3(cx,MOB.alt,cz+.0005);
};
/* screen-relative controls in the map (Nintendo / phone-game style): the stick points where you want to go on screen */
const angD=(a,b)=>{let d=(b-a+Math.PI)%(2*Math.PI);if(d<0)d+=2*Math.PI;return d-Math.PI;};
MOB.axes=function(joy,K){
  const g=G();if(!g||!g.cam.map||g.mode!=='play')return null;
  let sx=(K('KeyD')||K('ArrowRight')?1:0)-(K('KeyA')||K('ArrowLeft')?1:0)+joy.x,sy=(K('KeyW')||K('ArrowUp')?1:0)-(K('KeyS')||K('ArrowDown')?1:0)+joy.y;   // sy>0 = screen up
  const m=Math.min(1,Math.hypot(sx,sy));if(m<.08)return [0,0];
  if(!g.pl.inTruck)return [clamp(sx,-1,1),clamp(sy,-1,1)];   // on foot: yaw is locked to north, so stick = screen direction already
  // truck: steer toward the stick direction (screen up = north = -z); stick behind you = U-turn arc (always drives forward, like arcade games)
  const wy=Math.atan2(sy,sx);                            // forward=(cos y, -sin y)=(sx,-sy)/|.| -> y=atan2(sy,sx)
  const d=angD(g.truck.yaw,wy);
  return [clamp(-d*2.2,-1,1),m*Math.max(.45,Math.cos(d))];
};
MOB.onStart=function(){
  const g=G();if(!g)return;MOB.zoomMul=1;MOB.zone=null;
  setTimeout(()=>{const g2=G();ensureTarget();g2.cam.map=true;g2.cam.fp=true;},60);
  try{sessionStorage.setItem('mobStarted','1');}catch(e){}
};

/* ---------- pinch zoom + tap a site / double-tap reset (map only) ---------- */
function bindTouch(){
  const cv=window.WORLD&&WORLD.renderer&&WORLD.renderer.domElement;if(!cv||bindTouch.done)return;bindTouch.done=1;
  const P=new Map();let d0=0,z0=1,tap=null,lastTap=0,pinched=false;
  const cam=()=>G().cam;
  cv.addEventListener('pointerdown',e=>{if(!G()||G().mode!=='play')return;P.set(e.pointerId,[e.clientX,e.clientY]);
    if(P.size===2){const [a,b]=[...P.values()];d0=Math.hypot(a[0]-b[0],a[1]-b[1]);z0=cam().map?MOB.zoomMul:cam().zoom;tap=null;pinched=true;}
    else if(P.size===1){tap={x:e.clientX,y:e.clientY,t:performance.now()};pinched=false;}},true);
  cv.addEventListener('pointermove',e=>{if(!P.has(e.pointerId))return;P.set(e.pointerId,[e.clientX,e.clientY]);
    if(P.size>=2&&d0>0){e.stopImmediatePropagation();const [a,b]=[...P.values()];const r=d0/Math.hypot(a[0]-b[0],a[1]-b[1]),c=cam();
      if(c.map)MOB.zoomMul=clamp(z0*r,.25,3);
      else if(c.fp){if(r<.72&&!MOB.zone&&!G().modal){c.fp=false;c.zoom=1;d0=Math.hypot(a[0]-b[0],a[1]-b[1]);z0=1;}}   // spread fingers in first person -> step back to third person
      else{const z=z0*r;if(z<.5&&r>1.25){c.fp=true;}else c.zoom=clamp(z,.5,4);}}              // pinch in third person = dolly; pinch hard in -> back to first person
    if(tap&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>14)tap=null;},true);
  const up=e=>{P.delete(e.pointerId);if(P.size<2)d0=0;
    if(e.type==='pointerup'&&tap&&G()&&G().cam.map&&!pinched&&performance.now()-tap.t<450){
      const now=performance.now();if(now-lastTap<320){MOB.zoomMul=1;MOB.auto=false;lastTap=0;}else lastTap=now;
      pickSite(tap.x,tap.y);}
    tap=null;};
  cv.addEventListener('pointerup',up,true);cv.addEventListener('pointercancel',up,true);
  cv.addEventListener('wheel',e=>{if(G()&&G().cam.map)MOB.zoomMul=clamp(MOB.zoomMul*(e.deltaY>0?1.1:.9),.25,3);},{passive:true});
}
function pickSite(sx,sy){const g=G(),W=window.WORLD,cam=W.camera,V=new window.THREE.Vector3();let best=null,bd=48;  // 48 px radius = comfortable finger target
  const test=(x,z,obj)=>{V.set(x,W.heightAt(x,z),z).project(cam);if(V.z>1)return;const px=(V.x*.5+.5)*innerWidth,py=(-V.y*.5+.5)*innerHeight,d=Math.hypot(px-sx,py-sy);if(d<bd){bd=d;best=obj;}};
  g.M.forEach(m=>{if(!g.st(m.c).done)test(m.ax,m.az,m);});test(g.base.x,g.base.z,'base');
  if(best){g.S.target=best;try{navigator.vibrate&&navigator.vibrate(15);}catch(e){}
    const it=[...D.querySelectorAll('#g-misl .it')];  // refresh mission list highlight
    g.nextTarget&&0;}
}

/* ---------- contextual camera: map <-> first person ---------- */
function goFP(){const g=G(),c=g.cam;if(g.pl.yaw!=null&&!g.pl.inTruck){c.yaw=g.pl.yaw;c.dragYaw=0;}c.map=false;c.fp=true;D.body.classList.remove('mb-map');}
function goMap(){const c=G().cam;c.map=true;c.fp=true;D.body.classList.add('mb-map');}
let fpModalPrev=false,zone=null;
const ZIN=.7,ZOUT=1.15;   // km (1 world unit = 1 km)
function ctxLoop(){
  requestAnimationFrame(ctxLoop);const g=G();if(!g||!window.WORLD)return;
  bindTouch();
  const play=g.mode==='play'&&!g.EV.cine&&!D.body.classList.contains('xa-photo');
  D.body.classList.toggle('mb-map',play&&g.cam.map);
  if(!play){return;}
  const modal=g.modal,fpModal=!!(modal&&modal.fp3d);D.body.classList.toggle('mb-fpm',fpModal);
  const [near,nd]=nearestOpen();
  const inZone=!g.pl.inTruck&&near&&nd<(zone?ZOUT:ZIN);
  if(zone&&g.st(zone.c).done)zone=null,MOB.zone=null,(!fpModal&&!g.pl.inTruck&&goMap());
  else if(inZone&&!zone){zone=near;MOB.zone=near;goFP();}
  else if(!inZone&&zone){zone=null;MOB.zone=null;if(!fpModal)goMap();}
  if(fpModal&&!fpModalPrev&&g.cam.map)goFP();
  if(!fpModal&&fpModalPrev&&!zone&&!g.cam.map&&!g.pl.inTruck)goMap();
  fpModalPrev=fpModal;
  // sampling / probe / filtration are 3D first person only: never third person inside a site zone or with those minigames open
  if((zone||fpModal)&&!g.cam.map&&!g.pl.inTruck&&!g.cam.fp)goFP();
  if(fpModal){const ov=D.getElementById('g-ov');if(ov&&!ov.classList.contains('fp3d')&&window.FPG&&FPG.can3d())ov.classList.add('fp3d');}
  {const te=D.getElementById('g-tE'),tq=D.getElementById('g-tQ'),tm=D.getElementById('g-tM');   // buttons say what they do, no keyboard letters
   const set=(el,t)=>{if(el&&el.textContent!==t)el.textContent=t;};set(te,tx('ACTION','ACCIÓN'));set(tq,tx('PROBE','SONDA'));set(tm,tx('MAP','MAPA'));}
  hud(g);actors(g);carBtn(g);
}

/* ---------- map: enlarge the truck / person (instead of a marker that hides them); restore when leaving the map ---------- */
const AC=[];
function scaleOne(key,obj,on,k){let r=AC.find(x=>x.key===key);if(r&&r.obj!==obj){r=null;AC.splice(AC.findIndex(x=>x.key===key),1);}
  if(!obj)return;if(!r){r={key,obj,base:obj.scale.clone(),on:false};AC.push(r);}
  if(on){r.obj.scale.copy(r.base).multiplyScalar(k);r.on=true;}else if(r.on){r.obj.scale.copy(r.base);r.on=false;}}
function actors(g){const on=g.cam.map,k=clamp(MOB.H*.24,1.4,16);scaleOne('truck',g.truck.g,on,k);scaleOne('pl',g.pl.g,on&&!g.pl.inTruck,k);
  (g.CREW||[]).forEach((c,i)=>scaleOne('crew'+i,c.g,on,k));}   // camera + sound operators grow with you (otherwise they look like ants next to a big truck)

/* ---------- get in / out of the truck button (always available, not only the contextual E) ---------- */
let car=null;const CAR_NEAR=3;   // km: show GET IN when the truck is within this distance

function carBtn(g){
  if(!car){const tb=D.querySelector('#g-tbtn');if(!tb)return;car=D.createElement('button');car.className='g-btn';car.id='mb-car';tb.insertBefore(car,tb.firstChild);
    car.addEventListener('pointerdown',e=>{e.preventDefault();const g=G();
      if(g.pl.inTruck){if(Math.abs(g.truck.speed)>.45){g.toast(tx('Stop the truck first','Frena primero la camioneta'),true,1600);}else g.exitTruck();}
      else g.enterTruck();});}   // no need to stand next to it: the button only shows when the truck is nearby
  const t=g.pl.inTruck?'🚶 '+tx('GET OUT','BAJAR'):'🛻 '+tx('GET IN','SUBIR');if(car.textContent!==t)car.textContent=t;
  const dT=Math.hypot(g.pl.x-g.truck.x,g.pl.z-g.truck.z);car.style.display=(g.mode==='play'&&!g.modal&&(g.pl.inTruck||dT<CAR_NEAR))?'':'none';
}

/* ---------- map HUD: target chip with arrow + distance ---------- */
let chip=null;
function hud(g){
  if(!chip){chip=D.createElement('div');chip.id='mb-tgt';chip.innerHTML='<b id="mb-ar">▲</b><span id="mb-tx"></span><button id="mb-next" aria-label="next">⏭</button><button id="mb-fit" aria-label="fit">◎</button>';D.body.appendChild(chip);
    chip.querySelector('#mb-next').onclick=()=>{g.nextTarget();MOB.zoomMul=1;};chip.querySelector('#mb-fit').onclick=()=>{MOB.auto=!MOB.auto;MOB.zoomMul=1;chip.querySelector('#mb-fit').style.background=MOB.auto?'#8ac926':'';};}
  const show=g.cam.map;chip.style.display=show?'flex':'none';if(!show)return;
  const tp=targetPos(),[x,z]=pos();if(!tp){chip.querySelector('#mb-tx').textContent=tx('Pick a site','Elige un sitio');return;}
  const dx=tp[0]-x,dz=tp[1]-z,km=Math.hypot(dx,dz);
  chip.querySelector('#mb-ar').style.transform=`rotate(${Math.atan2(dx,-dz)}rad)`;
  const t=`${tp[2]} · ${km<1?Math.round(km*1000)+' m':km.toFixed(1)+' km'}`;const e=chip.querySelector('#mb-tx');if(e.textContent!==t)e.textContent=t;
}

/* ---------- picker: big character preview, START goes straight to the map ---------- */
const mo=new MutationObserver(()=>{
  const mb=D.querySelector('#g-mb');if(!mb||!mb.querySelector('.scard.ch')||mb.querySelector('#mb-prev'))return;
  if(!mb.querySelector('#pk-go'))return;
  const prev=D.createElement('div');prev.id='mb-prev';mb.insertBefore(prev,mb.firstChild);
  const refresh=()=>{const sel=[...mb.querySelectorAll('.scard.ch')].find(c=>c.style.background)||mb.querySelector('.scard.ch');if(!sel)return;
    const im=sel.querySelectorAll('img');const big=im[1]||im[0];const nm=sel.querySelector('.chn');
    prev.innerHTML=`<img src="${big.src}" alt=""><div class="n">${(nm&&nm.value)||''}</div>`;};
  refresh();mb.querySelectorAll('.scard.ch').forEach(c=>c.addEventListener('click',()=>setTimeout(refresh,0)));
  const go=mb.querySelector('#pk-go');if(go)go.textContent=tx('▶ START','▶ COMENZAR');
});
addEventListener('DOMContentLoaded',()=>{mo.observe(D.body,{childList:true,subtree:true});});

/* ---------- fullscreen / rotate hint ---------- */
addEventListener('DOMContentLoaded',()=>{
  const r=D.createElement('div');r.id='mb-rotate';r.innerHTML='<div>📱↻<br>'+tx('Rotate your phone to landscape','Gira el teléfono a horizontal')+'</div>';D.body.appendChild(r);
  if(D.fullscreenEnabled||D.webkitFullscreenEnabled){const b=D.createElement('button');b.id='mb-fs';b.className='g-btn';b.textContent='⛶';b.setAttribute('aria-label','fullscreen');
    b.onclick=()=>{const e=D.documentElement;try{(D.fullscreenElement?D.exitFullscreen():(e.requestFullscreen||e.webkitRequestFullscreen).call(e));
      screen.orientation&&screen.orientation.lock&&screen.orientation.lock('landscape').catch(()=>{});}catch(_){}};D.body.appendChild(b);}
  requestAnimationFrame(ctxLoop);
  perfOverlay();
});

/* ---------- perf overlay (?perf=1): FPS, draw calls, triangles, geometries/textures ---------- */
function perfOverlay(){
  if(!/[?&]perf=1/.test(location.search))return;const o=D.createElement('pre');o.id='mb-perf';D.body.appendChild(o);
  let n=0,t0=performance.now(),calls=0,tris=0;
  (function f(t){const R=window.WORLD&&WORLD.renderer;if(R){const i=R.info;i.autoReset=false;calls=i.render.calls;tris=i.render.triangles;i.reset();}
    n++;if(t-t0>1000){let s='fps '+(n*1000/(t-t0)).toFixed(0);if(R){const i=R.info;s+=`\ncalls ${calls} tris ${(tris/1000).toFixed(0)}k\ngeo ${i.memory.geometries} tex ${i.memory.textures}\npx ${R.domElement.width}x${R.domElement.height}`;if(performance.memory)s+=`\nheap ${(performance.memory.usedJSHeapSize/1048576).toFixed(0)}MB`;}o.textContent=s;n=0;t0=t;}requestAnimationFrame(f);})(performance.now());
}

/* ---------- iOS Safari cannot go fullscreen from a page: suggest installing it (standalone = no Safari bars) ---------- */
addEventListener('DOMContentLoaded',()=>{
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const standalone=navigator.standalone||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches;
  let seen=false;try{seen=localStorage.getItem('mbHint')==='1';}catch(e){}
  if(!ios||standalone||seen)return;
  const h=D.createElement('div');h.id='mb-hint';h.innerHTML=tx('For fullscreen: tap <b>Share</b> ⎋ → <b>Add to Home Screen</b>, then open it from there.','Para pantalla completa: toca <b>Compartir</b> ⎋ → <b>Añadir a pantalla de inicio</b> y ábrelo desde ahí.')+' <button aria-label="close">✕</button>';
  h.querySelector('button').onclick=()=>{h.remove();try{localStorage.setItem('mbHint','1');}catch(e){}};D.body.appendChild(h);setTimeout(()=>h.remove(),25000);
});

/* ---------- PWA ---------- */
if('serviceWorker' in navigator&&location.protocol!=='file:'){addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}
})();
