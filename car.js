import * as THREE from 'three';
import { PARTS } from './data.js';

// Physically plausible, hand-built instructional mesh of a Cobalt-like sedan.
// Not a Chevrolet factory CAD asset. Axes: front is -X, left-hand visible side is +Z.
export class CobaltModel {
  constructor(scene) {
    this.root = new THREE.Group(); scene.add(this.root);
    this.mats = {
      paint: this.mat(0xe8f0ff,.43,.55), edge:this.mat(0xa8bacf,.30,.78),
      chrome:this.mat(0xd6e8f7,.15,.87), darkChrome:this.mat(0x606f86,.31,.62),
      rubber:this.mat(0x0b1019,.93,.02), tread:this.mat(0x1d2530,.91,.01),
      inner:this.mat(0x141f2b,.83,.04), glass:this.mat(0x7fc5dc,.20,.16,.35),
      glassDark:this.mat(0x15374c,.25,.18,.61), lamp:this.mat(0xe1f6ff,.15,.15,.9),
      red:this.mat(0xec4665,.20,.22,.89), amber:this.mat(0xffb75f,.21,.11,.86),
      seat:this.mat(0x20283c,.91,.03), seatTrim:this.mat(0x475266,.83,.08),
      motor:this.mat(0x7d8c9c,.63,.53), motorDark:this.mat(0x222d3c,.81,.20),
      plastic:this.mat(0x111b28,.78,.08), copper:this.mat(0xf6ac5f,.36,.56),
      coolant:this.mat(0x60cfe9,.37,.14,.59), gold:this.mat(0xe9ad38,.23,.76),
      under:this.mat(0x172130,.89,.13), silver:this.mat(0x9db2ca,.38,.68),
    };
    this.shellMaterials = [this.mats.paint,this.mats.edge,this.mats.glass,this.mats.glassDark];
    this.owned = new Map();
    this.groups = {};
    this.wheels = [];
    this.animated = { hood:0, trunk:0, doors:0,explode:0,xray:0,engine:0 };
    this.targets = { hood:0, trunk:0, doors:0,explode:0,xray:0,engine:0 };
    this.selection = null;
    this.selectionBox = null;
    this.halo = null;
    this.explosive = [
      ['engine',[-.35,.48,-.55]],['cooling',[-.95,.05,0]],['transmission',[.30,-.22,0]],
      ['brakes',[0,-.18,.45]],['suspension',[0,-.4,0]],['electric',[-.30,.6,.7]],
      ['interior',[0,.65,0]],['exhaust',[.2,-.43,-.25]],
    ];
    this.build();
  }
  mat(color,roughness=.5,metalness=.1,opacity=1) {
    return new THREE.MeshStandardMaterial({color,roughness,metalness,transparent:opacity<1,opacity,side:THREE.DoubleSide});
  }
  group(key,parent=this.root) { const g = new THREE.Group(); g.name = key; parent.add(g); if(parent === this.root) this.groups[key]=g; return g; }
  place(parent,geo,material,x=0,y=0,z=0,id=null) {
    const m = new THREE.Mesh(geo,material); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); if(id) this.tag(m,id); return m;
  }
  tag(object,id) { object.userData.partId=id; if(!this.owned.has(id))this.owned.set(id,[]); this.owned.get(id).push(object); return object; }
  box(parent,w,h,d,mat,x,y,z,id=null) {return this.place(parent,new THREE.BoxGeometry(w,h,d),mat,x,y,z,id);}
  sphere(parent,r,mat,x,y,z,id=null,sx=1,sy=1,sz=1) {let o=this.place(parent,new THREE.SphereGeometry(r,16,12),mat,x,y,z,id);o.scale.set(sx,sy,sz);return o;}
  cylinder(parent,r1,r2,h,mat,x,y,z,id=null,axis='y',seg=24){
    let o=this.place(parent,new THREE.CylinderGeometry(r1,r2,h,seg),mat,x,y,z,id);
    if(axis==='x')o.rotation.z=Math.PI/2; if(axis==='z')o.rotation.x=Math.PI/2;
    return o;
  }
  pipe(parent,pts,r,mat,id=null) {
    const curve=new THREE.CatmullRomCurve3(pts.map(q=>new THREE.Vector3(...q)));
    return this.place(parent,new THREE.TubeGeometry(curve,Math.max(12,pts.length*8),r,7,false),mat,0,0,0,id);
  }
  quad(parent,verts,mat,id=null) {
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts.flat(),3));
    g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return this.place(parent,g,mat,0,0,0,id);
  }
  line(parent,pts,color=0x7e9ab2,opacity=.65) {
    const g=new THREE.BufferGeometry().setFromPoints(pts.map(v=>new THREE.Vector3(...v)));
    const l=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true,opacity})); parent.add(l);return l;
  }
  build() {
    this.buildUndercarriage();
    this.buildExterior();
    this.buildWheels();
    this.buildPowertrain();
    this.buildCooling();
    this.buildElectrical();
    this.buildTransmission();
    this.buildBrakesAndSuspension();
    this.buildInterior();
    this.buildFuelAndExhaust();
    this.buildSelectionHalo();
    this.buildGroundGlow();
  }
  buildUndercarriage() {
    const u=this.group('structure');
    this.box(u,3.84,.21,1.43,this.mats.under,.08,.60,0,'bodyframe');
    this.box(u,3.55,.10,1.19,this.mats.darkChrome,.05,.55,0);
    for(let z of [-.57,.57]){
      this.box(u,3.38,.14,.11,this.mats.silver,.07,.56,z);
      this.box(u,3.0,.07,.09,this.mats.darkChrome,.12,.64,z);
    }
  }
  makeSideContour(side) {
    const s=new THREE.Shape();
    s.moveTo(-2.21,.38);
    const arch=(center)=>{ let r=.51; for(let i=0;i<=28;i++){
      let xx=center-r+2*r*i/28, yy=.41+Math.sqrt(Math.max(0,r*r-(xx-center)**2));s.lineTo(xx,yy);
    }};
    s.lineTo(-1.91,.38); arch(-1.40);s.lineTo(.86,.38);arch(1.39);s.lineTo(2.20,.38);
    s.lineTo(2.24,.91);s.lineTo(1.68,1.24);s.lineTo(-1.66,1.24);s.lineTo(-2.24,.95);s.closePath();
    const mesh=this.place(this.groups.body,new THREE.ExtrudeGeometry(s,{depth:.038,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.013,bevelThickness:.009,curveSegments:6}),this.mats.paint,0,0,side>0?.81:-.849,'bodyframe');
    return mesh;
  }
  buildExterior() {
    const b=this.group('body');
    // Main bonnet, front and rear volumes, with exposed center compartment for opening hood.
    // The center and rear shell is solid; the engine bay at the front stays OPEN.
    // This matters: opening the hood must reveal real geometry, not an opaque painted slab.
    this.box(b,2.82,.31,1.48,this.mats.paint,.65,1.05,0,'bodyframe');
    this.box(b,2.84,.13,1.55,this.mats.paint,.58,1.21,0);
    this.box(b,1.05,.34,1.50,this.mats.paint,1.68,1.04,0);
    this.box(b,1.15,.22,1.50,this.mats.paint,-1.65,1.04,0);
    this.makeSideContour(1);this.makeSideContour(-1);
    // Belt line, door seams, sill and handles.
    for(const side of [-1,1]){
      const z=side*.866;
      this.line(b,[[-1.96,1.234,z],[2.06,1.234,z]],0xd9e6f0,.65);
      this.box(b,2.55,.052,.055,this.mats.edge,.13,.46,side*.843);
      for(let x of [-1.06,.22,1.39])this.line(b,[[x,.90,z+.008*side],[x,1.28,z+.008*side]],0x8493a6,.56);
      for(let x of [-.54,.83]) {
        this.box(b,.18,.031,.028,this.mats.chrome,x,1.14,z+side*.017,x<0?'frontdoor':'reardoor');
        this.box(b,.09,.023,.036,this.mats.darkChrome,x+.027,1.135,z+side*.024);
      }
    }
    // Hood with rear hinges: rotation opens front edge upward.
    this.hoodPivot = this.group('hoodPivot',b); this.hoodPivot.position.set(-1.10,1.31,0);
    const hood=this.box(this.hoodPivot,1.18,.054,1.56,this.mats.paint,-.59,.018,0,'hood');
    hood.geometry.translate(0,0,0);
    this.line(this.hoodPivot,[[-1.17,.057,-.70],[-.10,.055,-.72]],0xe3efff,.85);
    this.line(this.hoodPivot,[[-1.17,.057,.70],[-.10,.055,.72]],0xe3efff,.85);
    // Large bonnet latch / panel treatment.
    // Dark inner fender liners, open center, and a thin firewall behind the engine.
    for(const side of [-1,1])this.box(b,1.10,.065,.085,this.mats.inner,-1.65,1.19,side*.64);
    this.box(b,.06,.35,1.22,this.mats.motorDark,-1.06,1.06,0);
    // Trunk lid hinges near rear windscreen.
    this.trunkPivot=this.group('trunkPivot',b); this.trunkPivot.position.set(1.56,1.29,0);
    this.box(this.trunkPivot,.66,.052,1.47,this.mats.paint,.35,.025,0,'trunk');
    this.box(this.trunkPivot,.06,.12,1.37,this.mats.edge,.68,-.07,0);
    this.box(b,.65,.13,1.3,this.mats.inner,1.88,1.19,0);
    // Cabin silhouette — glass, roof, roof lip and frame.
    const roof=this.group('roof',b);
    this.quad(roof,[[-.55,1.80,-.66],[.97,1.81,-.66],[.97,1.81,.66],[-.55,1.80,.66]],this.mats.paint,'bodyframe');
    this.box(roof,1.60,.071,1.39,this.mats.paint,.20,1.822,0);
    this.quad(roof,[[-1.15,1.31,-.73],[-.55,1.79,-.66],[-.55,1.79,.66],[-1.15,1.31,.73]],this.mats.glassDark,'windshield');
    this.quad(roof,[[.97,1.79,-.66],[1.49,1.31,-.72],[1.49,1.31,.72],[.97,1.79,.66]],this.mats.glassDark);
    for(let side of [-1,1]){
      let z=side*.745;
      const gl1=[[-1.09,1.34,z],[-.51,1.756,z],[.13,1.76,z],[.13,1.34,z]];
      const gl2=[[.24,1.34,z],[.24,1.76,z],[.93,1.76,z],[1.43,1.34,z]];
      this.quad(roof,gl1,this.mats.glassDark,'frontdoor');
      this.quad(roof,gl2,this.mats.glassDark,'reardoor');
      const frame=[[-1.10,1.31,z+.006*side],[-.53,1.80,z+.006*side],[.97,1.80,z+.006*side],[1.47,1.30,z+.006*side]];
      this.line(roof,frame,0xc4d7e8,.95);
      this.line(roof,[[.18,1.31,z+.009*side],[.18,1.78,z+.009*side]],0xc4d7e8,.9);
      this.line(roof,[[-1.08,1.32,z+.009*side],[1.42,1.32,z+.009*side]],0xd2e9fb,.95);
      // Small mirrors, complete with black holder.
      this.box(b,.21,.14,.21,this.mats.paint,-1.03,1.36,side*.89,'mirror');
      this.box(b,.09,.10,.035,this.mats.glass,-1.04,1.38,side*1.005,'mirror');
    }
    // Windshield wiper arms.
    for(let z of [-.37,.37]){
      this.pipe(b,[[-1.20,1.36,z],[-1.04,1.375,z-.12],[-.96,1.41,z-.22]],.013,this.mats.rubber,'wipers');
    }
    // A separate door skin glides outward from visible side when requested.
    this.doorPivots=[];
    for(let side of [-1,1]){
      const dg=this.group('door'+side,b); dg.position.set(-1.09,1.13,side*.886);
      this.box(dg,1.14,.33,.026,this.mats.paint,.57,-.08,0,'frontdoor');
      this.quad(dg,[[.05,.24,0],[.61,.65,0],[1.12,.65,0],[1.12,.23,0]],this.mats.glassDark,'frontdoor');
      this.box(dg,.18,.03,.04,this.mats.chrome,.58,.01,side*.014,'frontdoor');
      this.line(dg,[[.01,.20,.009],[.59,.68,.009],[1.14,.68,.009]],0xd5e3f1,.85);
      this.doorPivots.push({pivot:dg,side});
    }
    // Front and rear fascia.
    this.box(b,.13,.50,1.56,this.mats.paint,-2.20,.83,0,'bumper');
    this.box(b,.09,.43,1.55,this.mats.paint,2.19,.85,0);
    this.box(b,.075,.28,.99,this.mats.inner,-2.283,1.02,0,'grille');
    this.box(b,.078,.040,1.02,this.mats.chrome,-2.319,1.175,0,'grille');
    this.box(b,.08,.038,.98,this.mats.chrome,-2.315,.88,0,'grille');
    for(let j=0;j<5;j++)this.box(b,.085,.014,.96,this.mats.rubber,-2.328,.923+j*.045,0,'grille');
    // An abstract gold bowtie shape.
    this.box(b,.047,.066,.25,this.mats.gold,-2.369,1.109,0);
    this.box(b,.043,.112,.10,this.mats.gold,-2.374,1.109,0);
    this.box(b,.042,.080,.27,this.mats.chrome,2.256,1.15,0);
    this.box(b,.05,.058,.19,this.mats.gold,2.294,1.15,0);
    this.box(b,.05,.100,.08,this.mats.gold,2.300,1.15,0);
    for(let side of [-1,1]) {
      const z=side*.62;
      this.box(b,.097,.18,.31,this.mats.lamp,-2.266,1.10,z,'headlamp');
      this.box(b,.108,.035,.18,this.mats.chrome,-2.311,1.17,z,'headlamp');
      this.box(b,.111,.075,.12,this.mats.amber,-2.310,1.02,side*.72,'headlamp');
      this.cylinder(b,.080,.080,.036,this.mats.lamp,-2.279,.70,side*.66,'foglamp','x',22);
      this.box(b,.097,.28,.19,this.mats.red,2.255,1.035,side*.68,'taillight');
      this.box(b,.100,.059,.19,this.mats.lamp,2.316,1.06,side*.68,'taillight');
      this.box(b,.091,.045,.19,this.mats.amber,2.315,1.15,side*.68,'taillight');
    }
    this.box(b,.042,.13,.48,this.mats.plastic,-2.300,.62,0,'bumper');
    this.box(b,.040,.11,.47,this.mats.plastic,2.263,.65,0);
    // Antenna and rear windshield defroster hints.
    this.cylinder(b,.017,.023,.29,this.mats.rubber,.92,1.98,0,null,'y',10).rotation.z=.25;
    for(let y=1.42;y<=1.67;y+=.047)this.line(b,[[1.20,y,-.50],[1.20,y,.50]],0xc7e4ef,.19);
  }
  buildWheels() {
    const suspension=this.group('wheelAssembly');
    for(let x of [-1.40,1.39])for(let side of [-1,1]){
      const z=side*.795;
      const g=this.group('wheel',suspension);g.position.set(x,.47,z);this.wheels.push(g);
      this.place(g,new THREE.TorusGeometry(.34,.116,14,42),this.mats.rubber,0,0,0,'wheel');
      this.cylinder(g,.266,.266,.088,this.mats.silver,0,0,side*.092,'wheel','z',36);
      this.cylinder(g,.220,.220,.095,this.mats.darkChrome,0,0,side*.143,'wheel','z',36);
      for(let i=0;i<10;i++){
        const angle=i*Math.PI*2/10;
        let spoke=this.box(g,.035,.17,.022,this.mats.chrome,Math.sin(angle)*.115,Math.cos(angle)*.115,side*.199,'wheel');
        spoke.rotation.z=-angle;
      }
      this.cylinder(g,.062,.062,.027,this.mats.chrome,0,0,side*.217,'wheel','z');
      for(let n=0;n<38;n++){
        const a=2*Math.PI*n/38;
        const c=this.box(g,.029,.028,.060,this.mats.tread,.425*Math.cos(a),.425*Math.sin(a),0,'wheel');
        c.rotation.z=a;
      }
    }
  }
  buildPowertrain() {
    const e=this.group('engine');
    this.box(e,.69,.35,.73,this.mats.motor,-1.50,.96,-.08,'block');
    this.box(e,.71,.17,.72,this.mats.silver,-1.50,1.20,-.08,'head');
    this.box(e,.75,.16,.74,this.mats.motorDark,-1.50,1.36,-.08,'valvecover');
    this.box(e,.45,.018,.06,this.mats.silver,-1.49,1.451,-.08,'engine');
    for(let i=0;i<4;i++){
      let z=-.35+i*.17;
      this.cylinder(e,.047,.042,.08,this.mats.rubber,-1.50,1.46,z,'coil','y');
      this.cylinder(e,.024,.024,.105,this.mats.chrome,-1.50,1.40,z,'spark','y');
      this.cylinder(e,.067,.067,.12,this.mats.silver,-1.55,1.00,z,'pistons','y',15);
    }
    this.cylinder(e,.093,.093,.79,this.mats.motorDark,-1.56,.84,-.08,'crank','z');
    this.box(e,.72,.13,.76,this.mats.motorDark,-1.51,.69,-.08,'oilsump');
    for(let i=0;i<6;i++){
      this.box(e,.76,.016,.032,this.mats.chrome,-1.50,.89,-.40+i*.135,'block');
    }
    this.cylinder(e,.17,.17,.19,this.mats.rubber,-1.17,1.16,-.12,'timing','x');
    this.cylinder(e,.095,.095,.21,this.mats.silver,-1.15,1.04,.14,'timing','x');
    this.box(e,.40,.13,.36,this.mats.plastic,-1.85,1.19,.44,'airfilter');
    this.box(e,.34,.029,.31,this.mats.darkChrome,-1.85,1.271,.44,'airfilter');
    this.pipe(e,[[-1.68,1.20,.44],[-1.50,1.26,.46],[-1.21,1.30,.34]],.077,this.mats.motorDark,'intake');
    this.box(e,.34,.21,.33,this.mats.motor,-1.35,1.22,.30,'intake');
    this.cylinder(e,.105,.105,.115,this.mats.chrome,-1.19,1.31,.22,'throttle','x');
    for(let i=0;i<4;i++)this.pipe(e,[[-1.38,1.25,.18+i*.08],[-1.47,1.15,.26+i*.08],[-1.58,1.11,.30+i*.08]],.028,this.mats.motor,'intake');
    this.pipe(e,[[-1.28,1.32,.25],[-1.42,1.26,.29],[-1.56,1.28,.29]],.029,this.mats.copper,'injector');
    for(let z of [-.35,-.18,0,.17])this.cylinder(e,.024,.024,.09,this.mats.gold,-1.45,1.26,z,'injector');
    this.cylinder(e,.083,.083,.18,this.mats.chrome,-1.76,.90,.39,'oilfilter','z',18);
  }
  buildCooling() {
    const c=this.group('cooling');
    this.box(c,.09,.58,1.07,this.mats.motorDark,-2.055,1.05,0,'radiator');
    for(let i=0;i<18;i++)this.box(c,.013,.54,.014,this.mats.silver,-2.114,1.05,-.49+i*.057,'radiator');
    this.cylinder(c,.258,.258,.04,this.mats.darkChrome,-1.961,1.00,0,'fan','x');
    for(let i=0;i<7;i++){
      let a=i*Math.PI*2/7;
      const v=this.box(c,.018,.17,.09,this.mats.silver,-1.935,1+.12*Math.sin(a),.12*Math.cos(a),'fan');v.rotation.x=a;
    }
    this.box(c,.24,.26,.26,this.mats.coolant,-1.86,1.25,-.57,'coolant');
    this.cylinder(c,.075,.075,.035,this.mats.rubber,-1.86,1.394,-.57,'coolant');
    this.pipe(c,[[-1.97,1.26,.35],[-1.77,1.37,.34],[-1.60,1.18,.33]],.035,this.mats.rubber,'thermostat');
    this.cylinder(c,.093,.093,.12,this.mats.silver,-1.56,1.04,.42,'pump','z');
    this.pipe(c,[[-1.55,1.01,.42],[-1.69,.98,.41],[-1.95,1.03,.46]],.038,this.mats.rubber,'pump');
  }
  buildElectrical() {
    const e=this.group('electric');
    this.box(e,.30,.25,.29,this.mats.plastic,-1.82,1.18,-.47,'battery');
    this.box(e,.27,.035,.27,this.mats.darkChrome,-1.82,1.32,-.47,'battery');
    for(let z of [-.57,-.37])this.cylinder(e,.025,.025,.035,this.mats.gold,-1.83,1.36,z,'battery');
    this.cylinder(e,.129,.12,.18,this.mats.silver,-1.68,1.03,.45,'alternator','z');
    for(let i=0;i<10;i++){
      let a=Math.PI*2*i/10;this.box(e,.014,.082,.009,this.mats.motorDark,-1.68+.10*Math.cos(a),1.03+.10*Math.sin(a),.556,'alternator').rotation.z=a;
    }
    this.cylinder(e,.11,.10,.29,this.mats.motorDark,-1.11,.92,-.33,'starter','x');
    this.box(e,.24,.18,.23,this.mats.plastic,-1.20,1.23,-.53,'fusebox');
    this.box(e,.17,.12,.16,this.mats.motorDark,-1.11,1.24,.44,'ecu');
    this.box(e,.21,.12,.15,this.mats.chrome,-1.13,1.20,-.39,'abs');
    for(let i=0;i<4;i++)this.pipe(e,[[-1.14,1.18,-.39+i*.03],[-.98,1.10,-.30+i*.04],[-.76,.96,-.32+i*.03]],.010,this.mats.copper,'abs');
  }
  buildTransmission() {
    const t=this.group('transmission');
    this.box(t,.57,.38,.55,this.mats.motor,-.91,.91,.02,'gearbox');
    this.cylinder(t,.19,.19,.15,this.mats.silver,-1.18,.93,.05,'converter','x');
    for(let i=0;i<5;i++)this.box(t,.03,.37,.54,this.mats.darkChrome,-1.14+i*.11,.92,.02,'gearbox');
    this.cylinder(t,.16,.13,.40,this.mats.motorDark,-.75,.84,.02,'differential','z');
    for(let side of [-1,1]){
      this.cylinder(t,.045,.045,.65,this.mats.chrome,-1.32,.62,side*.45,'axle','z',16);
      this.sphere(t,.089,this.mats.rubber,-1.38,.62,side*.75,'axle');
      this.sphere(t,.079,this.mats.rubber,-1.26,.62,side*.23,'axle');
    }
    this.box(t,.22,.11,.15,this.mats.motorDark,-.13,1.08,.04,'selector');
    this.cylinder(t,.025,.025,.21,this.mats.chrome,-.13,1.19,.04,'selector');
    this.sphere(t,.065,this.mats.seat,-.13,1.33,.04,'selector');
  }
  buildBrakesAndSuspension() {
    const br=this.group('brakes'), su=this.group('suspension');
    for(let side of [-1,1]){
      this.cylinder(br,.235,.235,.057,this.mats.chrome,-1.39,.47,side*.818,'frontdisc','z');
      this.box(br,.19,.13,.09,this.mats.red,-1.23,.49,side*.88,'caliper');
      this.cylinder(br,.215,.215,.065,this.mats.motorDark,1.39,.47,side*.817,'reardrum','z');
      // Front MacPherson strut with coil winding.
      this.cylinder(su,.05,.053,.44,this.mats.darkChrome,-1.38,.91,side*.65,'strut');
      this.cylinder(su,.083,.083,.065,this.mats.motorDark,-1.38,1.15,side*.65,'strut');
      let pts=[]; for(let i=0;i<100;i++){
        const a=i/99*Math.PI*9;pts.push([-1.38+.09*Math.cos(a),.69+i/99*.34,side*.65+.09*Math.sin(a)]);
      }this.pipe(su,pts,.014,this.mats.copper,'spring');
      this.pipe(su,[[-1.10,.55,side*.47],[-1.34,.45,side*.64],[-1.40,.47,side*.80]],.043,this.mats.silver,'arm');
      this.pipe(su,[[-1.08,.70,side*.25],[-1.19,.58,side*.50],[-1.39,.56,side*.83]],.026,this.mats.silver,'tie');
      this.cylinder(su,.042,.045,.35,this.mats.darkChrome,1.40,.77,side*.64,'rearbeam');
    }
    this.box(su,.14,.10,1.27,this.mats.motor,1.39,.54,0,'rearbeam');
    this.box(su,.50,.13,.19,this.mats.motorDark,-1.02,.73,.17,'steering');
    this.pipe(su,[[-.93,.77,.20],[-1.17,.73,.41],[-1.36,.60,.70]],.033,this.mats.silver,'steering');
    this.box(br,.22,.13,.13,this.mats.silver,-1.10,1.24,-.32,'mastercyl');
    this.box(br,.16,.11,.14,this.mats.coolant,-1.10,1.36,-.32,'mastercyl');
    this.pipe(br,[[-1.09,1.18,-.32],[-.80,.80,-.37],[-.30,.66,-.59],[-1.20,.52,-.78]],.012,this.mats.copper,'brakehose');
    this.pipe(br,[[-1.09,1.18,-.32],[-.80,.80,-.36],[.75,.65,-.66],[1.39,.49,-.78]],.012,this.mats.copper,'brakehose');
  }
  buildInterior() {
    const i=this.group('interior');
    // Brownish/charcoal interior visible through translucent side windows.
    this.box(i,2.38,.08,1.38,this.mats.seat,-.01,.73,0);
    this.box(i,.25,.20,1.34,this.mats.motorDark,-.82,1.21,0,'dash');
    this.box(i,.22,.075,.42,this.mats.plastic,-.78,1.37,0,'dash');
    this.box(i,.035,.17,.23,this.mats.glassDark,-.893,1.38,.03,'screen');
    for(let z of [-.43,.43]){
      const seat=this.group('seat'+z,i);
      this.box(seat,.47,.11,.44,this.mats.seat,-.10,.91,z,'seats');
      const back=this.box(seat,.13,.57,.45,this.mats.seat,.13,1.19,z,'seats');back.rotation.z=-.08;
      this.box(seat,.08,.14,.27,this.mats.seatTrim,.16,1.53,z,'seats');
      this.line(seat,[[.05,.95,z-.15],[.05,1.44,z-.15]],0x5e6c80,.49);
    }
    this.box(i,.45,.12,1.31,this.mats.seat,1.03,.90,0,'rearseat');
    this.box(i,.13,.49,1.30,this.mats.seat,1.27,1.18,0,'rearseat');
    for(let z of [-.43,0,.43])this.box(i,.09,.13,.24,this.mats.seatTrim,1.28,1.49,z,'rearseat');
    this.cylinder(i,.24,.24,.03,this.mats.motorDark,-.49,1.42,.44,'steerwheel','x');
    const ring=this.place(i,new THREE.TorusGeometry(.19,.032,9,35),this.mats.seat,-.445,1.42,.44,'steerwheel');ring.rotation.y=Math.PI/2;ring.rotation.z=.04;
    this.cylinder(i,.062,.062,.05,this.mats.silver,-.43,1.42,.44,'airbag','x');
    for(let a=0;a<3;a++){
      const phi=a*Math.PI*2/3;this.pipe(i,[[-.417,1.42,.44],[-.417,1.42+.14*Math.cos(phi),.44+.14*Math.sin(phi)]],.018,this.mats.silver,'steerwheel');
    }
    this.pipe(i,[[.02,1.46,.69],[.06,1.20,.62],[.15,.97,.49]],.017,this.mats.red,'belt');
    this.pipe(i,[[.02,1.46,-.69],[.06,1.20,-.62],[.15,.97,-.49]],.017,this.mats.red,'belt');
    this.box(i,.49,.11,.23,this.mats.motorDark,-.14,.86,0);
    this.box(i,.15,.16,.17,this.mats.plastic,-.29,1.11,0);
  }
  buildFuelAndExhaust() {
    const ex=this.group('exhaust');
    this.box(ex,.83,.23,.70,this.mats.motorDark,1.24,.47,-.06,'fuel');
    this.cylinder(ex,.10,.10,.065,this.mats.chrome,1.20,.62,-.06,'fuelpump');
    this.cylinder(ex,.11,.11,.28,this.mats.silver,-.73,.47,-.18,'catalyst','x');
    this.pipe(ex,[[-1.09,.59,-.16],[-.76,.46,-.18],[-.35,.42,-.18],[.45,.39,-.18],[1.57,.39,-.18],[2.14,.40,-.20]],.036,this.mats.darkChrome,'exhaustpipe');
    this.cylinder(ex,.14,.14,.56,this.mats.motor,1.75,.42,-.20,'muffler','x');
    this.cylinder(ex,.055,.055,.25,this.mats.chrome,2.12,.40,-.20,'exhaustpipe','x');
  }
  buildSelectionHalo() {
    const h=this.group('selector');
    const ring=this.place(h,new THREE.TorusGeometry(.20,.014,7,48),new THREE.MeshBasicMaterial({color:0x55deff,transparent:true,opacity:.9}));
    ring.rotation.x=Math.PI/2;
    const ring2=this.place(h,new THREE.TorusGeometry(.13,.012,7,48),new THREE.MeshBasicMaterial({color:0xffcb7a,transparent:true,opacity:.65}));
    ring2.rotation.y=Math.PI/2;
    this.halo=h;this.halo.visible=false;
  }
  buildGroundGlow() {
    const g=this.group('groundglow');
    let sh=this.place(g,new THREE.PlaneGeometry(5.8,3.0),new THREE.MeshBasicMaterial({color:0x173f55,transparent:true,opacity:.09,depthWrite:false}),0,.008,0);
    sh.rotation.x=-Math.PI/2;
  }
  setPaint(hex){this.mats.paint.color.set(hex);}
  setTarget(name,value){if(name in this.targets)this.targets[name]=value?1:0;}
  toggle(name){if(name in this.targets){this.targets[name]=1-this.targets[name];return Boolean(this.targets[name]);}return false;}
  select(id){
    this.selection=id;this.halo.visible=!!id;
    if(this.selectionBox){this.root.remove(this.selectionBox);this.selectionBox.geometry.dispose();this.selectionBox.material.dispose();this.selectionBox=null;}
    const p=PARTS.find(q=>q.id===id);
    if(p)this.halo.position.set(...p.position);
    const actual=this.owned.get(id);
    if(actual?.length){
      this.root.updateMatrixWorld(true);
      this.selectionBox=new THREE.BoxHelper(actual[0],0x78f0ff);
      this.selectionBox.material.transparent=true;this.selectionBox.material.opacity=.55;
      this.root.add(this.selectionBox);
    }
  }
  hitPart(intersect){ let obj=intersect.object;while(obj){if(obj.userData.partId)return obj.userData.partId;obj=obj.parent;}return null; }
  getRaycastObjects() { return [this.root]; }
  getPartPoint(id) { const p=PARTS.find(q=>q.id===id);return p?new THREE.Vector3(...p.position):new THREE.Vector3(); }
  update(dt,time){
    const damp=Math.min(1,dt*3.6);
    for(const key of Object.keys(this.targets)) this.animated[key]+=(this.targets[key]-this.animated[key])*damp;
    this.hoodPivot.rotation.z=-1.18*this.animated.hood;
    this.trunkPivot.rotation.z=.94*this.animated.trunk;
    for(const d of this.doorPivots)d.pivot.rotation.y=-d.side*1.13*this.animated.doors;
    for(const [key,arr] of this.explosive){let g=this.groups[key];if(g)g.position.set(...arr.map(v=>v*this.animated.explode));}
    // Transparency of body is reduced when X-ray or parts explosion is enabled.
    const x=Math.max(this.animated.xray,this.animated.explode*.84);
    this.mats.paint.transparent=x>.02;this.mats.paint.opacity=1-.80*x;
    this.mats.edge.transparent=x>.02;this.mats.edge.opacity=1-.64*x;
    this.mats.glassDark.opacity=.61-.49*x;
    this.mats.glass.opacity=.35-.25*x;
    this.mats.paint.depthWrite=x<.5;
    this.mats.edge.depthWrite=x<.5;
    // Demonstrative rotation; not a physics simulation.
    if(this.animated.engine>.04){for(let w of this.wheels)w.rotation.z+=dt*1.7*this.animated.engine;}
    if(this.selectionBox){this.selectionBox.update();this.selectionBox.material.opacity=.38+.22*(1+Math.sin(time*2.6))*.5;}
    if(this.halo.visible){this.halo.rotation.y=time*.75;this.halo.rotation.z=Math.sin(time*2)*.15;
      let s=1+Math.sin(time*3)*.16;this.halo.scale.setScalar(s);}
  }
}
