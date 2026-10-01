'use strict';
/* ================= helpers ================= */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const rnd=(a,b)=>a+Math.random()*(b-a);
const ri=(a,b)=>Math.floor(rnd(a,b+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
function fmtDur(m){
  m=Math.max(0,Math.round(m));
  if(m<1) return '<1m';
  const h=Math.floor(m/60), mm=m%60;
  if(h>=24){const d=Math.floor(h/24);return d+'d '+(h%24)+'h';}
  return h?(h+'h'+(mm?' '+mm+'m':'')):(mm+'m');
}
function hexRgb(h){const n=parseInt(h.slice(1),16);return [n>>16&255,n>>8&255,n&255];}
function rgbHex(r){return '#'+r.map(v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join('');}
function mixHex(a,b,t){const A=hexRgb(a),B=hexRgb(b);return rgbHex(A.map((v,i)=>v+(B[i]-v)*t));}
const lighten=(h,t)=>mixHex(h,'#ffffff',t);
const darken=(h,t)=>mixHex(h,'#0b1030',t);
function hash2(x,y){let h=(Math.imul(x,374761393)+Math.imul(y,668265263))|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0);}

/* ================= pixel icons ================= */
const ICONS={
  fish:["..####.....",".#######.#.","##.#####..##",".#######.#.","..####....."],
  tank:["#########","#.......#","#.#...#.#","#.##.##.#","#.......#","#########"],
  heart:[".##.##.","#######","#######",".#####.","..###..","...#..."],
  bag:["...##...","..#..#..",".######.","########","########","########",".######."],
  book:[".######.","#.#....#","#.#.##.#","#.#....#","#.#.##.#","#.######",".#######"],
  coin:["..###..",".#...#.","#..#..#","#..#..#",".#...#.","..###.."],
  food:["..#...#.","........",".#...#..","...#....","#...#..#","..#....."],
  drop:["...#...","...#...","..###..",".#####.","#######","#######",".#####.","..###.."],
  scrub:["....###","...####","..####.",".####..","####...","###...."],
  filter:[".#####.","#..#..#","#.###.#","#..#..#",".#####."],
  pill:["..###..","..###..","#######","#######","#######","..###..","..###.."],
  gear:["..#.#..",".#####.","##...##",".#...#.","##...##",".#####.","..#.#.."],
  plus:["..#..","..#..","#####","..#..","..#.."],
  sound:["....#.....","...##..#..","####.#..#.","####.#..#.","####.#..#.","...##..#..","....#....."],
  mute:["....#.....","...##.#..#","####..#.#.","####...#..","####..#.#.","...##.#..#","....#....."],
  egg:["..###..",".#####.","#######","#######","#######",".#####.","..###.."]
};
function ic(n,s=2){
  const rows=ICONS[n]; const w=Math.max(...rows.map(r=>r.length)); let rects='';
  rows.forEach((r,y)=>{for(let x=0;x<r.length;x++) if(r[x]==='#') rects+=`<rect x="${x}" y="${y}" width="1" height="1"/>`;});
  return `<svg class="ic" viewBox="0 0 ${w} ${rows.length}" width="${w*s}" height="${rows.length*s}" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

/* ================= genetics data ================= */
const COLORS=[
  {n:'Coral',c:'#ff7a45',d:6},{n:'Ruby',c:'#e0304f',d:5},{n:'Sun',c:'#ffd23f',d:7},{n:'Lime',c:'#8bd346',d:4},
  {n:'Teal',c:'#27b5a5',d:8},{n:'Azure',c:'#3b8fe8',d:9},{n:'Violet',c:'#8a63d2',d:3},{n:'Bubblegum',c:'#ff8fc0',d:2},
  {n:'Silver',c:'#cdd6e2',d:1.5,r:1},{n:'Midnight',c:'#2f3a8c',d:1.3,r:1},{n:'Gold',c:'#d9a21b',d:1.2,r:1},{n:'Ghost',c:'#f2f2ea',d:1,r:1}
];
const LOCI={
  color:{label:'Body',opts:COLORS,common:8},
  accent:{label:'Accent',opts:COLORS,common:8},
  pattern:{label:'Pattern',opts:[{n:'Plain',d:8},{n:'Stripe',d:7},{n:'Spots',d:6},{n:'Bands',d:5},{n:'Belly',d:4},{n:'Mask',d:3},{n:'Speckle',d:2},{n:'Tiger',d:1,r:1}],common:7},
  tail:{label:'Tail',opts:[{n:'Fork',d:5},{n:'Round',d:4},{n:'Fan',d:3},{n:'Veil',d:2},{n:'Ribbon',d:1,r:1}],common:4},
  fin:{label:'Fin',opts:[{n:'Flat',d:4},{n:'Short',d:3},{n:'Tall',d:2},{n:'Crown',d:1,r:1}],common:3},
  size:{label:'Size',opts:[{n:'Small'},{n:'Medium'},{n:'Large'}],common:3},
  sheen:{label:'Sheen',opts:[{n:'None',d:3},{n:'Glow',d:1,r:1},{n:'Pearl',d:2,r:1}],common:1}
};
const LOCUS_KEYS=Object.keys(LOCI);
const SIZE_NAMES=['Tiny','Small','Medium','Large','Huge'];

function expr(key,pair){
  const a=pair[0],b=pair[1];
  if(a===b) return a;
  const o=LOCI[key].opts;
  return (o[a].d||0)>=(o[b].d||0)?a:b;
}
function phenotype(f){
  const g=f.g;
  return {
    color:expr('color',g.color),accent:expr('accent',g.accent),pattern:expr('pattern',g.pattern),
    tail:expr('tail',g.tail),fin:expr('fin',g.fin),
    size:(g.size[0]+g.size[1])/2,
    sheen:(g.sheen[0]===g.sheen[1]&&g.sheen[0]>0)?g.sheen[0]:0
  };
}
function traitText(ph,kind){
  kind=kind||'fish';
  const p=LD(kind,'pattern').opts[ph.pattern].n;
  const bits=[COLORS[ph.color].n+(ph.pattern?' '+p:'')];
  if(kind!=='shrimp') bits.push(LD(kind,'tail').opts[ph.tail].n+(kind==='jelly'?'':' tail'));
  if(ph.fin) bits.push(LD(kind,'fin').opts[ph.fin].n+(kind==='jelly'?' frills':' fin'));
  if(ph.sheen) bits.push(LD(kind,'sheen').opts[ph.sheen].n);
  return bits.join(' · ');
}
function morphKey(f){const ph=phenotype(f);return [f.sp,ph.color,ph.accent,ph.pattern,ph.tail,ph.fin,ph.sheen].join('.')+(f.hyb?'+'+f.hyb:'');}
function rarity(ph){
  let r=0;
  if(COLORS[ph.color].r) r+=1.6;
  if(COLORS[ph.accent].r) r+=0.7;
  r+=[0,0.1,0.15,0.2,0.2,0.25,0.3,1.2][ph.pattern];
  r+=[0,0.1,0.25,0.5,1.3][ph.tail];
  r+=[0,0.1,0.3,1.2][ph.fin];
  r+=[0,2.5,3][ph.sheen];
  if(ph.size===2) r+=0.5; else if(ph.size===0) r+=0.3;
  return r;
}

/* ================= species ================= */
const SPECIES=[
  {id:'tetra',kind:'fish',n:'Pebble Tetra',shape:'slim',len:12,hei:5,price:25,lo:23,hi:27,spd:1.2,dep:.45,hun:1,w:1,tailMul:1,finMul:1,blurb:'Tiny, tireless schooler.'},
  {id:'guppy',kind:'fish',n:'Dapple Guppy',shape:'oval',len:11,hei:6,price:30,lo:22,hi:27,spd:1,dep:.3,hun:1,w:1,tailMul:1.45,finMul:1,blurb:'Flashy tail, flashier attitude.'},
  {id:'danio',kind:'fish',n:'Comet Danio',shape:'slim',len:15,hei:5,price:40,lo:18,hi:25,spd:1.5,dep:.25,hun:1,w:1,tailMul:1.2,finMul:1,blurb:'Zooms around like it is late.'},
  {id:'goldie',kind:'fish',n:'Bubble Goldie',shape:'round',len:14,hei:10,price:55,lo:18,hi:24,spd:.7,dep:.5,hun:1.25,w:1,tailMul:1.1,finMul:1,blurb:'Always asks for seconds.'},
  {id:'loach',kind:'fish',n:'Whisker Loach',shape:'long',len:20,hei:4,price:70,lo:22,hi:27,spd:.9,dep:.86,hun:1,w:1,tailMul:.8,finMul:.8,blurb:'The noodle of the tank floor.'},
  {id:'betta',kind:'fish',n:'Fan Betta',shape:'oval',len:15,hei:8,price:80,lo:24,hi:28,spd:.6,dep:.35,hun:.9,w:1,tailMul:1.5,finMul:1.5,blurb:'Dramatic. Fins for days.'},
  {id:'angel',kind:'fish',n:'Moon Angel',shape:'tall',len:14,hei:15,price:110,lo:24,hi:28,spd:.5,dep:.5,hun:1,w:1,tailMul:1,finMul:1.6,blurb:'Glides like it owns the place.'},
  {id:'pleco',kind:'fish',n:'Sucker Pleco',shape:'bottom',len:17,hei:8,price:120,lo:23,hi:28,spd:.35,dep:.92,hun:.8,w:1,tailMul:.9,finMul:1.2,algae:1.2,blurb:'Scrapes algae off the glass.'},
  {id:'puffer',kind:'fish',n:'Puff Pufferling',shape:'round',len:12,hei:11,price:150,lo:24,hi:28,spd:.6,dep:.55,hun:1.1,w:1,tailMul:.8,finMul:.7,blurb:'Round and very proud of it.'},
  {id:'discus',kind:'fish',n:'Halo Discus',shape:'disc',len:17,hei:17,price:220,lo:26,hi:30,spd:.4,dep:.5,hun:1.1,w:1,tailMul:.8,finMul:1,blurb:'Serene, with expensive taste.'},
  {id:'cherry',kind:'shrimp',n:'Cherry Shrimp',shape:'shrimp',len:10,hei:5,price:35,lo:18,hi:28,spd:.5,dep:1,hun:.7,w:.5,algae:.5,blurb:'Tiny, bright, and always snacking.'},
  {id:'ghost',kind:'shrimp',n:'Ghost Shrimp',shape:'shrimp',len:12,hei:5,price:45,lo:18,hi:28,spd:.55,dep:1,hun:.7,w:.5,algae:.6,ghost:1,blurb:'See-through, so you can watch it eat.'},
  {id:'amano',kind:'shrimp',n:'Amano Shrimp',shape:'shrimp',len:15,hei:6,price:75,lo:20,hi:27,spd:.5,dep:1,hun:.8,w:.6,algae:1.1,blurb:'The hardest-working algae cleaner.'},
  {id:'moon',kind:'jelly',jshape:'saucer',n:'Moon Jelly',len:15,hei:7,price:160,lo:18,hi:25,cold:20,spd:.35,dep:.4,hun:.6,w:1,sens:1,pulse:.8,quirk:'Four glowing rings',blurb:'A flat saucer with four glowing rings.'},
  {id:'nettle',kind:'jelly',jshape:'nettle',n:'Sea Nettle',len:12,hei:10,price:240,lo:20,hi:26,cold:21,spd:.4,dep:.35,hun:.7,w:1,sens:1,pulse:1,quirk:'Long trailing streamers',blurb:'Ruffled arms and long streamers behind it.'},
  {id:'mat',kind:'jelly',jshape:'rosette',n:'Upside-down Jelly',len:16,hei:6,price:200,lo:25,hi:30,cold:24,spd:.15,dep:1,hun:.3,w:1,sens:1,floor:1,algae:.4,pulse:.6,quirk:'Sunbathes on the sand, eats little, nibbles algae',blurb:'Naps upside down on the sand like a flower.'},
  {id:'comb',kind:'jelly',jshape:'comb',n:'Comb Jelly',len:9,hei:12,price:180,lo:16,hi:26,spd:.45,dep:.5,hun:.6,w:1,sens:1,direct:1,glide:1,pulse:1.5,quirk:'Rainbow comb rows. No polyps, lays eggs instead',blurb:'Not a true jelly. Its rows flash every color.'},
  {id:'immortal',kind:'jelly',jshape:'tiny',n:'Immortal Jelly',len:7,hei:7,price:320,lo:20,hi:28,cold:22,spd:.3,dep:.3,hun:.5,w:.6,sens:1,immortal:1,pulse:1.3,quirk:'Turns back into a polyp instead of getting sick',blurb:'Tiny, with a bright red middle. Starts over, never gives up.'},
  {id:'box',kind:'jelly',jshape:'box',n:'Box Jelly',len:9,hei:10,price:280,lo:24,hi:29,cold:23,spd:.7,dep:.45,hun:.7,w:1,sens:1,pulse:2,quirk:'Fast. Other swimmers keep away',blurb:'A cube with eyes. Speedy and a bit scary.'}
];
const SP=Object.fromEntries(SPECIES.map(s=>[s.id,s]));
/* ================= creature kinds ================= */
const KIND_NAMES={fish:'Fish',shrimp:'Shrimp',jelly:'Jellyfish'};
const STAGE_NAMES={fish:['Fry','Juvenile','Adult'],shrimp:['Shrimplet','Juvenile','Adult'],jelly:['Ephyra','Juvenile','Adult']};
const KIND_LOCI={fish:['color','accent','pattern','tail','fin','size','sheen'],shrimp:['color','accent','pattern','size','sheen'],jelly:['color','accent','pattern','tail','fin','size','sheen']};
const LABEL_OVERRIDE={
  shrimp:{accent:'Markings',names:{pattern:['Plain','Stripe','Spots','Saddle','Belly','Cap','Speckle','Tiger']}},
  jelly:{color:'Bell',accent:'Tendrils',pattern:'Bell mark',tail:'Tentacles',fin:'Frills',names:{pattern:['Plain','Ribs','Spots','Rings','Core','Cap','Speckle','Swirl'],tail:['Short','Long','Frilly','Curly','Ribbon'],fin:['None','Soft','Lacy','Crown'],sheen:['None','Glow','Shimmer']}}
};
function LD(kind,key){
  const base=LOCI[key],ov=LABEL_OVERRIDE[kind],names=ov&&ov.names&&ov.names[key];
  return {label:(ov&&ov[key])||base.label,opts:names?base.opts.map((o,i)=>Object.assign({},o,{n:names[i]})):base.opts};
}
const kindOf=f=>SP[f.sp].kind||'fish';
const lociOf=kind=>KIND_LOCI[kind]||KIND_LOCI.fish;
const TRAITS=[
  {id:'shy',n:'Shy',d:'Hides near plants and the sand.'},
  {id:'bold',n:'Bold',d:'Explores the whole tank.'},
  {id:'greedy',n:'Greedy',d:'First to every meal.'},
  {id:'lazy',n:'Lazy',d:'Takes long naps.'},
  {id:'social',n:'Social',d:'Sticks close to its friends.'},
  {id:'playful',n:'Playful',d:'Chases tank mates and zigzags.'}
];
const TRAIT=Object.fromEntries(TRAITS.map(t=>[t.id,t]));

/* ================= species helpers ================= */
const shortName=id=>{const n=SP[id].n.split(' ');return SP[id].kind==='fish'?n[n.length-1]:n[0];};
const hybLabel=o=>shortName(o.sp)+' × '+shortName(o.hyb);
const speciesLabel=o=>o.hyb?hybLabel(o)+' hybrid':SP[o.sp].n;
const rangeOf=o=>{const a=SP[o.sp],b=o.hyb&&SP[o.hyb];return b?{lo:Math.min(a.lo,b.lo),hi:Math.max(a.hi,b.hi)}:{lo:a.lo,hi:a.hi};};
const baseValue=o=>o.hyb?Math.round((SP[o.sp].price+SP[o.hyb].price)/2*1.5):SP[o.sp].price;
const viaPolyp=id=>SP[id].kind==='jelly'&&!SP[id].direct;
const coldOf=o=>{const cs=[SP[o.sp].cold,o.hyb&&SP[o.hyb].cold].filter(v=>typeof v==='number');return cs.length?Math.round(cs.reduce((a,b)=>a+b,0)/cs.length):22;};
const hybKey=(a,b)=>[a,b].sort().join(':');

const NAMES=['Bubbles','Pip','Mochi','Nori','Kelp','Sushi','Dot','Finn','Ziggy','Pebble','Tango','Miso','Waffles','Sunny','Juno','Olive','Biscuit','Comet','Nibbles','Pixel','Coral','Wiggles','Saffron','Puddle','Tofu','Zephyr','Mango','Ripple','Gizmo','Ember','Clover','Shrimp','Orbit','Bean','Sprout','Fizz','Marlo','Dory','Pearl','Gill','Skipper','Tiny','Captain','Luna','Kiwi','Muffin','Squid','Rowan'];

/* ================= shop data ================= */
const STAGES=['Fry','Juvenile','Adult'];
const STAGE_AGE=[45,180];
const EGG_MIN=30, COOLDOWN_MIN=120, MUT=0.02, OFFLINE_CAP_MIN=72*60, NURSERY_MAX=2;
const TANKS=[
  {n:'Nano tank',l:'20 L',cap:4,price:0,dil:1},
  {n:'Standard tank',l:'60 L',cap:7,price:180,dil:.9},
  {n:'Large tank',l:'120 L',cap:10,price:450,dil:.8},
  {n:'Show tank',l:'240 L',cap:14,price:1100,dil:.7}
];
const FILTERS=[
  {n:'Sponge filter',eff:1,life:30,price:0},
  {n:'Hang-on filter',eff:1.15,life:48,price:150},
  {n:'Canister filter',eff:1.3,life:72,price:400}
];
const THEMES=[
  {id:'open',n:'Open water',price:0,top:'#3a8fbf',bot:'#14466b',sand:'#dcb97e',sand2:'#b98f55',sil:'#1f5f8a',kind:'rocks'},
  {id:'kelp',n:'Kelp forest',price:60,top:'#2f9a8c',bot:'#0f4a4f',sand:'#c8b07a',sand2:'#9c8350',sil:'#1d6b58',kind:'kelp'},
  {id:'sunset',n:'Sunset reef',price:90,top:'#d9826b',bot:'#463a7e',sand:'#e2c08a',sand2:'#b98f6a',sil:'#5a3f7e',kind:'reef'},
  {id:'deep',n:'Deep blue',price:90,top:'#2256a5',bot:'#0a1f4a',sand:'#8d9bb0',sand2:'#687690',sil:'#14337a',kind:'rocks'},
  {id:'mint',n:'Mint lagoon',price:120,top:'#6fd1b7',bot:'#1d7b82',sand:'#f0dcae',sand2:'#cbb27a',sil:'#2d9a90',kind:'reef'}
];
const DECOR_DEF=[
  {id:'kelp',n:'Kelp strands',price:20,plant:1},
  {id:'fern',n:'Green fern',price:25,plant:1},
  {id:'redweed',n:'Red weed',price:30,plant:1},
  {id:'pebbles',n:'Pebble pile',price:8},
  {id:'shell',n:'Big shell',price:15},
  {id:'rock',n:'Mossy rock',price:30},
  {id:'wood',n:'Driftwood',price:45},
  {id:'chest',n:'Treasure chest',price:90},
  {id:'bubbler',n:'Air stone',price:70},
  {id:'castle',n:'Sandcastle',price:120},
  {id:'arch',n:'Ruin arch',price:150}
];
const DECOR=Object.fromEntries(DECOR_DEF.map(d=>[d.id,d]));
const SLOT_X=[18,49,80,111,142];
