/* ================= juice: particles, ripples, polish ================= */
const REDUCED=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
Object.assign(scene,{parts:[],ripples:[],snow:[],vw:null,va:null,wipe:null,swirl:null,rinse:null,pileN:null});
const CONFETTI=['#ff6b8b','#ffd166','#7ee08a','#6fd3ff','#c79bff','#ffffff'];
const jrnd=(a,b)=>a+Math.random()*(b-a);

function addPart(p){
  if(scene.parts.length>220) scene.parts.shift();
  p.t=0;p.life=p.life||0.8;scene.parts.push(p);
}
function burst(kind,x,y,o){
  if(REDUCED) return;
  o=o||{};
  const n=o.n;
  if(kind==='confetti'){
    for(let i=0,m=n||22;i<m;i++) addPart({x:x+jrnd(-3,3),y:y+jrnd(-3,3),vx:jrnd(-48,48),vy:jrnd(-80,-26),g:95,life:jrnd(0.9,1.7),col:CONFETTI[i%CONFETTI.length],sz:Math.random()<0.4?2:1,sw:jrnd(0,6.28)});
  }else if(kind==='sparkle'){
    const cols=o.cols||['#fff6b0','#ffffff','#ffe27a'];
    for(let i=0,m=n||8;i<m;i++){
      const a=Math.random()*6.283,sp=jrnd(8,26);
      addPart({x:x+Math.cos(a)*3,y:y+Math.sin(a)*3,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-6,g:0,drag:2.2,life:jrnd(0.55,1.1),col:cols[i%cols.length],shape:'plus'});
    }
  }else if(kind==='heal'){
    for(let i=0,m=n||10;i<m;i++) addPart({x:x+jrnd(-8,8),y:y+jrnd(-2,6),vx:jrnd(-4,4),vy:jrnd(-26,-12),g:-4,life:jrnd(0.9,1.5),col:i%2?'#7ee08a':'#c9ffd0',shape:'plus'});
  }else if(kind==='plunge'){
    for(let i=0,m=n||2;i<m;i++) addPart({x:x+jrnd(-1,1),y:y,vx:jrnd(-4,4),vy:jrnd(8,22),g:-26,life:jrnd(0.4,0.8),col:'#e6f6ff'});
  }else if(kind==='crumbs'){
    for(let i=0,m=n||3;i<m;i++) addPart({x,y,vx:jrnd(-12,12),vy:jrnd(-10,4),g:14,life:jrnd(0.35,0.7),col:i%2?'#e8a04a':'#c98a3a'});
  }else if(kind==='sand'){
    const th=THEMES.find(q=>q.id===S.theme)||THEMES[0],col=lighten(th.sand,0.15);
    for(let i=0,m=n||4;i<m;i++) addPart({x:x+jrnd(-2,2),y,vx:jrnd(-16,16),vy:jrnd(-18,-5),g:55,life:jrnd(0.3,0.55),col});
  }else if(kind==='foam'){
    for(let i=0,m=n||2;i<m;i++) addPart({x:x+jrnd(-3,3),y:y+jrnd(-5,5),vx:jrnd(-8,8),vy:jrnd(-10,2),g:-3,life:jrnd(0.4,0.85),col:i%3?'#f2fbff':'#bfe9ff'});
  }
}
function ripple(x,y,max,o){
  if(REDUCED) return;
  o=o||{};
  if(scene.ripples.length>14) scene.ripples.shift();
  scene.ripples.push({x,y,t:0,dur:o.dur||0.9,max:max||12,ry:o.ry||0.45,col:o.col||'255,255,255'});
}
function initSnow(){
  scene.snow=[];
  for(let i=0;i<30;i++) scene.snow.push({x:jrnd(0,SW),y:jrnd(0,SAND_Y),vy:jrnd(1.5,4.5),ph:jrnd(0,6.28),a:jrnd(0.18,0.45)});
}

/* ----- one-shot effects the UI triggers ----- */
function scrubFx(){
  scene.wipe={t:0,dur:0.9,x:-8,y:20,from:(scene.va==null?S.algae:scene.va)};
}
function swirlFx(){
  scene.swirl={t:0,dur:1.5};
  for(let i=0;i<3;i++) ripple(jrnd(30,130),2,jrnd(12,20),{ry:0.25,dur:jrnd(0.7,1.1)});
}
function rinseFx(){scene.rinse={t:0,dur:0.95};}
function healFx(id){
  const r=scene.rt.get(id);if(!r) return;
  burst('heal',r.x,r.y,{n:12});ripple(r.x,r.y,10,{col:'126,224,138'});r.sq=0.4;
}
function waterTap(x,y){
  audioResume();
  if(y>SAND_Y+1){burst('sand',x,y,{n:5});}
  else ripple(x,y,15,{ry:0.5});
  sfx.tink();
  reactToGlass(x,y);

}

/* ----- celebration events queued by the sim ----- */
let jfxAt=0;
function jsfx(name){
  const n=performance.now();
  if(n-jfxAt<160) return;
  jfxAt=n;if(sfx[name]) sfx[name]();
}
function fireJuice(e,r){
  const x=r.x,y=r.y;
  switch(e.kind){
    case 'hatch': burst('confetti',x,y,{n:12});burst('sparkle',x,y,{n:5});ripple(x,y,10);break;
    case 'grow': burst('sparkle',x,y,{n:10});ripple(x,y,13);r.sq=0.45;jsfx('levelup');break;
    case 'species': case 'hyb': case 'rare':
      burst('confetti',x,y,{n:34});burst('sparkle',x,y,{n:12});ripple(x,y,20);ripple(x,y,11,{dur:0.65});r.sq=0.45;jsfx('discover');break;
    case 'gene': burst('sparkle',x,y,{n:9});ripple(x,y,12);jsfx('sparkle');break;
    case 'arrive': burst('sparkle',x,y,{n:10});burst('plunge',x,y-6,{n:4});ripple(x,y,16);r.sq=0.45;break;
    case 'heal': burst('heal',x,y,{n:12});ripple(x,y,10,{col:'126,224,138'});r.sq=0.4;break;
    case 'love': for(let i=0;i<3;i++) addFx('heart',x+jrnd(-6,6),y-4-i*3);break;
  }
}
function handleJuice(){
  const now=performance.now();
  for(let i=JUICE_Q.length-1;i>=0;i--){
    const e=JUICE_Q[i];
    if(!e.fxDone){
      const r=e.id!=null?scene.rt.get(e.id):null;
      if(r){fireJuice(e,r);e.fxDone=true;}
      else if(e.id==null||now-e.t0>3000) e.fxDone=true;
    }
    if(e.fxDone&&(e.uiDone||!e.msg||now-e.t0>6000)) JUICE_Q.splice(i,1);
  }
}

/* ----- per-frame update ----- */
function updateJuice(dt){
  if(!S) return;
  /* particles */
  for(let i=scene.parts.length-1;i>=0;i--){
    const p=scene.parts[i];
    p.t+=dt;
    if(p.t>=p.life){scene.parts.splice(i,1);continue;}
    if(p.g) p.vy+=p.g*dt;
    if(p.drag){const k=Math.max(0,1-p.drag*dt);p.vx*=k;p.vy*=k;}
    p.x+=p.vx*dt+(p.sw!=null?Math.sin(p.t*11+p.sw)*0.35:0);p.y+=p.vy*dt;
  }
  for(let i=scene.ripples.length-1;i>=0;i--){const e=scene.ripples[i];e.t+=dt;if(e.t>=e.dur) scene.ripples.splice(i,1);}
  /* marine snow */
  if(!scene.snow.length) initSnow();
  for(const s of scene.snow){
    s.y+=s.vy*dt;s.x+=Math.sin(scene.t*0.8+s.ph)*4*dt;
    if(s.y>SAND_Y-1){s.y=0;s.x=jrnd(0,SW);}
    if(s.x<0) s.x+=SW;else if(s.x>=SW) s.x-=SW;
  }
  /* eased murk + algae so cleaning fades instead of snapping */
  const ease=(cur,tgt,up,dn)=>{
    if(Math.abs(tgt-cur)<0.08) return tgt;
    return cur+(tgt-cur)*(1-Math.exp(-(tgt>cur?up:dn)*dt));
  };
  if(scene.vw==null||REDUCED){scene.vw=S.waste;}else scene.vw=ease(scene.vw,S.waste,2,2.4);
  if(scene.va==null||REDUCED){scene.va=S.algae;}else if(!scene.wipe) scene.va=ease(scene.va,S.algae,3,4);
  /* scrub wipe */
  const w=scene.wipe;
  if(w){
    w.t+=dt;
    const k=Math.min(1,w.t/w.dur),e=k*k*(3-2*k);
    w.x=-8+(SW+16)*e;
    w.y=14+(SAND_Y-32)*(0.5+0.5*Math.sin(w.t*13));
    scene.va=w.from;
    if(!REDUCED){
      if(Math.random()<dt*70) burst('foam',w.x,w.y,{n:1});
      if(Math.random()<dt*34) addPart({x:jrnd(0,Math.max(1,w.x)),y:jrnd(8,SAND_Y-6),vx:0,vy:0,life:0.5,col:'#ffffff',shape:'plus'});
    }
    if(k>=1){scene.wipe=null;scene.va=S.algae;}
  }
  /* water change swirl */
  const sw=scene.swirl;
  if(sw){
    sw.t+=dt;
    if(sw.t<0.55&&!REDUCED&&Math.random()<dt*50) burst('plunge',jrnd(30,130),2,{n:1});
    if(sw.t>=sw.dur) scene.swirl=null;
  }
  /* filter rinse */
  const rn=scene.rinse;
  if(rn){
    rn.t+=dt;
    if(rn.t>=rn.dur) scene.rinse=null;
    else if(!REDUCED){
      if(Math.random()<dt*45) scene.bubbles.push({x:jrnd(142,154),y:jrnd(SAND_Y-26,SAND_Y-3),vy:jrnd(22,40),s:Math.random()<0.35?2:1});
      if(rn.t<0.6&&Math.random()<dt*34) addPart({x:jrnd(142,154),y:jrnd(SAND_Y-26,SAND_Y-4),vx:jrnd(-10,-2),vy:jrnd(4,12),g:0,life:jrnd(0.5,0.9),col:'#8a7a45'});
    }
  }
  /* a new coin lands on the pile */
  const pn=Math.min(14,Math.floor(S.pile));
  if(scene.pileN==null) scene.pileN=pn;
  if(pn>scene.pileN) burst('sparkle',147,SAND_Y+8,{n:3,cols:['#fff1a8','#ffffff']});
  scene.pileN=pn;
  handleJuice();
}

/* ----- drawing helpers ----- */
function drawAmbientBack(c,t,light){
  /* surface glimmer */
  if(!REDUCED){
    for(let x=0;x<SW;x+=3){
      const a=0.05+0.1*Math.max(0,Math.sin(t*1.6+x*0.28))*(0.5+0.5*light);
      c.fillStyle='rgba(255,255,255,'+a.toFixed(3)+')';
      c.fillRect(x,0,3,1);
      if(Math.sin(t*1.1+x*0.5)>0.6) c.fillRect(x+1,1,2,1);
    }
    /* drifting marine snow */
    for(const s of scene.snow){
      c.fillStyle='rgba(235,248,255,'+(s.a*(0.5+0.5*light)).toFixed(3)+')';
      c.fillRect(Math.round(s.x),Math.round(s.y),1,1);
    }
    /* sand glints */
    for(let i=0;i<9;i++){
      const v=Math.sin(t*2.1+i*1.9);
      if(v<0.8) continue;
      const x=hash2(i,31)%SW,y=SAND_Y+1+hash2(i,32)%12;
      c.fillStyle=v>0.95?'rgba(255,255,255,.95)':'rgba(255,255,255,.6)';
      c.fillRect(x,y,1,1);
      if(v>0.95){c.fillRect(x-1,y,3,1);c.fillRect(x,y-1,1,3);}
    }
  }
}
function drawRipples(c){
  for(const e of scene.ripples){
    const k=e.t/e.dur,rr=e.max*(1-Math.pow(1-k,2));
    if(rr<1) continue;
    c.fillStyle='rgba('+e.col+','+((1-k)*0.7).toFixed(2)+')';
    const steps=Math.max(10,Math.round(rr*2.6));
    for(let i=0;i<steps;i++){
      const th=i/steps*6.2832;
      c.fillRect(Math.round(e.x+Math.cos(th)*rr),Math.round(e.y+Math.sin(th)*rr*e.ry),1,1);
    }
  }
}
function drawMurk(c){
  if(scene.vw>25){c.fillStyle='rgba(120,105,50,'+(clamp((scene.vw-25)/75,0,1)*0.45).toFixed(3)+')';c.fillRect(0,0,SW,SH);}
}
function drawAlgae(c){
  const va=scene.va;
  if(va<=8) return;
  const a=va/100,bx=scene.wipe?Math.round(scene.wipe.x):-1;
  c.fillStyle='rgba(60,150,60,'+(a*0.22).toFixed(3)+')';
  const x0=Math.max(0,bx);
  c.fillRect(x0,0,SW-x0,SH);
  const n=Math.round(a*70);
  for(let i=0;i<n;i++){
    const h=hash2(i,5),side=h%3;
    const gx=side===0?(h>>4)%10:(side===1?SW-1-(h>>4)%10:(h>>4)%SW);
    if(gx<bx) continue;
    const gy=(hash2(i,9)%(SAND_Y-4))+2;
    R(c,i%3?'#3d9a3f':'#56b850',gx,gy,1+(h>>9)%2,1+(h>>11)%2);
  }
}
function drawWipe(c){
  const w=scene.wipe;if(!w) return;
  /* soapy band along the sponge's edge */
  c.fillStyle='rgba(235,252,255,.35)';c.fillRect(Math.round(w.x)-2,0,2,SAND_Y);
  /* the sponge */
  const sx=Math.round(w.x)-5,sy=Math.round(w.y)-4;
  R(c,'#b9892a',sx,sy+7,10,1);
  R(c,'#f2d36b',sx,sy,10,7);R(c,'#ffe58f',sx,sy,10,1);
  R(c,'#d6b34a',sx+2,sy+2,2,2);R(c,'#d6b34a',sx+6,sy+4,2,2);R(c,'#d6b34a',sx+7,sy+1,1,1);
}
function drawSwirl(c){
  const w=scene.swirl;if(!w) return;
  const k=w.t/w.dur;
  const front=Math.min(SAND_Y,SAND_Y*Math.min(1,w.t/0.55));
  c.fillStyle='rgba(170,235,255,'+(0.26*(1-k)).toFixed(3)+')';
  c.fillRect(0,0,SW,Math.round(front));
  if(w.t<0.55){c.fillStyle='rgba(235,252,255,.7)';c.fillRect(0,Math.round(front),SW,1);}
  const fade=1-k,grow=0.4+0.6*Math.min(1,w.t/0.5);
  for(let i=0;i<26;i++){
    const u=i/26,ang=w.t*6.5+u*9.4,rr=(6+u*52)*grow;
    const x=80+Math.cos(ang)*rr*1.45,y=54+Math.sin(ang)*rr*0.55;
    c.fillStyle='rgba(255,255,255,'+(fade*(0.35+0.4*u)).toFixed(2)+')';
    const sz=u>0.6?2:1;
    c.fillRect(Math.round(x),Math.round(y),sz,sz);
  }
}
function drawParts(c){
  for(const p of scene.parts){
    const k=p.t/p.life;
    c.globalAlpha=k<0.6?1:Math.max(0,1-(k-0.6)/0.4);
    c.fillStyle=p.col;
    const x=Math.round(p.x),y=Math.round(p.y);
    if(p.shape==='plus'&&k<0.65){c.fillRect(x-1,y,3,1);c.fillRect(x,y-1,1,3);}
    else{const z=p.sz||1;c.fillRect(x,y,z,z);}
  }
  c.globalAlpha=1;
}
