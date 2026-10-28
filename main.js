import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CobaltModel } from './car.js';
import { CATEGORIES, CAT_BY_ID, PARTS, PART_BY_ID, SPECIFICATIONS, FACTS } from './data.js';

const $ = id => document.getElementById(id);
const root = $('canvas3d');
const categoryList = $('categoryList');
const partsList = $('partsList');
const search = $('searchInput');
const hotspots = $('hotspotLayer');
let category = 'all';
let selected = 'engine';
let renderer, scene, camera, controls, car, orbitActive = false;
let toastTimer = 0;
let activeView = 'iso';
let targetCamera = null;
let frames = 0, lastFrame = 0, fpsTick = 0;

function toast(message) {
  let el = $('toast'); el.textContent=message;el.classList.add('visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),2500);
}
function init3D(){
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setSize(root.clientWidth,root.clientHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.35;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  root.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Chevrolet Cobalt интерактивті 3D көрінісі');
  renderer.domElement.setAttribute('tabindex','0');
  scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x0a1e2d,.023);
  camera=new THREE.PerspectiveCamera(39,root.clientWidth/root.clientHeight,.08,150);
  camera.position.set(-6.25,3.45,6.4);
  controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.075;
  controls.target.set(0,1.02,0);
  controls.minDistance=1.25;controls.maxDistance=17;
  controls.maxPolarAngle=Math.PI*.89;
  controls.enablePan=true;controls.screenSpacePanning=true;
  controls.addEventListener('start',()=>{orbitActive=true;targetCamera=null;});
  controls.addEventListener('end',()=>{orbitActive=false;});
  scene.add(new THREE.HemisphereLight(0x8cdaf9,0x142334,2.5));
  const key=new THREE.DirectionalLight(0xddeffe,3.8);key.position.set(-3,8,5);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-7;key.shadow.camera.right=7;
  key.shadow.camera.top=7;key.shadow.camera.bottom=-7;key.shadow.normalBias=.035;scene.add(key);
  const blue=new THREE.PointLight(0x36b8ff,55,18);blue.position.set(2,4,-5);scene.add(blue);
  const gold=new THREE.PointLight(0xffa858,30,12);gold.position.set(-4,2.8,3);scene.add(gold);
  // Studio floor plus concentric high-tech turntable rings.
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x071522,metalness:.31,roughness:.72}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.035;ground.receiveShadow=true;scene.add(ground);
  const concentric=[2.55,2.94,3.46];concentric.forEach((r,idx)=>{
    const ring=new THREE.Mesh(new THREE.RingGeometry(r,r+.012,120),new THREE.MeshBasicMaterial({color:idx===0?0x3ec7de:0x355974,transparent:true,opacity:idx===0?.58:.20,side:THREE.DoubleSide}));
    ring.rotation.x=-Math.PI/2;ring.position.y=-.017+idx*.001;scene.add(ring);
  });
  const grid=new THREE.GridHelper(35,45,0x203c4d,0x173448);grid.position.y=-.020;
  grid.material.opacity=.17;grid.material.transparent=true;scene.add(grid);
  for(let j=0;j<48;j++){
    let angle=j*Math.PI*2/48;
    let radial=3.11+(j%4)*.065;
    const tick=new THREE.Mesh(new THREE.BoxGeometry(j%4===0?.105:.04,.004,.013),new THREE.MeshBasicMaterial({color:0x68dfff,transparent:true,opacity:j%4===0?.62:.18}));
    tick.position.set(Math.sin(angle)*radial,-.014,Math.cos(angle)*radial);
    tick.rotation.y=angle;scene.add(tick);
  }
  car=new CobaltModel(scene);
  const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
  let pointerDown={x:0,y:0};
  renderer.domElement.addEventListener('pointerdown',e=>{pointerDown={x:e.clientX,y:e.clientY};});
  renderer.domElement.addEventListener('pointerup',e=>{
    if(Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>7)return;
    const box=renderer.domElement.getBoundingClientRect();
    pointer.x=(e.clientX-box.left)/box.width*2-1;
    pointer.y=-(e.clientY-box.top)/box.height*2+1;
    raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(car.getRaycastObjects(),true);
    for(let hit of hits){const id=car.hitPart(hit);if(id&&PART_BY_ID[id]){choosePart(id,{focus:false});return;}}
  });
  window.addEventListener('resize',resize);
  resize();
  lastFrame=performance.now();requestAnimationFrame(animate);
}
function resize(){
  if(!renderer||!root.clientWidth||!root.clientHeight)return;
  camera.aspect=root.clientWidth/root.clientHeight;camera.updateProjectionMatrix();
  renderer.setSize(root.clientWidth,root.clientHeight,false);
}
function animate(now){
  requestAnimationFrame(animate);
  let dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;
  controls.update();
  if(targetCamera){
    camera.position.lerp(targetCamera.position,Math.min(1,dt*2.6));
    controls.target.lerp(targetCamera.target,Math.min(1,dt*2.6));
    if(camera.position.distanceTo(targetCamera.position)<.04&&controls.target.distanceTo(targetCamera.target)<.03)targetCamera=null;
  }
  car.update(dt,now/1000);
  renderHotspotPositions();
  renderer.render(scene,camera);
  frames++;if(now-fpsTick>=1100){$('fpsLabel').textContent=Math.round(frames*1000/(now-fpsTick))+' FPS';fpsTick=now;frames=0;}
}
function goTo(position,target,distance=null){
  const next=new THREE.Vector3(...position),look=new THREE.Vector3(...target);
  if(distance){const dir=next.clone().sub(look).normalize();next.copy(look).addScaledVector(dir,distance);}
  targetCamera={position:next,target:look};
}
const views={
  iso:{camera:[-6.25,3.45,6.4],target:[0,1.02,0]},
  front:{camera:[-6.5,1.55,0],target:[0,1.00,0]},
  side:{camera:[0,2.06,7.2],target:[0,1.00,0]},
  top:{camera:[-.05,8,.05],target:[0,1.00,0]},
  inside:{camera:[-.48,2.04,2.25],target:[-.10,1.19,.05]},
};
function setView(view){
  if(!views[view])return;
  activeView=view;
  document.querySelectorAll('.view-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  goTo(views[view].camera,views[view].target);
  if(view==='inside')setMode('xray',true);
}
function focusSelected(){
  const p=PART_BY_ID[selected];if(!p)return;
  const point=new THREE.Vector3(...p.position);
  const isInside=['interior','transmission','exhaust','suspension','brakes'].includes(p.category);
  const distance=isInside?2.5:2.9;
  const offset=new THREE.Vector3(p.position[0]<-1.2?-1.5:1.65,1.25,2.4).normalize().multiplyScalar(distance);
  goTo(point.clone().add(offset).toArray(),point.toArray());
  if(p.category==='engine'||p.category==='cooling'||p.category==='electric')setMode('hood',true);
  if(isInside)setMode('xray',true);
  toast('3D камера: '+p.name);
}
function setMode(name,value){
  car.setTarget(name,value);
  const el=$(name==='hood'?'hoodBtn':name==='doors'?'doorBtn':name==='trunk'?'trunkBtn':name==='xray'?'xrayBtn':name==='explode'?'explodeBtn':'motionBtn');
  if(el)el.classList.toggle('active',Boolean(value));
}
function toggleMode(name,label){const value=car.toggle(name);setMode(name,value);toast(label+(value?' — қосылды':' — өшірілді'));}
function resetEverything(){
  for(let x of ['hood','doors','trunk','xray','explode','engine'])setMode(x,false);
  setView('iso');toast('Бастапқы көрініс қалпына келді');
}
function choosePart(id,{focus=false,ensureCategory=false}={}){
  if(!PART_BY_ID[id])return;
  selected=id;
  const p=PART_BY_ID[id];
  if(ensureCategory && category!=='all'&&category!==p.category){category=p.category;drawCategories();drawParts();}
  car.select(id);
  drawDetails(p);
  document.querySelectorAll('.part-row').forEach(el=>el.classList.toggle('selected',el.dataset.id===id));
  if(focus)focusSelected();
  if(!focus && ['engine','cooling'].includes(p.category) && !car.targets.hood)setMode('hood',true);
  drawHotspots();
}
function drawDetails(p){
  const c=CAT_BY_ID[p.category];
  $('detailCat').textContent=c.name.toUpperCase();$('detailCat').style.color=c.color;
  $('detailTitle').textContent=p.name;
  $('detailIdentifier').textContent='ID: '+p.id.toUpperCase()+'  •  COBALT / '+p.category.toUpperCase();
  $('detailIndex').textContent=String(PARTS.indexOf(p)+1).padStart(2,'0')+' / '+PARTS.length;
  $('detailDescription').textContent=p.description;
  $('detailSigns').textContent=p.signs;
  $('detailCheck').textContent=p.check;
  $('detailSymbol').textContent=c.icon;
  $('detailSymbol').style.color=c.color;
}
function drawCategories(){
  categoryList.replaceChildren();
  for(const c of CATEGORIES){
    const n=PARTS.filter(p=>c.id==='all'||p.category===c.id).length;
    const b=document.createElement('button');b.type='button';b.className='category'+(c.id===category?' active':'');
    b.innerHTML='<span class="cat-icon" style="color:'+c.color+'">'+c.icon+'</span><span>'+c.name+'</span><span class="count">'+n+'</span>';
    b.addEventListener('click',()=>{
      category=c.id;search.value='';drawCategories();drawParts();drawHotspots();
      if(c.id==='engine'||c.id==='cooling'||c.id==='electric')setMode('hood',true);
      if(c.id==='interior')setMode('xray',true);
      toast(c.name+' — '+n+' компонент');
    });categoryList.appendChild(b);
  }
}
function visibleParts(){
  const q=search.value.trim().toLocaleLowerCase('kk');
  return PARTS.filter(p=>(category==='all'||p.category===category)&&(!q||[p.name,p.description,p.id].join(' ').toLocaleLowerCase('kk').includes(q)));
}
function drawParts(){
  const items=visibleParts();
  $('partsCount').textContent=items.length;
  $('partsTitle').textContent=category==='all'?'БАРЛЫҚ БӨЛШЕК':CAT_BY_ID[category].name.toUpperCase();
  partsList.replaceChildren();
  if(items.length===0){partsList.innerHTML='<div class="empty-list">Сұраныс бойынша бөлшек табылмады.</div>';return;}
  for(const p of items){
    const b=document.createElement('button');b.type='button';b.className='part-row'+(selected===p.id?' selected':'');b.dataset.id=p.id;
    const dot=document.createElement('span');dot.className='part-dot';
    const name=document.createElement('span');name.className='part-name';name.textContent=p.name;
    const arrow=document.createElement('span');arrow.className='part-arrow';arrow.textContent='›';
    b.append(dot,name,arrow);b.addEventListener('click',()=>choosePart(p.id,{focus:true}));
    partsList.appendChild(b);
  }
}
const HOTSPOT_MAIN=['engine','headlamp','frontdoor','wheel','taillight','trunk','radiator','dash'];
let hotspotElements=[];
function drawHotspots(){
  hotspots.replaceChildren();hotspotElements=[];
  const candidates=(category==='all'&&search.value.trim()===''?HOTSPOT_MAIN:visibleParts().map(p=>p.id));
  const ids=[...new Set([selected,...candidates])].filter(id=>PART_BY_ID[id]).slice(0,category==='all'?9:10);
  for(const id of ids){
    const part=PART_BY_ID[id];
    const el=document.createElement('button');el.type='button';el.className='hotspot'+(selected===id?' active':'');
    const icon=document.createElement('i');const name=document.createElement('span');name.textContent=part.name;
    el.append(icon,name);el.addEventListener('click',()=>choosePart(id,{focus:true,ensureCategory:true}));
    hotspots.appendChild(el);hotspotElements.push({el,point:new THREE.Vector3(...part.position)});
  }
}
function renderHotspotPositions(){
  if(!camera)return;
  const w=root.clientWidth,h=root.clientHeight;
  for(const item of hotspotElements){
    const p=item.point.clone().project(camera);
    const x=(p.x*.5+.5)*w,y=(-p.y*.5+.5)*h;
    const visible=p.z>-1 && p.z<1 && x>25 && x<w-25 && y>123 && y<h-165;
    item.el.style.display=visible?'flex':'none';
    if(visible){item.el.style.left=x+'px';item.el.style.top=y+'px';}
  }
}
function attachEvents(){
  $('hoodBtn').addEventListener('click',()=>toggleMode('hood','Капот'));
  $('doorBtn').addEventListener('click',()=>toggleMode('doors','Есіктер'));
  $('trunkBtn').addEventListener('click',()=>toggleMode('trunk','Жүксалғыш'));
  $('xrayBtn').addEventListener('click',()=>toggleMode('xray','Рентген көрінісі'));
  $('explodeBtn').addEventListener('click',()=>toggleMode('explode','Жүйелерді бөлу'));
  $('motionBtn').addEventListener('click',()=>toggleMode('engine','Демонстрациялық доңғалақ айналуы'));
  $('resetBtn').addEventListener('click',resetEverything);
  $('focusBtn').addEventListener('click',focusSelected);
  search.addEventListener('input',()=>{drawParts();drawHotspots();});
  document.querySelectorAll('.view-btn').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));
  document.querySelectorAll('.paint-swatch').forEach(btn=>btn.addEventListener('click',()=>{
    car.setPaint(btn.dataset.color);
    document.querySelectorAll('.paint-swatch').forEach(b=>b.classList.toggle('selected',b===btn));
    toast('Кузов түсі өзгертілді');
  }));
  const help=$('helpDialog');
  const closeHelp=()=>help.classList.add('hidden');
  $('shortcutBtn').addEventListener('click',()=>help.classList.remove('hidden'));
  $('helpClose').addEventListener('click',closeHelp);
  help.addEventListener('click',e=>{if(e.target===help)closeHelp();});
  window.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeHelp();search.blur();return;}
    if(document.activeElement?.matches('input,textarea,[contenteditable]'))return;
    const k=e.key.toLowerCase();
    if(k==='/'){e.preventDefault();search.focus();return;}
    if(k==='h')toggleMode('hood','Капот');
    if(k==='d')toggleMode('doors','Есіктер');
    if(k==='t')toggleMode('trunk','Жүксалғыш');
    if(k==='x')toggleMode('xray','Рентген көрінісі');
    if(k==='e')toggleMode('explode','Бөлшектеу');
    if(k==='r')resetEverything();
  });
}
function start(){
  $('specGrid').innerHTML=SPECIFICATIONS.map(([label,val])=>'<div class="spec-cell"><span>'+label+'</span><b>'+val+'</b></div>').join('');
  drawCategories();drawParts();
  try{
    init3D();
    choosePart('engine');
    drawHotspots();
    attachEvents();
    setTimeout(()=>$('loading').classList.add('done'),650);
    toast('COBALT 3D LAB — дайын. Бөлшекті таңдаңыз!');
  }catch(error){
    console.error('3D initialization error',error);
    $('loading').innerHTML='<div class="loading-core" style="max-width:350px;text-align:center"><h2>3D көрінісі ашылмады</h2><p>Браузерде WebGL қосылғанын және интернет қосылымын тексеріңіз. VS Code Live Server арқылы ашыңыз.</p><pre style="white-space:pre-wrap;font-size:11px;color:#e8a5a5">'+String(error.message).replace(/</g,'&lt;')+'</pre></div>';
  }
}
start();
