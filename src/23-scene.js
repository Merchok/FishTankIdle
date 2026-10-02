/* ================= sprite helpers ================= */
const SPRITES=new Map();
const rgba=(hex,a)=>{const c=hexRgb(hex);return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';};
function prof(shape,u){
  switch(shape){
    case 'slim': return Math.pow(Math.sin(Math.PI*Math.min(1,u*0.92+0.04)),0.7);
    case 'oval': case 'bottom': {const c=.42,d=u<c?(c-u)/c:(u-c)/(1-c);return Math.sqrt(Math.max(0,1-d*d));}
    case 'round': case 'disc': return Math.sqrt(Math.max(0,1-Math.pow(2*u-1,2)));
    case 'tall': return Math.max(0,1-Math.pow(Math.abs(u-0.5)*2,1.5));
    case 'long': return Math.pow(Math.sin(Math.PI*(u*0.94+0.03)),0.3);
  }
  return 1;
}
function getSprite(f,stage,sick){
  const key=f.id+'|'+stage+'|'+(sick?1:0);
  let s=SPRITES.get(key);
  if(!s){
    const k=kindOf(f);
    s=k==='shrimp'?buildShrimp(f,stage,sick):(k==='jelly'?buildJelly(f,stage,sick):buildFishSprite(f,stage,sick));
    SPRITES.set(key,s);
  }
  return s;
}
function gridToCanvas(g,W,Hc){
  const cv=document.createElement('canvas');cv.width=W;cv.height=Hc;
  const c=cv.getContext('2d');
  for(let y=0;y<Hc;y++) for(let x=0;x<W;x++) if(g[y][x]){c.fillStyle=g[y][x];c.fillRect(x,y,1,1);}
  return cv;
}
const emptyGrid=(W,Hc)=>Array.from({length:Hc},()=>new Array(W).fill(null));

/* ================= fish sprite ================= */
function buildFishSprite(f,stage,sick){
  const sp=spriteSpec(f),ph=phenotype(f);
  const tc=c=>sick?mixHex(c,'#7d8a70',0.55):c;
  const sm=(0.88+0.12*ph.size)*1.25, stm=[0.45,0.75,1][stage];
  const L=Math.max(5,Math.round(sp.len*sm*stm)), H=Math.max(3,Math.round(sp.hei*sm*stm));
  const tt=ph.tail;
  const TL=Math.max(2,Math.round(L*[0.34,0.3,0.4,0.62,0.8][tt]*sp.tailMul));
  const TH=Math.max(3,Math.round(H*[0.9,0.75,1.3,1.25,0.6][tt]*(sp.tailMul>1?1.1:1)));
  const FH=Math.min(Math.round(H*0.85),Math.round(H*[0,0.3,0.62,0.85][ph.fin]*sp.finMul));
  const padT=Math.max(FH,Math.ceil((TH-H)/2))+2;
  const padB=Math.max(5,Math.ceil((TH-H)/2)+2)+(tt===3?Math.round(TL*0.2):0);
  const W=L+TL+2, Hc=padT+H+padB;
  const g=emptyGrid(W,Hc);
  const base=COLORS[ph.color].c, acc=COLORS[ph.accent].c;
  const hi=lighten(base,0.28), lo=darken(base,0.28);
  const bodyTop=new Array(L).fill(-1), bodyBot=new Array(L).fill(-1);
  const midY=Math.floor(H/2);
  for(let x=0;x<L;x++){
    const u=(x+0.5)/L;
    let hh=prof(sp.shape,u)*H/2;
    if(sp.shape==='bottom') hh*=1.25;
    for(let y=0;y<H;y++){
      const dy=y+0.5-H/2;
      const inside=sp.shape==='bottom'?(dy>=-hh&&dy<=hh*0.22):(Math.abs(dy)<=hh);
      if(!inside) continue;
      const v=dy/Math.max(hh,0.6);
      let col=v<-0.45?hi:(v>0.5?lo:base);
      const hs=hash2(x,y);
      let on=false;
      switch(ph.pattern){
        case 1: on=(y===midY||(H>=10&&y===midY-1))&&u>0.12&&u<0.96;break;
        case 2: on=(hs%9===0)&&u>0.2;break;
        case 3: on=u>0.25&&u<0.85&&(x%4<2);break;
        case 4: on=v>0.15&&u>0.1;break;
        case 5: on=u<0.3;break;
        case 6: on=(hs%4===0);break;
        case 7: on=((x+y)%4<2)&&u>0.15;break;
      }
      if(on) col=v<-0.45?lighten(acc,0.15):(v>0.5?darken(acc,0.2):acc);
      if(ph.sheen===2&&v<-0.45) col=mixHex(col,'#ffffff',0.55);
      g[padT+y][1+x]=tc(col);
      if(bodyTop[x]<0) bodyTop[x]=y;
      bodyBot[x]=y;
    }
  }
  const cyB=padT+H/2;
  for(let t=0;t<TL;t++){
    const x=1+L+t,q=(t+0.5)/TL;
    let th,drop=0;
    switch(tt){
      case 0: th=TH/2*(0.45+0.55*q);break;
      case 1: {const d=(q-0.4)/0.6;th=Math.max(TH/2*0.3,TH/2*Math.sqrt(Math.max(0,1-d*d)));break;}
      case 2: th=TH/2*(0.3+0.7*q);break;
      case 3: th=TH/2*(0.35+0.65*Math.sin(Math.PI*Math.pow(q,0.75)));drop=t*0.16;break;
      default: th=TH/2*(0.45+0.55*q);
    }
    for(let y=0;y<Hc;y++){
      const dy=y+0.5-cyB-drop,ad=Math.abs(dy);
      let inT=ad<=th;
      if(tt===0&&q>0.35) inT=inT&&ad>=(q-0.35)/0.65*th*0.75;
      if(tt===4) inT=(Math.abs(ad-th*0.92)<0.75||ad<0.55);
      if(tt===2&&t===TL-1&&y%2===0) inT=false;
      if(!inT) continue;
      let col;
      if(tt<=1) col=mixHex(base,acc,0.4);
      else if(tt===3) col=mixHex(acc,lighten(acc,0.4),q*0.6);
      else col=acc;
      g[y][x]=tc(col);
    }
  }
  if(FH>0){
    const x0=Math.round(L*0.25),x1=Math.max(x0+2,Math.round(L*0.74));
    for(let x=x0;x<x1&&x<L;x++){
      const top=bodyTop[x];if(top<0) continue;
      const u=(x-x0)/(x1-x0);
      let h=ph.fin===3?FH*(0.7+0.3*Math.sin(u*Math.PI*3)):FH*Math.max(0.25,1-Math.abs(u-0.3)/0.7);
      if(ph.fin===3&&x%3===0) h*=0.6;
      const n=Math.max(1,Math.round(h));
      for(let k=1;k<=n;k++){
        const y=padT+top-k;
        if(y>=1&&!g[y][1+x]) g[y][1+x]=tc(ph.fin===1?darken(base,0.1):mixHex(acc,base,0.2));
      }
    }
  }
  if(L>=9){
    const x=Math.round(L*0.38),b=bodyBot[x];
    if(b>=0){g[padT+b+1][1+x]=tc(darken(acc,0.1));if(L>=14) g[padT+b+2][1+x]=tc(darken(acc,0.1));}
  }
  if(L>=10){
    const x=Math.round(L*0.3),y=padT+Math.floor(H*0.6);
    if(g[y]&&g[y][1+x]) g[y][1+x]=tc(lighten(base,0.35));
  }
  {
    const bx=Math.max(1,Math.round(L*0.16)),by=bodyTop[bx];
    if(by>=0){
      const ey=padT+Math.min(bodyBot[bx],by+Math.max(1,Math.round(H*0.24)));
      g[ey][1+bx]='#0b1030';
      if(L>=11&&g[ey][2+bx]) g[ey][2+bx]='#ffffff';
    }
  }
  const oc=tc(darken(base,0.62));
  const out=g.map(r=>r.slice());
  for(let y=0;y<Hc;y++) for(let x=0;x<W;x++){
    if(g[y][x]) continue;
    if((y>0&&g[y-1][x])||(y<Hc-1&&g[y+1][x])||(x>0&&g[y][x-1])||(x<W-1&&g[y][x+1])) out[y][x]=oc;
  }
  return {cv:gridToCanvas(out,W,Hc),w:W,h:Hc,glow:ph.sheen===1,pearl:ph.sheen===2,glowRGB:[255,255,190],feet:Hc-3};
}

/* ================= shrimp sprite ================= */
function buildShrimp(f,stage,sick){
  const sp=spriteSpec(f),ph=phenotype(f);
  const tc=c=>sick?mixHex(c,'#7d8a70',0.55):c;
  const sm=(0.88+0.12*ph.size)*1.25, stm=[0.5,0.78,1][stage];
  const L=Math.max(7,Math.round(sp.len*sm*stm)), H=Math.max(4,Math.round(sp.hei*sm*stm));
  const ant=Math.max(3,Math.round(L*0.7));
  const W=ant+L+5, Hc=H+Math.round(H*1.1)+9;
  const g=emptyGrid(W,Hc);
  const ghost=!!sp.ghost;
  const base=ghost?mixHex(COLORS[ph.color].c,'#d8f0f5',0.62):COLORS[ph.color].c;
  const acc=COLORS[ph.accent].c;
  const x0=ant+2,yTop=Math.round(H*0.9)+3;
  const cx=t=>x0+t*(L-1);
  const cy=t=>yTop+H*0.55-Math.sin(Math.PI*Math.min(1,t*0.9))*H*0.3+(t>0.72?(t-0.72)*H*2.4:0);
  const rad=t=>t<0.2?H*0.44:Math.max(0.9,H*0.5*(1-0.62*Math.max(0,t-0.2)));
  const steps=L*5;
  const alpha=ghost?0.6:1;
  const body=new Map();
  for(let k=0;k<=steps;k++){
    const t=k/steps,px=cx(t),py=cy(t),r=rad(t);
    for(let y=Math.floor(py-r);y<=Math.ceil(py+r);y++) for(let x=Math.floor(px-r);x<=Math.ceil(px+r);x++){
      const dx=x+0.5-px,dy=y+0.5-py;
      if(dx*dx+dy*dy<=r*r){
        const key=y*1000+x,prev=body.get(key);
        if(!prev||t>prev.t) body.set(key,{x,y,t,v:dy/Math.max(r,0.8)});
      }
    }
  }
  const midY=Math.round(yTop+H*0.5);
  for(const b of body.values()){
    const hs=hash2(b.x,b.y);
    let col=b.v<-0.4?lighten(base,0.25):(b.v>0.45?darken(base,0.25):base);
    let on=false;
    switch(ph.pattern){
      case 1: on=b.v>-0.85&&b.v<-0.3&&b.t>0.12;break;
      case 2: on=(hs%7===0)&&b.t>0.15;break;
      case 3: on=(b.t>0.34&&b.t<0.5)||(b.t>0.7&&b.t<0.84);break;
      case 4: on=b.v>0.3;break;
      case 5: on=b.t<0.22;break;
      case 6: on=(hs%4===0);break;
      case 7: on=((b.x+b.y)%4<2)&&b.t>0.1;break;
    }
    if(on) col=b.v<-0.4?lighten(acc,0.15):(b.v>0.45?darken(acc,0.2):acc);
    if(ph.sheen===2&&b.v<-0.4) col=mixHex(col,'#ffffff',0.55);
    g[b.y][b.x]=ghost&&!on?rgba(tc(col),alpha):tc(col);
  }
  if(ghost){
    for(let t=0.25;t<=0.82;t+=0.04){const x=Math.round(cx(t)),y=Math.round(cy(t)+rad(t)*0.1);if(g[y]&&g[y][x]) g[y][x]=rgba(tc(darken(acc,0.2)),0.85);}
  }
  const tipX=Math.round(cx(1)),tipY=Math.round(cy(1));
  const fanCol=ghost?rgba(tc(lighten(base,0.2)),0.75):tc(mixHex(base,acc,0.35));
  [[1,-1],[1,0],[1,1],[2,0],[0,2],[1,2]].forEach(o=>{const x=tipX+o[0],y=tipY+o[1];if(g[y]&&x<W&&!g[y][x]) g[y][x]=fanCol;});
  const legCol=tc(darken(base,0.35)),legs=[];
  for(let t=0.14;t<0.6;t+=0.1){
    const x=Math.round(cx(t)),y=Math.round(cy(t)+rad(t))+1;
    legs.push({x,y,col:ghost?rgba(legCol,0.7):legCol});
    if(g[y]&&!g[y][x]) g[y][x]=ghost?rgba(legCol,0.7):legCol;
    if(L>=12&&g[y+1]&&!g[y+1][x-1]) g[y+1][x-1]=ghost?rgba(legCol,0.6):legCol;
  }
  const ac=tc(lighten(acc,0.3));
  const hx=cx(0)-rad(0)*0.7,hy=cy(0)-rad(0)*0.5;
  for(let k=0;k<ant;k++){
    const x=Math.round(hx-k),y=Math.round(hy-k*0.3-Math.sin(k*0.35)*0.8);
    if(g[y]&&x>=0&&!g[y][x]) g[y][x]=rgba(ac,0.85);
    if(k<ant*0.7){const y2=Math.round(hy+0.5+k*0.12);if(g[y2]&&x>=0&&!g[y2][x]) g[y2][x]=rgba(ac,0.65);}
  }
  const rx=Math.round(cx(0)-rad(0)),ry=Math.round(cy(0)-rad(0))-1;
  if(g[ry]&&!g[ry][rx]) g[ry][rx]=tc(darken(base,0.1));
  const ex=Math.round(cx(0)-rad(0)*0.35),ey=Math.round(cy(0)-rad(0)*0.45);
  if(g[ey]&&g[ey][ex]) g[ey][ex]='#0b1030';
  let feet=0;
  for(let y=0;y<Hc;y++) for(let x=0;x<W;x++) if(g[y][x]) feet=Math.max(feet,y);
  if(!ghost){
    const oc=tc(darken(base,0.62));
    const out=g.map(r=>r.slice());
    for(let y=0;y<Hc;y++) for(let x=0;x<W;x++){
      if(g[y][x]) continue;
      if((y>0&&g[y-1][x]&&body.has((y-1)*1000+x))||(y<Hc-1&&g[y+1][x]&&body.has((y+1)*1000+x))||(x>0&&g[y][x-1]&&body.has(y*1000+x-1))||(x<W-1&&g[y][x+1]&&body.has(y*1000+x+1))) out[y][x]=oc;
    }
    for(let y=0;y<Hc;y++) for(let x=0;x<W;x++) g[y][x]=out[y][x];
  }
  const eggPos={x:Math.round(cx(0.78)),y:Math.round(cy(0.78)+rad(0.78))+2};
  return {cv:gridToCanvas(g,W,Hc),w:W,h:Hc,glow:ph.sheen===1,pearl:ph.sheen===2,glowRGB:[255,255,190],feet:feet+1,eggPos,legs};
}

/* ================= card previews ================= */
function paintFish(cv,f,opts){
  opts=opts||{};
  const c=cv.getContext('2d');
  c.imageSmoothingEnabled=false;
  c.clearRect(0,0,cv.width,cv.height);
  const st=opts.stage!=null?opts.stage:stageOf(f);
  const s=getSprite(f,st,opts.sick!=null?opts.sick:f.sick);
  const x=Math.round((cv.width-s.w)/2),y=Math.round((cv.height-s.h)/2);
  if(s.glow){
    const gc=s.glowRGB.join(',');
    const gr=c.createRadialGradient(cv.width/2,cv.height/2,2,cv.width/2,cv.height/2,Math.max(s.w,s.h)*0.85);
    gr.addColorStop(0,'rgba('+gc+',.5)');gr.addColorStop(1,'rgba('+gc+',0)');
    c.fillStyle=gr;c.fillRect(0,0,cv.width,cv.height);
  }
  c.drawImage(s.cv,x,y);
  if(opts.silhouette){
    c.globalCompositeOperation='source-atop';
    c.fillStyle='#10233a';c.fillRect(0,0,cv.width,cv.height);
    c.globalCompositeOperation='source-over';
  }
}
function previewFish(spId,hyb){
  const kind=SP[spId].kind||'fish';
  const PV={cherry:[1,2,1],ghost:[4,2,0],amano:[3,4,1],moon:[5,7,4],nettle:[2,0,1],mat:[3,4,2],comb:[4,5,2],immortal:[11,1,0],box:[5,4,0]};
  const pv=PV[spId]||[1,2,1];
  const g=kind==='shrimp'?{color:[pv[0],pv[0]],accent:[pv[1],pv[1]],pattern:[pv[2],pv[2]],tail:[0,0],fin:[0,0],size:[1,1],sheen:[0,0]}
    :kind==='jelly'?{color:[pv[0],pv[0]],accent:[pv[1],pv[1]],pattern:[pv[2],pv[2]],tail:[1,1],fin:[1,1],size:[1,1],sheen:[0,0]}
    :{color:[5,5],accent:[2,2],pattern:[1,1],tail:[0,0],fin:[1,1],size:[1,1],sheen:[0,0]};
  const o={id:'prev-'+spId+(hyb?'-'+hyb:''),sp:spId,g,age:999,sick:false};
  if(hyb) o.hyb=hyb;
  return o;
}
function paintAllCanvases(root){
  $$('canvas[data-fish]',root).forEach(cv=>{
    const f=S.fish.find(x=>x.id==cv.dataset.fish);
    if(f) paintFish(cv,f);
  });
  $$('canvas[data-species]',root).forEach(cv=>{
    const p=previewFish(cv.dataset.species);
    const known=!!S.book.sp[cv.dataset.species];
    paintFish(cv,p,{stage:2,silhouette:cv.dataset.sil==='1'&&!known});
  });
  $$('canvas[data-hyb]',root).forEach(cv=>{
    const [a,b]=cv.dataset.hyb.split(':');
    paintFish(cv,previewFish(a,b),{stage:2});
  });
  $$('canvas[data-polyp]',root).forEach(cv=>{
    const p=S.polyps.find(x=>x.id==cv.dataset.polyp);
    const c=cv.getContext('2d');c.clearRect(0,0,cv.width,cv.height);
    if(!p) return;
    c.save();c.translate(cv.width/2,cv.height-8);c.scale(2,2);
    drawPolyp(c,p,0,0,0);
    c.restore();
  });
}

/* ================= polyps ================= */
function drawPolyp(c,p,x,y,t){
  const ph=phenotype(p);
  const base=COLORS[ph.color].c,acc=COLORS[ph.accent].c;
  const stalk=lighten(base,0.35);
  const cnt=clamp(Math.floor(p.size)+1,1,8);
  const OX=[-7,-3,1,5,-5,-1,3,7],OY=[0,1,0,1,-3,-2,-3,-2];
  for(let i=0;i<cnt;i++){
    const ox=x+OX[i],oy=y+OY[i];
    R(c,'#7c8698',ox-1,oy,4,1);
    R(c,stalk,ox,oy-3,2,3);
    const sw=Math.sin(t*2+i)>0?1:0;
    R(c,acc,ox-1+sw,oy-5,1,2);R(c,acc,ox+2-sw,oy-5,1,2);R(c,acc,ox,oy-5,2,1);
    if(p.chill>10&&Math.floor(t*3+i)%2===0) R(c,'#bfe9ff',ox,oy-7,1,1);
  }
}

/* ================= tank scene ================= */
const SW=160,SH=120,SAND_Y=104;
const scene={cv:null,c:null,bg:null,bgTheme:'',t:0,rt:new Map(),food:[],bubbles:[],fx:[],shells:[],last:0,decorMode:false,running:false};
const R=(c,col,x,y,w,h)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),w,h);};
const plantXs=()=>S.decor.slots.map((id,i)=>(id&&DECOR[id].plant)?SLOT_X[i]:null).filter(x=>x!=null);

function buildBg(th){
  const cv=document.createElement('canvas');cv.width=SW;cv.height=SH;
  const c=cv.getContext('2d');
  for(let y=0;y<SAND_Y;y+=2){R(c,mixHex(th.top,th.bot,Math.pow(y/SAND_Y,0.85)),0,y,SW,2);}
  c.fillStyle=th.sil;
  if(th.kind==='rocks'){
    for(let x=0;x<SW;x++){
      const h=26+Math.round(10*Math.sin(x*0.045+1)+7*Math.sin(x*0.13+2)+4*Math.sin(x*0.31));
      c.fillRect(x,SAND_Y-h,1,h);
    }
  }else if(th.kind==='reef'){
    for(let i=0;i<9;i++){
      const bx=6+i*18+(hash2(i,3)%7),bh=14+hash2(i,9)%22;
      R(c,th.sil,bx,SAND_Y-bh,7,bh);R(c,th.sil,bx+2,SAND_Y-bh-4,3,4);
      if(i%2) {R(c,th.sil,bx-3,SAND_Y-bh+6,3,8);R(c,th.sil,bx+7,SAND_Y-bh+3,3,10);}
    }
  }else{
    for(let i=0;i<14;i++){
      const bx=4+i*12+(hash2(i,1)%5),bh=24+hash2(i,4)%30;
      for(let k=0;k<bh;k+=2) R(c,th.sil,bx+Math.round(Math.sin(k*0.2+i)*1.5),SAND_Y-k,2,3);
    }
  }
  c.fillStyle='rgba(5,20,40,.18)';c.fillRect(0,SAND_Y-44,SW,44);
  for(let y=SAND_Y;y<SH;y++){
    R(c,y<SAND_Y+3?th.sand:mixHex(th.sand,th.sand2,(y-SAND_Y)/(SH-SAND_Y)),0,y,SW,1);
  }
  for(let x=0;x<SW;x++){
    const b=Math.round(Math.sin(x*0.22)*0.9);
    R(c,th.sand,x,SAND_Y-1+b,1,1);
    const h=hash2(x,77);
    if(h%5===0) R(c,th.sand2,x,SAND_Y+2+(h>>3)%(SH-SAND_Y-3),1,1);
    if(h%11===0) R(c,lighten(th.sand,0.3),x,SAND_Y+1+(h>>5)%(SH-SAND_Y-3),1,1);
  }
  return cv;
}

const DRAW={
  kelp:(c,x,y,t)=>{for(let i=0;i<3;i++){const bx=x-6+i*6,h=26+(i%2)*9;for(let k=0;k<h;k+=2){const sw=Math.round(Math.sin(t*1.3+k*0.18+i)*(k/h)*2.4);R(c,k%4?'#2e9e57':'#3cb56a',bx+sw,y-k-2,2,3);}}},
  fern:(c,x,y,t)=>{for(let i=-3;i<=3;i++){const h=12-Math.abs(i)*2;for(let k=0;k<h;k++){const sw=Math.round(Math.sin(t*1.6+k*0.3+i)*(k/h)*1.5);R(c,k%3?'#3f9f4b':'#58bd5e',x+i*2+Math.round(i*k/9)+sw,y-k-1,2,2);}}},
  redweed:(c,x,y,t)=>{for(let i=0;i<4;i++){const bx=x-6+i*4,h=16+(i*5)%9;for(let k=0;k<h;k+=2){const sw=Math.round(Math.sin(t*1.1+k*0.25+i*2)*(k/h)*2);R(c,k%4?'#b02e56':'#d04a70',bx+sw,y-k-2,3,2);}}},
  pebbles:(c,x,y)=>{R(c,'#6b7486',x-9,y-3,7,4);R(c,'#8892a4',x-9,y-3,7,1);R(c,'#7c8698',x-2,y-5,8,6);R(c,'#a0a9ba',x-2,y-5,8,1);R(c,'#5e677a',x+5,y-3,6,4);R(c,'#7c8698',x+5,y-3,6,1);},
  shell:(c,x,y)=>{R(c,'#f0c8c0',x-6,y-7,12,7);R(c,'#ffe3dc',x-5,y-8,10,1);R(c,'#e0a9a0',x-6,y-4,12,1);R(c,'#e0a9a0',x-2,y-7,1,7);R(c,'#e0a9a0',x+2,y-7,1,7);R(c,'#c98d85',x-6,y-1,12,1);},
  rock:(c,x,y)=>{R(c,'#59636f',x-11,y-8,22,8);R(c,'#6c7784',x-8,y-13,16,5);R(c,'#84909c',x-7,y-13,14,1);R(c,'#3f8a4a',x-9,y-9,6,2);R(c,'#3f8a4a',x+2,y-14,4,2);R(c,'#47515d',x-11,y-1,22,1);},
  wood:(c,x,y)=>{R(c,'#6b4a2f',x-16,y-5,30,5);R(c,'#8a6443',x-16,y-5,30,1);R(c,'#6b4a2f',x-12,y-12,5,8);R(c,'#6b4a2f',x+4,y-16,5,12);R(c,'#8a6443',x+4,y-16,1,12);R(c,'#4d331f',x-16,y-1,30,1);R(c,'#8a6443',x+9,y-19,3,4);},
  chest:(c,x,y,t)=>{const open=Math.sin(t*0.6)>0.92;R(c,'#7a4a24',x-9,y-9,18,9);R(c,'#a0653a',x-9,y-9,18,2);R(c,'#e0b43a',x-9,y-5,18,1);R(c,'#e0b43a',x-1,y-7,3,4);R(c,'#4f2e14',x-9,y-1,18,1);if(open){R(c,'#7a4a24',x-9,y-14,18,4);R(c,'#ffe27a',x-5,y-11,3,2);R(c,'#ffe27a',x+1,y-12,3,2);}else{R(c,'#8a5530',x-9,y-12,18,3);R(c,'#a0653a',x-9,y-12,18,1);}},
  bubbler:(c,x,y)=>{R(c,'#556070',x-4,y-4,8,4);R(c,'#7d8a9c',x-4,y-4,8,1);R(c,'#3c4654',x-2,y-7,4,3);},
  castle:(c,x,y)=>{R(c,'#c9b48a',x-15,y-16,30,16);R(c,'#ddcaa0',x-15,y-16,30,2);R(c,'#c9b48a',x-15,y-24,8,8);R(c,'#c9b48a',x+7,y-24,8,8);R(c,'#ddcaa0',x-15,y-26,2,2);R(c,'#ddcaa0',x-11,y-26,2,2);R(c,'#ddcaa0',x+7,y-26,2,2);R(c,'#ddcaa0',x+11,y-26,2,2);R(c,'#ddcaa0',x-4,y-20,2,4);R(c,'#ddcaa0',x+2,y-20,2,4);R(c,'#33284a',x-4,y-10,8,10);R(c,'#33284a',x-12,y-19,3,4);R(c,'#33284a',x+9,y-19,3,4);R(c,'#a8946c',x-15,y-1,30,1);},
  arch:(c,x,y)=>{R(c,'#8f9aa8',x-16,y-22,6,22);R(c,'#8f9aa8',x+10,y-22,6,22);R(c,'#a8b3c0',x-16,y-22,6,2);R(c,'#a8b3c0',x+10,y-22,6,2);R(c,'#8f9aa8',x-16,y-28,32,6);R(c,'#a8b3c0',x-16,y-28,32,2);R(c,'#7a8492',x-7,y-22,14,2);R(c,'#3f8a4a',x-16,y-14,4,3);R(c,'#3f8a4a',x+12,y-24,4,3);R(c,'#6f7a88',x-16,y-1,6,1);R(c,'#6f7a88',x+10,y-1,6,1);}
};

function sceneInit(){
  scene.cv=$('#scene');scene.c=scene.cv.getContext('2d');scene.c.imageSmoothingEnabled=false;
  scene.cv.addEventListener('pointerdown',onScenePointer);
}
function floorY(f,s){return SAND_Y+3-s.feet+s.h/2;}
function rtFor(f){
  let r=scene.rt.get(f.id);
  if(!r){
    const kind=kindOf(f),s=getSprite(f,stageOf(f),f.sick);
    r={x:rnd(20,140),y:kind==='fish'?rnd(20,90):(kind==='jelly'?rnd(25,60):floorY(f,s)),tx:80,ty:60,dir:Math.random()<0.5?-1:1,wait:rnd(0,1.5),phase:rnd(0,6.28),pp:Math.random(),
      turn:0,shim:0,flee:0,chase:0,chaseT:0,nibble:false,hop:0,hopV:0,molt:rnd(90,240),sleep:false};
    if(kind==='jelly') r.ty=jellyDepthY(f,s);
    scene.rt.set(f.id,r);
  }
  return r;
}
function feedFlakes(){
  if(scene.food.length>30) return false;
  for(let i=0;i<7;i++){
    const fx=rnd(28,132);
    scene.food.push({x:fx,y:rnd(2,10),vy:rnd(7,12),floor:false,t:0});
    burst('plunge',fx,3,{n:2});
  }
  ripple(rnd(40,70),2,15,{ry:0.25});ripple(rnd(90,120),2,12,{ry:0.25,dur:0.8});
  return true;
}
function addFx(type,x,y){scene.fx.push({type,x,y,t:0});if(scene.fx.length>40) scene.fx.shift();}
function onStageUp(f,st){
  if(st>0) qJuice({kind:'grow',id:f.id});
  if(kindOf(f)==='shrimp'&&st>0){
    const r=scene.rt.get(f.id);
    if(r) scene.shells.push({id:f.id,x:r.x,y:r.y,t:40});
  }
}
function nearestFlake(r,floorOnly,maxD){
  let best=null,bd=maxD||1e9;
  for(const fl of scene.food){
    if(floorOnly&&!fl.floor) continue;
    const d=Math.hypot(fl.x-r.x,fl.y-r.y);
    if(d<bd){bd=d;best=fl;}
  }
  return best;
}
function traitSpeed(tr){return tr==='lazy'?0.7:(tr==='bold'?1.15:(tr==='playful'?1.1:(tr==='shy'?0.9:1)));}

/* Glass greetings are deliberately temporary and throttled. Food, rest and health
   always win; nothing here changes hunger, happiness or income. */
function reactToGlass(x,y){
  if(y<0||y>SAND_Y||scene.decorMode) return;
  const room=3-S.fish.filter(f=>scene.rt.get(f.id)?.greeting).length;
  if(room<=0) return;
  const nearby=S.fish.filter(f=>{
    const r=scene.rt.get(f.id);
    return r&&!r.greeting&&r.flee<=0&&!f.sick&&!r.sleep&&dayLight()>=0.4&&
      !(scene.food.length&&f.hunger<(f.trait==='greedy'?98:92))&&
      scene.t>=(r.greetAfter||0)&&!(kindOf(f)==='shrimp'&&r.hop>0)&&
      Math.hypot(r.x-x,r.y-y)<(kindOf(f)==='fish'?(f.trait==='shy'?52:90):48);
  }).sort((a,b)=>{
    const ar=scene.rt.get(a.id),br=scene.rt.get(b.id);
    return Math.hypot(ar.x-x,ar.y-y)-Math.hypot(br.x-x,br.y-y);
  }).slice(0,room);
  nearby.forEach((f,i)=>{
    const r=scene.rt.get(f.id),shy=f.trait==='shy',kind=kindOf(f);
    r.greetAfter=scene.t+12;r.wait=0;r.chase=0;r.nibble=false;r.atHome=false;r.visitingHome=false;
    const dx=r.x-x,dy=r.y-y,d=Math.hypot(dx,dy)||1;
    if(kind==='shrimp'){
      const distance={shy:14,bold:4,greedy:3,lazy:0,social:6,playful:9}[f.trait];
      const away=dx<0?-1:dx>0?1:r.x<80?1:-1;
      r.foraging=false;
      r.greeting={phase:'freeze',t:0,originX:r.x,awayX:clamp(r.x+away*distance,8,152),
        pause:f.trait==='lazy'?1.8:shy?1.1:0.45};
      return;
    }
    if(kind==='jelly'){
      const sp=SP[f.sp],s=getSprite(f,stageOf(f),f.sick),toward=x<r.x?-1:1;
      const offset=f.trait==='lazy'?0:sp.floor?3:shy?-8:f.trait==='playful'?12:8;
      r.greeting={phase:'drift',t:0,courseX:clamp(r.x+toward*offset,14,146),
        courseY:jellyDepthY(f,s),duration:f.trait==='lazy'?3:4.5};
      return;
    }
    r.greeting={phase:shy?'retreat':f.trait==='lazy'?'watch':'approach',t:0,
      x:clamp(x+(i-1)*9,10,150),y:clamp(y+(i%2?6:-4),14,SAND_Y-10),
      awayX:clamp(r.x+(dx?dx/d:(r.x<80?1:-1))*24,10,150),
      awayY:clamp(r.y+dy/d*18,14,SAND_Y-10)};
  });
}
function endGreeting(r){r.greeting=null;r.wait=0;r.tx=r.x;r.ty=r.y;}
function moveShrimpGreeting(f,r,dt,speed){
  const g=r.greeting;g.t+=dt;
  r.y=floorY(f,getSprite(f,stageOf(f),f.sick));
  if(g.phase==='freeze'){
    if(g.t>=g.pause){
      if(f.trait==='lazy'){endGreeting(r);return true;}
      g.phase='retreat';g.t=0;
    }
    return true;
  }
  if(g.phase==='settle'){
    if(g.t>=1){endGreeting(r);}
    return true;
  }
  const retreat=g.phase==='retreat',target=retreat?g.awayX:g.originX,dx=target-r.x;
  const pace=retreat?(REDUCED?0.55:0.9):0.45;
  r.x+=Math.sign(dx)*Math.min(Math.abs(dx),speed*pace*dt);
  if(Math.abs(dx)>0.5) r.dir=dx<0?-1:1;
  if(Math.abs(target-r.x)<0.5){g.phase=retreat?'return':'settle';g.t=0;}
  return true;
}
function steerJellyGreeting(f,r,dt){
  const g=r.greeting;g.t+=dt;
  if(g.t>=g.duration){endGreeting(r);r.ty=jellyDepthY(f,getSprite(f,stageOf(f),f.sick));return;}
  r.tx=g.courseX;r.ty=g.courseY;r.wait=0;
}
function jellyPulseRate(f,r){
  // Keep the native pulse continuous; only its pace changes a little.
  if(!r.greeting||REDUCED) return 1;
  return {shy:0.94,bold:1.08,greedy:1.04,lazy:0.96,social:1.04,playful:1.12}[f.trait]||1;
}
function jellyDepthY(f,s){
  const depth=ensurePreferredDepth(f),sp=SP[f.sp];
  if(sp.floor) return SAND_Y+4-s.h/2;
  const bottom=Math.max(14,SAND_Y-(sp.glide?s.h/2:s.h)-4);
  return clamp(14+depth*(SAND_Y-40),14,bottom);
}
function pickJellyTarget(f,r,s){
  const band=f.trait==='playful'?9:f.trait==='lazy'?3:6;
  r.tx=rnd(14,146);r.ty=clamp(jellyDepthY(f,s)+rnd(-band,band),14,
    Math.max(14,SAND_Y-(SP[f.sp].glide?s.h/2:s.h)-4));
  r.chase=0;r.nibble=false;r.visitingHome=false;
}
function moveGreeting(f,r,dt,speed){
  if(kindOf(f)==='shrimp') return moveShrimpGreeting(f,r,dt,speed);
  if(kindOf(f)==='jelly'){steerJellyGreeting(f,r,dt);return false;}
  const g=r.greeting;if(!g) return false;
  g.t+=dt;
  if(g.phase==='watch'||g.phase==='linger'){
    if(Math.abs(g.x-r.x)>2) r.dir=g.x<r.x?-1:1;
    if(g.t>(f.trait==='greedy'?0.8:2.4)){r.greeting=null;r.wait=0;r.tx=r.x;r.ty=r.y;}
    return true;
  }
  const retreat=g.phase==='retreat';
  const tx=retreat?g.awayX:g.x,ty=retreat?g.awayY:g.y;
  const dx=tx-r.x,dy=ty-r.y,d=Math.hypot(dx,dy);
  const pace=retreat?(REDUCED?0.8:1.3):(f.trait==='shy'?0.5:f.trait==='playful'?1.05:0.85);
  // Account for the actual species, trait and daylight pace. A fixed ceiling
  // made slow dusk swimmers abandon greetings before they could arrive.
  if(!retreat&&g.approachLimit===undefined) g.approachLimit=Math.max(8,d/(speed*pace)+2);
  const step=Math.min(d,speed*pace*dt);
  if(d>0){r.x+=dx/d*step;r.y+=dy/d*step;}
  if(Math.abs(dx)>2){const dir=dx<0?-1:1;if(dir!==r.dir){r.dir=dir;r.turn=REDUCED?0:0.2;}}
  if(retreat&&g.t>=1.8){g.phase='approach';g.t=0;}
  else if(!retreat&&(d<3||g.t>g.approachLimit)){
    if(d<3){g.phase='linger';g.t=0;if(!REDUCED) addFx('heart',r.x,r.y-6);}
    else{r.greeting=null;r.tx=r.x;r.ty=r.y;}
  }
  return true;
}

function pickFishTarget(f,r,sp,st,night){
  if(kindOf(f)==='jelly'){pickJellyTarget(f,r,getSprite(f,stageOf(f),f.sick));return;}
  const tr=f.trait,plants=plantXs();
  r.nibble=false;r.visitingHome=false;
  const home=kindOf(f)==='fish'?ensureFavoritePlace(f):null;
  if(home&&(night>0.6||Math.random()<(tr==='shy'||tr==='lazy'?0.65:0.35))){
    r.chase=0;r.visitingHome=true;r.tx=home.x+rnd(-3,3);r.ty=home.y+rnd(-2,2);return;
  }
  if(r.chase){
    const o=S.fish.find(x=>x.id===r.chase),orr=o&&scene.rt.get(o.id);
    if(orr&&r.chaseT>0){r.tx=orr.x;r.ty=orr.y;return;}
    r.chase=0;
  }
  if(night>0.6){r.tx=rnd(10,150);r.ty=SAND_Y-rnd(6,24);return;}
  if(tr==='playful'&&Math.random()<0.2){
    const others=S.fish.filter(x=>x.id!==f.id&&kindOf(x)==='fish'&&scene.rt.get(x.id));
    if(others.length){const o=pick(others),orr=scene.rt.get(o.id);r.chase=o.id;r.chaseT=rnd(4,8);r.tx=orr.x;r.ty=orr.y;return;}
  }
  if(sp.algae&&S.algae>10&&Math.random()<0.4){r.nibble=true;r.tx=Math.random()<0.5?9:151;r.ty=rnd(35,92);return;}
  if((st===0||tr==='shy')&&plants.length&&Math.random()<0.7){r.tx=pick(plants)+rnd(-9,9);r.ty=SAND_Y-rnd(5,24);return;}
  if(tr==='shy'){r.tx=rnd(10,150);r.ty=rnd(SAND_Y-26,SAND_Y-6);return;}
  const buddies=S.fish.filter(x=>x.id!==f.id&&x.sp===f.sp&&scene.rt.get(x.id));
  if(buddies.length&&(tr==='social'?Math.random()<0.8:Math.random()<0.22)){
    const br=scene.rt.get(pick(buddies).id);
    r.tx=clamp(br.x+rnd(-14,14),8,152);r.ty=clamp(br.y+rnd(-8,8),10,SAND_Y-8);return;
  }
  const band=tr==='bold'?rnd(0.1,0.9):sp.dep;
  r.tx=rnd(10,150);r.ty=clamp(14+band*84+rnd(-16,16),10,SAND_Y-8);
}
function moveFish(f,r,sp,st,night,dt,speed,hungryFood){
  if(hungryFood){
    r.atHome=false;r.visitingHome=false;
    const fl=nearestFlake(r,false);
    if(fl){r.tx=fl.x;r.ty=fl.y;speed*=1.7;r.wait=0;r.chase=0;}
  }
  if(r.chase){
    speed*=1.45;r.chaseT-=dt;
    const o=S.fish.find(x=>x.id===r.chase),orr=o&&scene.rt.get(o.id);
    if(orr){
      r.tx=orr.x;r.ty=orr.y;
      if(Math.hypot(orr.x-r.x,orr.y-r.y)<9){orr.flee=1.2;r.chaseT-=1.5;addFx('bub',orr.x,orr.y);}
    }
  }
  if(r.wait>0){r.wait-=dt;return;}
  const dx=r.tx-r.x,dy=r.ty-r.y,d=Math.hypot(dx,dy);
  if(d<2.5){
    if(kindOf(f)==='jelly'&&r.greeting) return;
    r.atHome=!!r.visitingHome;
    r.wait=r.atHome?rnd(3,6)*(f.trait==='lazy'?1.5:1):rnd(0.3,2.4)*(f.trait==='lazy'?2.2:1)*(r.nibble?2.5:1);
    if(r.nibble) S.algae=Math.max(0,S.algae-1.2);
    pickFishTarget(f,r,sp,st,night);
  }else{
    r.atHome=false;
    const s=Math.min(d,speed*dt);
    r.x+=dx/d*s;r.y+=dy/d*s;
    if(Math.abs(dx)>3){const nd=dx<0?-1:1;if(nd!==r.dir){r.dir=nd;r.turn=0.2;}}
  }
}
function moveShrimp(f,r,sp,st,night,dt,speed,hungryFood,s){
  const fy=floorY(f,s);
  if(r.hop>0){
    r.hop-=dt;r.hopV+=70*dt;r.y+=r.hopV*dt;
    r.x+=r.dir*speed*1.5*dt;
    if(r.y>=fy){r.y=fy;r.hop=0;}
    r.x=clamp(r.x,6,154);
    return;
  }
  r.y=fy;
  if(hungryFood){
    const fl=nearestFlake(r,true);
    if(fl){r.tx=fl.x;speed*=2;r.wait=0;r.atHome=false;r.visitingHome=false;}
  }
  if(r.wait>0){r.wait-=dt;return;}
  const dx=r.tx-r.x;
  if(Math.abs(dx)<2){
    r.atHome=!!r.visitingHome;
    r.wait=(r.atHome?rnd(3,6):rnd(1,4))*(f.trait==='lazy'?1.8:1);
    const home=ensureFavoritePlace(f);
    r.visitingHome=night>0.6||Math.random()<(f.trait==='shy'||f.trait==='lazy'?0.7:0.5);
    r.tx=r.visitingHome?home.x:rnd(10,150);
    if(!r.atHome&&!REDUCED&&st>0&&Math.random()<(f.trait==='playful'?0.3:0.1)&&night<0.5){r.hop=1;r.hopV=-34;}
  }else{
    r.atHome=false;
    r.x+=Math.sign(dx)*Math.min(Math.abs(dx),speed*dt);
    const nd=dx<0?-1:1;if(nd!==r.dir){r.dir=nd;r.turn=0.2;}
  }
}
function moveJelly(f,r,sp,st,night,dt,speed,hungryFood,s){
  if(sp.floor){
    r.y=SAND_Y+2-s.h/2+2;
    if(r.wait>0){r.wait-=dt;return;}
    const dx=r.tx-r.x;
    if(Math.abs(dx)<2){if(!r.greeting){r.wait=rnd(6,16);r.tx=rnd(14,146);}}
    else r.x+=Math.sign(dx)*Math.min(Math.abs(dx),speed*0.5*dt);
    return;
  }
  if(hungryFood){const fl=nearestFlake(r,false,60);if(fl){r.tx=fl.x;r.ty=fl.y-8;}}
  const up=r.pp<0.5;
  let vy=up?-12*(1-r.pp*2*0.6):4.5;
  if(r.y<r.ty-4) vy+=up?5:6;
  if(r.y>r.ty+10) vy-=up?0:2;
  r.y=clamp(r.y+vy*dt*(1-night*0.3),10,Math.max(10,SAND_Y-s.h-4));
  const dx=r.tx-r.x;
  if(Math.abs(dx)<3){
    if(r.greeting||hungryFood) return;
    if(r.wait<=0) r.wait=rnd(2,6);
    r.wait-=dt;
    if(r.wait<=0) pickJellyTarget(f,r,s);
    return;
  }
  r.x+=Math.sign(dx)*Math.min(Math.abs(dx),speed*(up?1.4:0.5)*dt);
  const nd=dx<0?-1:1;if(nd!==r.dir) r.dir=nd;
}

function updateScene(dt){
  const night=1-dayLight();
  const alive=new Set();
  const showSound=curTab==='tank'&&!sheetState;
  for(const f of S.fish){
    alive.add(f.id);
    const r=rtFor(f),sp=SP[f.sp],st=stageOf(f),kind=kindOf(f),tr=f.trait;
    const s=getSprite(f,st,f.sick);
    if(r.mv===undefined){r.mv=0;r.wag=rnd(0,6.28);r.sq=0;}
    const px=r.x,py=r.y;
    r.sq=Math.max(0,r.sq-dt);
    r.phase+=dt*(f.sick?2:4);
    r.turn=Math.max(0,r.turn-dt);r.shim=Math.max(0,r.shim-dt);
    if(r.flee>0) r.flee-=dt;
    r.sleep=night>0.6&&!f.sick&&!(scene.food.length>0&&f.hunger<92);
    const limit=tr==='greedy'?98:92;
    const hungryFood=f.hunger<limit&&scene.food.length>0&&!r.sleep;
    let speed=sp.spd*16*(st===0?1.25:1)*(f.sick?0.45:1)*(1-night*0.6)*traitSpeed(tr);
    if(r.sleep) speed*=0.35;
    if(r.flee>0) speed*=2.4;
    if(r.greeting&&(hungryFood||r.sleep||f.sick||r.flee>0)){
      r.greeting=null;r.wait=0;
      if(r.flee<=0){r.tx=r.x;r.ty=r.y;}
    }
    ensureFavoritePlace(f);ensurePreferredDepth(f);
    if(kind==='jelly') r.pp=(r.pp+dt*0.4*(sp.pulse||1)*jellyPulseRate(f,r))%1;
    if(r.greeting&&moveGreeting(f,r,dt,speed)){}
    else if(kind==='fish'||sp.glide) moveFish(f,r,sp,st,night,dt,speed,hungryFood);
    else if(kind==='shrimp') moveShrimp(f,r,sp,st,night,dt,speed,hungryFood,s);
    else moveJelly(f,r,sp,st,night,dt,speed,hungryFood,s);
    r.foraging=kind==='shrimp'&&r.wait>0&&r.hop<=0&&!r.greeting&&!r.sleep&&!f.sick;
    r.x=clamp(r.x,6,154);
    if(kind==='fish') r.y=clamp(r.y,8,SAND_Y-4);
    else if(sp.glide) r.y=clamp(r.y,8,SAND_Y-s.h/2-4);
    r.mv+=(Math.hypot(r.x-px,r.y-py)/Math.max(dt,0.001)-r.mv)*Math.min(1,dt*6);
    r.wag+=dt*(5+Math.min(r.mv,24)*0.3);
    if(r.sleep&&showSound&&Math.random()<dt*0.45) addFx('z',r.x+(r.dir<0?-4:4),r.y-s.h/2-2);
    if(kind==='shrimp'&&st>0){
      r.molt-=dt;
      if(r.molt<=0){r.molt=rnd(120,300);if(f.hunger>50&&!f.sick) scene.shells.push({id:f.id,x:r.x,y:r.y,t:40});}
    }
  }
  for(const b of S.fish){
    if(b.sp!=='box') continue;
    const br=scene.rt.get(b.id);if(!br) continue;
    for(const o of S.fish){
      if(o===b||o.sp==='box'||kindOf(o)==='shrimp') continue;
      const orr=scene.rt.get(o.id);
      if(!orr||orr.flee>0||Math.hypot(orr.x-br.x,orr.y-br.y)>16) continue;
      orr.flee=0.9;orr.wait=0;
      orr.tx=clamp(orr.x+(orr.x-br.x)*3+rnd(-10,10),8,152);
      orr.ty=clamp(orr.y+(orr.y-br.y)*3+rnd(-10,10),12,SAND_Y-10);
      addFx('bub',orr.x,orr.y-4);
    }
  }
  for(const id of [...scene.rt.keys()]) if(!alive.has(id)) scene.rt.delete(id);
  /* food */
  for(let i=scene.food.length-1;i>=0;i--){
    const fl=scene.food[i];
    if(fl.floor){
      fl.t-=dt;
      if(fl.t<=0){S.waste=Math.min(100,S.waste+0.35);scene.food.splice(i,1);continue;}
    }else{
      fl.y+=fl.vy*dt;
      if(fl.y>=SAND_Y-2){fl.floor=true;fl.t=16;fl.y=SAND_Y-1;burst('sand',fl.x,SAND_Y-1,{n:3});}
    }
    let eaten=false;
    for(const f of S.fish){
      if(f.hunger>=95) continue;
      const r=scene.rt.get(f.id);if(!r) continue;
      const kind=kindOf(f);
      const rx=kind==='jelly'?9:(kind==='shrimp'?5:6),ry=kind==='jelly'?10:(kind==='shrimp'?5:5);
      if(kind==='shrimp'&&!fl.floor) continue;
      if(Math.abs(fl.x-r.x)<rx&&Math.abs(fl.y-r.y)<ry+(kind==='shrimp'?3:0)){
        f.hunger=Math.min(100,f.hunger+12);eaten=true;
        r.sq=0.32;burst('crumbs',r.x+(r.dir>0?3:-3),r.y,{n:3});
        if(showSound) sfx.eat();
        if(f.hunger>=95&&mood(f)[1]==='good'&&Math.random()<0.55) addFx('heart',r.x,r.y-6);
        if(Math.random()<0.5) scene.bubbles.push({x:r.x+r.dir*-4,y:r.y-2,vy:rnd(8,14),s:1});
        break;
      }
    }
    if(eaten){scene.food.splice(i,1);}
  }
  /* bubbles */
  const hasBubbler=S.decor.slots.includes('bubbler');
  if(hasBubbler&&Math.random()<dt*9){const i=S.decor.slots.indexOf('bubbler');scene.bubbles.push({x:SLOT_X[i]+rnd(-2,2),y:SAND_Y-6,vy:rnd(14,26),s:Math.random()<0.3?2:1});if(showSound&&Math.random()<0.2) sfx.bubble();}
  if(Math.random()<dt*0.7){scene.bubbles.push({x:rnd(8,152),y:SAND_Y-2,vy:rnd(6,12),s:1});if(showSound&&Math.random()<0.3) sfx.bubble();}
  const chest=S.decor.slots.indexOf('chest');
  if(chest>=0&&Math.sin(scene.t*0.6)>0.92&&Math.random()<dt*10) scene.bubbles.push({x:SLOT_X[chest]+rnd(-3,3),y:SAND_Y-12,vy:rnd(14,24),s:1});
  for(let i=scene.bubbles.length-1;i>=0;i--){const b=scene.bubbles[i];b.y-=b.vy*dt;b.x+=Math.sin(scene.t*3+b.y*0.2)*0.15;if(b.y<2) scene.bubbles.splice(i,1);}
  if(scene.bubbles.length>60) scene.bubbles.splice(0,scene.bubbles.length-60);
  for(let i=scene.fx.length-1;i>=0;i--){const e=scene.fx[i];e.t+=dt;if(e.t>1.4) scene.fx.splice(i,1);}
  for(let i=scene.shells.length-1;i>=0;i--){const e=scene.shells[i];e.t-=dt;if(e.t<=0) scene.shells.splice(i,1);}
  updateJuice(dt);
}

const HEART=['.#.#.','#####','.###.','..#..'];
const ZZ=['###','.#.','###'];
function drawGlyph(c,rows,x,y,col){
  c.fillStyle=col;
  rows.forEach((r,j)=>{for(let i=0;i<r.length;i++) if(r[i]==='#') c.fillRect(Math.round(x)+i,Math.round(y)+j,1,1);});
}
function drawSpr(c,s,r,x,y,flipX,flipY,sx,frame,extra,sy,wig){
  c.save();
  const cx=Math.round(x+s.w/2),cy=Math.round(y+s.h/2);
  c.translate(cx,cy);
  c.scale((flipX?-1:1)*(sx||1),(flipY?-1:1)*(sy||1));
  const ox=-Math.round(s.w/2),oy=-Math.round(s.h/2);
  if(wig>0.02&&!REDUCED){
    /* tail ripple: slide each pixel column up/down, more toward the tail (head is on the left) */
    const W=frame.width,H=frame.height,ph=r.wag||0;
    for(let ix=0;ix<W;ix++){
      const u=ix/W,dy=Math.round(Math.sin(ph-ix*0.42)*wig*u*u*1.7);
      c.drawImage(frame,ix,0,1,H,ox+ix,oy+dy,1,H);
    }
  }else c.drawImage(frame,ox,oy);
  if(extra){c.translate(ox,oy);extra(c);}
  c.restore();
}
function drawScene(){
  const c=scene.c,t=scene.t,th=THEMES.find(x=>x.id===S.theme)||THEMES[0];
  if(scene.bgTheme!==th.id){scene.bg=buildBg(th);scene.bgTheme=th.id;}
  const light=dayLight(),night=1-light;
  c.globalCompositeOperation='source-over';
  c.drawImage(scene.bg,0,0);
  c.fillStyle='rgba(255,255,255,'+(0.05+0.05*light).toFixed(3)+')';
  for(let i=0;i<4;i++){
    const bx=((i*46+t*2.2)%200)-24;
    c.beginPath();c.moveTo(bx,0);c.lineTo(bx+14,0);c.lineTo(bx+4,SAND_Y);c.lineTo(bx-20,SAND_Y);c.closePath();c.fill();
  }
  drawAmbientBack(c,t,light);
  /* decor behind creatures */
  S.decor.slots.forEach((id,i)=>{if(id&&DRAW[id]&&!DECOR[id].plant) DRAW[id](c,SLOT_X[i],SAND_Y+2,t);});
  /* molted shells */
  for(const e of scene.shells){
    const f=S.fish.find(x=>x.id===e.id);if(!f) continue;
    const s=getSprite(f,stageOf(f),false);
    c.globalAlpha=Math.min(0.45,e.t/40*0.45);
    c.save();c.translate(Math.round(e.x),Math.round(SAND_Y+3-s.feet+s.h*0.5+s.h/2-s.h*0.5));c.scale(1,1);c.drawImage(s.cv,-Math.round(s.w/2),-Math.round(s.h/2));c.restore();
    c.globalAlpha=1;
  }
  /* polyps */
  S.polyps.forEach((p,j)=>drawPolyp(c,p,18+j*26,SAND_Y+12,t));
  /* coin pile */
  const coins=Math.min(14,Math.floor(S.pile));
  if(coins>0){
    const rows=[5,4,3,2],px=147,py=SAND_Y+14;let n=0;
    for(let ri2=0;ri2<rows.length&&n<coins;ri2++){
      for(let k=0;k<rows[ri2]&&n<coins;k++,n++){
        const cx=px-rows[ri2]*2+k*4+1,cy=py-ri2*3;
        R(c,'#b8860b',cx,cy+1,4,2);R(c,'#f4c542',cx,cy,4,2);R(c,'#fff1a8',cx+1,cy,2,1);
      }
    }
    if(Math.sin(t*5)>0.8) R(c,'#fff',px+Math.round(Math.sin(t*9)*6),py-8,1,1);
  }
  /* creatures */
  const order=[...S.fish].sort((a,b)=>{
    const fa=SP[a.sp].dep,fb=SP[b.sp].dep;return fb-fa;
  });
  const carriers=new Set(S.eggs.filter(e=>e.carrier).map(e=>e.carrier));
  for(const f of order){
    const r=scene.rt.get(f.id);if(!r) continue;
    const s=getSprite(f,stageOf(f),f.sick),sp=SP[f.sp];
    const bob=sp.floor?0:(s.jelly?0:Math.sin(r.phase)*0.6);
    const shim=r.shim>0?Math.round(Math.sin(r.shim*45)*1.6):0;
    const x=Math.round(r.x-s.w/2)+shim,y=Math.round(r.y-s.h/2+bob);
    if(s.glow){
      const cx=x+s.w/2,cy=y+s.h/2,rad=Math.max(s.w,s.h)*(0.95+0.1*Math.sin(t*2+r.phase));
      const gc=s.glowRGB.join(',');
      const gr=c.createRadialGradient(cx,cy,1,cx,cy,rad);
      gr.addColorStop(0,'rgba('+gc+','+(0.35+0.35*night)+')');gr.addColorStop(1,'rgba('+gc+',0)');
      c.globalCompositeOperation='lighter';c.fillStyle=gr;c.fillRect(cx-rad,cy-rad,rad*2,rad*2);c.globalCompositeOperation='source-over';
    }
    const frame=s.jelly?s.frames[Math.floor(r.pp*4)%4]:s.cv;
    let sx=r.turn>0?(0.2+0.8*(1-r.turn/0.2)):1,sy=1;
    if(r.sq>0&&!REDUCED){
      /* squash then stretch, springing back */
      const u=Math.min(1,r.sq/0.4),q=u*Math.cos((1-u)*Math.PI*2.4);
      sx*=1+0.24*q;sy=1-0.2*q;
    }
    const wig=SP[f.sp].kind==='fish'?(r.sleep?0.15:(f.sick?0.25:0.45+Math.min(1,(r.mv||0)/14)*0.9)):0;
    const flipX=r.dir>0,flipY=false;
    const berried=carriers.has(f.id)&&s.eggPos;
    const forage=r.foraging&&s.legs&&!REDUCED;
    drawSpr(c,s,r,x,y,flipX,flipY,sx,frame,(berried||forage)?(cc=>{
      if(berried) for(let k=0;k<4;k++){cc.fillStyle=k%2?'#8fd36a':'#c6e86a';cc.fillRect(s.eggPos.x-k,s.eggPos.y+(k%2),1,1);}
      if(forage) s.legs.forEach((leg,i)=>{
        const reach=(Math.floor(r.phase*2)+i)%2;
        cc.fillStyle=leg.col;cc.fillRect(leg.x-reach,leg.y+1,1,1);
      });
    }):null,sy,wig);
    if(s.pearl&&Math.sin(t*3+r.phase*2)>0.94){const px=x+Math.round(s.w*0.45),py=y+Math.round(s.h*0.4);R(c,'#fff',px,py,1,1);R(c,'#fff',px-1,py,3,1);R(c,'#fff',px,py-1,1,3);}
    if(f.sick){R(c,'#7ee08a',x+s.w/2-1,y-6,3,1);R(c,'#7ee08a',x+s.w/2,y-7,1,3);}
    else if(f.hunger<30){R(c,'#ffd166',x+s.w/2,y-7,1,3);R(c,'#ffd166',x+s.w/2,y-3,1,1);}
  }
  /* plants in front so small creatures can hide behind them */
  S.decor.slots.forEach((id,i)=>{if(id&&DRAW[id]&&DECOR[id].plant) DRAW[id](c,SLOT_X[i],SAND_Y+2,t);});
  for(const fl of scene.food) R(c,fl.floor?'#c98a3a':'#e8a04a',fl.x,fl.y,2,2);
  for(const b of scene.bubbles){c.fillStyle='rgba(255,255,255,.55)';c.fillRect(Math.round(b.x),Math.round(b.y),b.s,b.s);if(b.s>1){c.fillStyle='rgba(255,255,255,.9)';c.fillRect(Math.round(b.x),Math.round(b.y),1,1);}}
  for(const e of scene.fx){
    const a=Math.max(0,1-e.t/1.4);
    c.globalAlpha=a;
    if(e.type==='heart') drawGlyph(c,HEART,e.x-2,e.y-e.t*9,'#ff6b8b');
    else if(e.type==='z') drawGlyph(c,ZZ,e.x,e.y-e.t*6,'#e8f4ff');
    else {c.fillStyle='#fff';c.fillRect(Math.round(e.x+Math.sin(e.t*9)*3),Math.round(e.y-e.t*8),1,1);}
    c.globalAlpha=1;
  }
  drawRipples(c);
  drawMurk(c);
  drawAlgae(c);
  drawSwirl(c);
  if(night>0.02){c.fillStyle='rgba(8,18,60,'+(night*0.2).toFixed(3)+')';c.fillRect(0,0,SW,SH);}
  drawWipe(c);
  drawParts(c);
  if(scene.decorMode){
    SLOT_X.forEach((x,i)=>{
      const a=0.55+0.35*Math.sin(t*4+i);
      c.fillStyle='rgba(255,179,71,'+a.toFixed(2)+')';
      c.fillRect(x-8,SAND_Y+6,16,1);c.fillRect(x-8,SAND_Y+14,16,1);c.fillRect(x-8,SAND_Y+6,1,9);c.fillRect(x+7,SAND_Y+6,1,9);
      if(!S.decor.slots[i]){c.fillRect(x-3,SAND_Y+10,7,1);c.fillRect(x,SAND_Y+7,1,7);}
    });
  }
}
function sceneLoop(ts){
  if(!scene.running) return;
  const dt=Math.min(0.1,(ts-scene.last)/1000||0.016);
  scene.last=ts;scene.t+=dt;
  if(S){updateScene(dt);drawScene();}
  requestAnimationFrame(sceneLoop);
}
function sceneStart(){
  if(scene.running) return;
  scene.running=true;scene.last=performance.now();requestAnimationFrame(sceneLoop);
}
function sceneStop(){scene.running=false;}
function onScenePointer(e){
  const r=scene.cv.getBoundingClientRect();
  const x=(e.clientX-r.left)/r.width*SW,y=(e.clientY-r.top)/r.height*SH;
  if(scene.decorMode){
    if(y>SAND_Y-26){
      let bi=0,bd=1e9;SLOT_X.forEach((sx,i)=>{const d=Math.abs(sx-x);if(d<bd){bd=d;bi=i;}});
      openSheet('decor',bi);return;
    }
  }
  if(S.pile>=1&&x>128&&y>SAND_Y-6){doCollect();return;}
  if(y>SAND_Y+2){
    for(let j=0;j<S.polyps.length;j++){
      if(Math.abs(x-(18+j*26))<13){audioResume();sfx.tap();openSheet('polyp',S.polyps[j].id);return;}
    }
  }
  let hit=null,bd=1e9;
  for(const f of S.fish){
    const rt=scene.rt.get(f.id);if(!rt) continue;
    const s=getSprite(f,stageOf(f),f.sick);
    const dx=Math.abs(x-rt.x),dy=Math.abs(y-rt.y);
    if(dx<=s.w/2+5&&dy<=s.h/2+5){const d=dx+dy;if(d<bd){bd=d;hit=f;}}
  }
  if(hit){
    audioResume();sfx.fish();
    const rt=scene.rt.get(hit.id);
    if(rt){
      rt.shim=REDUCED?0:0.7;rt.sq=REDUCED?0:0.4;
      ripple(rt.x,rt.y,9);
      if(!REDUCED&&hit.trait==='lazy') addFx('z',rt.x,rt.y-8);
      else if(!REDUCED&&hit.trait!=='shy') addFx('heart',rt.x,rt.y-6);
    }
    openSheet('fish',hit.id);
  }else waterTap(x,y);
}
