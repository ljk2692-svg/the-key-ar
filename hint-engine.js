(function installKeyLensHintProtocol(global){
  "use strict";

  const REGISTRY=global.KEY_LENS_HINT_REGISTRY||{};
  const CONFIG=global.KEY_LENS_HINT_CONFIG||{};
  const PRESETS=new Set(global.KEY_LENS_HINT_PRESETS||[]);
  const qs=new URLSearchParams(global.location.search);
  const requestedAudience=(qs.get("audience")||CONFIG.defaultAudience||"SCHOOL").toUpperCase();
  const audience=["SCHOOL","CORPORATE"].includes(requestedAudience)?requestedAudience:"SCHOOL";
  const requestedEventMode=(qs.get("eventMode")||CONFIG.defaultEventMode||"STANDARD_150").toUpperCase();
  const eventMode=CONFIG.eventModes?.[requestedEventMode]?requestedEventMode:"STANDARD_150";
  const requestedRound=(qs.get("round")||CONFIG.defaultRound||"ALL").toUpperCase();
  const roundParam=["ALL","1","2","3"].includes(requestedRound)?requestedRound:"ALL";
  const operatorMode=qs.get("operator")==="1";
  const diagnosticMode=operatorMode||qs.get("diag")==="1";
  const levelPolicy=CONFIG.eventModes?.[eventMode]||CONFIG.eventModes?.STANDARD_150||{level2DelayMs:3200,level2Enabled:true};
  const hintScene=document.querySelector("#arScene");
  const markerRoot=document.querySelector("#hintMarkerRoot");
  const layer=document.querySelector("#hintSpatialLayer");
  const content=document.querySelector("#hintSpatialContent");
  const mountedNodes=Object.values(REGISTRY).filter(node=>
    node.enabled&&node.implementation==="COMPLETE"&&(roundParam==="ALL"||String(node.round)===roundParam)
  );
  const markerById=new Map();
  const hintLostTimers=new Map();
  const visibleMarkers=new Set();
  const patternUrls=new Map();
  let activeId=null;
  let serial=0;
  let level=1;

  const state={
    version:CONFIG.version||"24.0.0",
    audience,
    eventMode,
    activeGroup:roundParam==="ALL"?"ALL CONFIRMED":`ROUND ${roundParam}`,
    totalNodes:Object.keys(REGISTRY).length,
    mountedNodes:mountedNodes.length,
    assetState:Object.fromEntries(mountedNodes.map(node=>[node.id,"CHECKING"])),
    assetErrors:[],
    lastTarget:"NONE",
    route:"IDLE",
    level:0,
    activeObjects:0,
    fps:0
  };

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const phase=(time,start,duration)=>clamp((time-start)/duration,0,1);
  const easeOut=t=>1-Math.pow(1-t,3);
  const easeBack=t=>{const c=1.70158,c3=c+1;return 1+c3*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
  const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const nodeRoute=id=>`HINT / ${id.replace(/^H-R/,"R")}`;
  const nodeCopy=(node,nextLevel=1)=>{
    const variant=node.copy?.[audience]||node.copy?.SCHOOL;
    return variant?.[`level${nextLevel}`]||variant?.level1||{line1:"HINT PROTOCOL",line2:""};
  };
  const canUseLevel2=node=>Boolean(levelPolicy.level2Enabled&&(node.copy?.[audience]?.level2||node.copy?.SCHOOL?.level2));

  function patternUrl(node){
    if(patternUrls.has(node.id))return patternUrls.get(node.id);
    const embedded=global.KEY_LENS_HINT_PATTERNS?.[node.id];
    const url=embedded
      ?URL.createObjectURL(new Blob([embedded],{type:"text/plain;charset=utf-8"}))
      :new URL(`./hint-nodes/${node.id}.patt`,document.baseURI).href;
    patternUrls.set(node.id,url);
    return url;
  }

  function visualRailMarkup(node){
    const preset=node.visualPreset;
    const variant=node.visual?.variant;
    if(variant==="CODE_MAPPING")return `<div class="hintVisualRail mapping"><div class="mappingSources">${Array.from({length:4},()=>"<b></b>").join("")}</div><div class="mappingArrow">↕</div><div class="mappingAlphabet">${"ABCDEFGHI".split("").map(value=>`<span>${value}</span>`).join("")}</div></div>`;
    if(variant==="TWO_STAGE")return `<div class="hintVisualRail twoStage"><div class="stageBox"><b>5-1</b><i class="objectTrace"></i></div><em>+</em><div class="stageBox"><b>5-2</b><i class="ruleTrace">★</i></div><div class="outputSlots">${Array.from({length:4},()=>"<span>□</span>").join("")}</div></div>`;
    if(variant==="TRIPLE_DECODE")return `<div class="hintVisualRail tripleDecode">${Array.from({length:3},(_,i)=>`<div class="stageBox"><b>6-${i+1}</b><i></i></div>`).join("<em>›</em>")}<div class="outputSlots">${Array.from({length:4},()=>"<span>□</span>").join("")}</div></div>`;
    if(variant==="FRAGMENT_FILTER")return `<div class="hintVisualRail fragmentFilter"><div class="fragmentRow">${Array.from({length:8},()=>"<span></span>").join("")}</div><div class="wordSlot">WORD</div><div class="categoryRow">${Array.from({length:4},(_,i)=>`<b>${String(i+1).padStart(2,"0")}</b>`).join("")}</div></div>`;
    if(variant==="GESTURE_VERIFY")return `<div class="hintVisualRail gestureVerify"><div class="gestureRow">${Array.from({length:5},(_,i)=>`<span><i>${i+1}</i></span>`).join("")}</div><div class="criteriaRow"><b>COUNT</b><b>ANGLE</b><b>FORM</b></div></div>`;
    if(variant==="ROTATE_CLUE")return `<div class="hintVisualRail rotateClue"><div class="clueRow">${Array.from({length:5},(_,i)=>`<span style="--i:${i}"></span>`).join("")}</div><div class="rotateArrow">90°</div><div class="neutralOptions">${Array.from({length:5},(_,i)=>`<b>${String(i+1).padStart(2,"0")}</b>`).join("")}</div></div>`;
    if(preset==="CODE_RAIL")return `<div class="hintVisualRail codeRail gold">${Array.from({length:8},(_,i)=>`<span>${String(i+1).padStart(2,"0")}</span>`).join("")}</div>`;
    if(preset==="SEQUENCE_REVEAL")return `<div class="hintVisualRail sequence gold">${Array.from({length:4},(_,i)=>`<span>${String(i+1).padStart(2,"0")}</span>`).join("")}</div>`;
    if(preset==="MOTION_GUIDE")return `<div class="hintVisualRail motion">${Array.from({length:6},(_,i)=>`<span>${i+1}</span>`).join("")}<span>LINK</span></div>`;
    if(preset==="SEARCH")return `<div class="hintVisualRail search">${Array.from({length:5},()=>"<span></span>").join("")}<span class="object">OBJECT</span></div>`;
    if(preset==="OBSERVE")return `<div class="hintVisualRail observe">${Array.from({length:4},(_,i)=>`<span>${String(i+1).padStart(2,"0")}</span>`).join("")}<span class="common">COMMON</span></div>`;
    if(preset==="PREFIX")return `<div class="hintVisualRail prefix">${Array.from({length:5},()=>"<span><b>□</b><i></i></span>").join("")}</div>`;
    return `<div class="hintVisualRail">${Array.from({length:4},(_,i)=>`<span>${String(i+1).padStart(2,"0")}</span>`).join("")}</div>`;
  }

  function showDOM(node,nextLevel=1){
    if(!layer||!content)return;
    const copy=nodeCopy(node,nextLevel);
    const gold=node.accent==="GOLD"||nextLevel===2;
    content.innerHTML=`<div class="hintShell${nextLevel===2?" hintLevelTwo":""}">
      <div class="hintNodeTag">${escapeHTML(node.id)} · ${escapeHTML(node.title)}</div>
      ${visualRailMarkup(node)}<div class="hintScanLine"></div>
      <div class="hintFrame${gold?" gold":""}">
        <span class="hintProtocolLabel">${escapeHTML(node.systemLabel||"HINT PROTOCOL")}</span>
        <strong>${escapeHTML(copy.line1)}</strong><small>${escapeHTML(copy.line2)}</small>
        <button type="button" class="hintLevelButton" aria-label="두 번째 힌트 열기">HINT LEVEL 2</button>
      </div></div>`;
    layer.classList.add("active");
    const button=content.querySelector(".hintLevelButton");
    if(button&&canUseLevel2(node)&&nextLevel===1){
      button.onclick=()=>setLevel(2,"participant");
      const rec=HintFX.record(node.id);
      if(rec)schedule(rec,()=>button.classList.add("ready"),operatorMode?250:levelPolicy.level2DelayMs);
    }
    updateDOMAnchor();
  }

  function hideDOM(){
    if(!layer||!content)return;
    const button=content.querySelector(".hintLevelButton");
    if(button)button.onclick=null;
    layer.classList.remove("active");
    content.innerHTML="";
  }

  function updateDOMAnchor(){
    if(!activeId||!content)return;
    const rec=HintFX.record(activeId);
    const anchor=rec?.screenAnchor;
    const canvas=hintScene?.canvas||document.querySelector("#arScene canvas")||document.querySelector(".a-canvas");
    const rect=canvas?.getBoundingClientRect?.();
    const fallbackRect=rect&&rect.width>2?rect:{left:0,top:0,width:innerWidth,height:innerHeight};
    const x=anchor?.x??fallbackRect.left+fallbackRect.width/2;
    const y=anchor?.y??fallbackRect.top+fallbackRect.height/2;
    const size=anchor?.size??clamp(fallbackRect.width*.78,280,430);
    content.style.left=`${x}px`;content.style.top=`${y}px`;
    content.style.width=`${size}px`;content.style.height=`${size}px`;
  }

  function setHintHud(node,nextLevel){
    const copy=nodeCopy(node,nextLevel);
    const pill=document.querySelector("#pill");
    if(pill){pill.style.display="block";pill.textContent=nextLevel===2?"HINT LEVEL 2":"HINT NODE"}
    const guide=document.querySelector("#guide");if(guide)guide.style.display="none";
    const mission=document.querySelector("#mission");if(mission)mission.textContent=`${node.id} // ${node.title}`;
    if(typeof setHud==="function")setHud(nextLevel===2?"DIRECTION HINT":"HINT PROTOCOL",copy.line1,copy.line2);
  }

  function restoreScannerHud(status="SCANNING..."){
    if(activeId)return;
    if(typeof current!=="undefined"&&current)return;
    const pill=document.querySelector("#pill");
    if(pill){pill.style.display="none";pill.textContent="TARGET FOUND"}
    const guide=document.querySelector("#guide");if(guide&&typeof scannerStarted!=="undefined"&&scannerStarted)guide.style.display="block";
    const mission=document.querySelector("#mission");if(mission)mission.textContent="SCANNER READY";
    if(typeof setHud==="function"&&typeof scannerStarted!=="undefined"&&scannerStarted){
      setHud(status,"미션 이미지 또는 HINT NODE를 화면 중앙에 맞춰주세요.","인식 영역이 확인되면 해당 프로토콜이 자동 실행됩니다.");
    }
  }

  const HintFX=(()=>{
    const geometryCache=new Map();
    const textureCache=new Map();
    const records=new Map();
    let raf=0;
    let fpsFrames=0;
    let fpsStamp=performance.now();
    const tempCenter=new THREE.Vector3();
    const tempLeft=new THREE.Vector3();
    const tempRight=new THREE.Vector3();
    const cameraPosition=new THREE.Vector3();

    function geometry(key,factory){
      if(!geometryCache.has(key))geometryCache.set(key,factory());
      return geometryCache.get(key);
    }
    function material(rec,color,opacity=.82,additive=false){
      const value=new THREE.MeshBasicMaterial({
        color,transparent:opacity<1,opacity,depthWrite:false,side:THREE.DoubleSide,
        blending:additive?THREE.AdditiveBlending:THREE.NormalBlending
      });
      rec.materials.add(value);
      return value;
    }
    function lineMaterial(rec,color,opacity=.72){
      const value=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false});
      rec.materials.add(value);
      return value;
    }
    function texture(key,factory){
      if(!textureCache.has(key))textureCache.set(key,factory());
      return textureCache.get(key);
    }
    function glowTexture(color){
      return texture(`glow-${color}`,()=>{
        const canvas=document.createElement("canvas");canvas.width=128;canvas.height=128;
        const ctx=canvas.getContext("2d"),gradient=ctx.createRadialGradient(64,64,2,64,64,61);
        gradient.addColorStop(0,"rgba(255,255,255,1)");
        gradient.addColorStop(.18,color);gradient.addColorStop(.52,color.replace("1)",".34)"));gradient.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
        const map=new THREE.CanvasTexture(canvas);map.minFilter=THREE.LinearFilter;map.magFilter=THREE.LinearFilter;return map;
      });
    }
    function labelTexture(top,bottom,color="#76ddea"){
      const key=`label-${top}-${bottom}-${color}`;
      return texture(key,()=>{
        const canvas=document.createElement("canvas");canvas.width=512;canvas.height=160;
        const ctx=canvas.getContext("2d");ctx.clearRect(0,0,512,160);
        ctx.fillStyle="rgba(4,12,20,.91)";ctx.strokeStyle=color;ctx.lineWidth=3;
        ctx.beginPath();ctx.roundRect?.(7,7,498,146,18);if(!ctx.roundRect)ctx.rect(7,7,498,146);ctx.fill();ctx.stroke();
        ctx.textAlign="center";ctx.fillStyle="#f4fbff";ctx.font="800 33px Arial";ctx.fillText(top,256,67);
        ctx.fillStyle=color;ctx.font="700 19px monospace";ctx.fillText(bottom,256,111);
        const map=new THREE.CanvasTexture(canvas);map.minFilter=THREE.LinearFilter;return map;
      });
    }
    function sprite(rec,map,width,height,opacity=.9){
      const mat=new THREE.SpriteMaterial({map,transparent:true,opacity,depthWrite:false});rec.materials.add(mat);
      const result=new THREE.Sprite(mat);result.scale.set(width,height,1);return result;
    }
    function glow(rec,color="#76ddea",size=.35,opacity=.7){return sprite(rec,glowTexture(color),size,size,opacity)}
    function label(rec,top,bottom,color,width=.86){return sprite(rec,labelTexture(top,bottom,color),width,width*.3125,.94)}
    function mesh(rec,key,factory,color,opacity=.82,additive=false){return new THREE.Mesh(geometry(key,factory),material(rec,color,opacity,additive))}
    function box(rec,key,w,h,d,color,opacity=.75){return mesh(rec,key,()=>new THREE.BoxGeometry(w,h,d),color,opacity)}
    function ring(rec,radius,tube,color,opacity=.76){return mesh(rec,`ring-${radius}-${tube}`,()=>new THREE.TorusGeometry(radius,tube,8,42),color,opacity,true)}
    function node(rec,radius,color,opacity=.9){return mesh(rec,`sphere-${radius}`,()=>new THREE.SphereGeometry(radius,10,7),color,opacity,true)}
    function frame(rec,w,h,color=0x76ddea,opacity=.68){
      const edges=geometry(`frame-${w}-${h}`,()=>new THREE.EdgesGeometry(new THREE.BoxGeometry(w,h,.025)));
      return new THREE.LineSegments(edges,lineMaterial(rec,color,opacity));
    }
    function link(rec,a,b,color=0x76ddea,width=.014,opacity=.62){
      const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
      const value=box(rec,"unit-link",1,1,1,color,opacity);
      value.scale.set(length,width,width);value.position.set((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
      value.rotation.z=Math.atan2(dy,dx);return value;
    }
    function reveal(rec,object,start,duration=.48,target=1){
      const targetVector=typeof target==="number"?new THREE.Vector3(target,target,target):target.clone();
      object.scale.set(.001,.001,.001);
      rec.tickers.push((elapsed)=>{const p=easeBack(phase(elapsed,start,duration));object.scale.set(targetVector.x*p,targetVector.y*p,targetVector.z*p)});
      return object;
    }
    function pulse(rec,object,start=.7,amount=.07,speed=3.2){
      const base=new THREE.Vector3();
      rec.tickers.push((elapsed)=>{
        if(elapsed<start)return;
        if(!object.userData.pulseBase)object.userData.pulseBase=base.copy(object.scale).clone();
        const s=1+Math.sin(elapsed*speed)*amount;
        object.scale.copy(object.userData.pulseBase).multiplyScalar(s);
      });
    }
    function addBase(rec){
      const root=rec.visual;
      const glowPlane=glow(rec,"rgba(118,221,234,1)",1.25,.42);glowPlane.position.z=-.10;root.add(glowPlane);reveal(rec,glowPlane,.10,.42,.94);
      const outer=ring(rec,.67,.016,0x76ddea,.76);const middle=ring(rec,.50,.009,0x2488ff,.56);const inner=ring(rec,.31,.012,0xd7b66d,.72);
      [outer,middle,inner].forEach(item=>root.add(item));
      reveal(rec,outer,.12,.46);reveal(rec,middle,.24,.48);reveal(rec,inner,.36,.48);
      rec.tickers.push((elapsed)=>{outer.rotation.z=elapsed*.34;middle.rotation.z=-elapsed*.52;inner.rotation.z=elapsed*.70});
      const core=node(rec,.072,0xf4fbff,.96);root.add(core);reveal(rec,core,.42,.38);pulse(rec,core,.9,.10,4.4);
      const beam=box(rec,"base-beam",.025,1.18,.025,0x76ddea,.18);beam.position.y=.06;root.add(beam);reveal(rec,beam,.38,.44,new THREE.Vector3(1,1,.01));
      const shardGeometry=geometry("hint-shard",()=>new THREE.TetrahedronGeometry(.055,0));
      for(let i=0;i<6;i++){
        const shard=new THREE.Mesh(shardGeometry,material(rec,i%3===0?0xd7b66d:0x76ddea,.70,true));
        const angle=i/6*Math.PI*2+.18;shard.position.set(Math.cos(angle)*.58,Math.sin(angle)*.58,.02);root.add(shard);reveal(rec,shard,.46+i*.055,.34,.72);
        rec.tickers.push((elapsed)=>{shard.rotation.x=elapsed*(.55+i*.03);shard.rotation.y=-elapsed*(.40+i*.02)});
      }
      const particleGeometry=new THREE.BufferGeometry();const positions=[];
      for(let i=0;i<12;i++){const angle=i/12*Math.PI*2;positions.push(Math.cos(angle)*(.38+(i%3)*.09),Math.sin(angle)*(.38+(i%2)*.12),(i%4)*.018)}
      particleGeometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));rec.ownedGeometry.add(particleGeometry);
      const particleMaterial=new THREE.PointsMaterial({color:0x76ddea,size:.018,transparent:true,opacity:.66,depthWrite:false,blending:THREE.AdditiveBlending});rec.materials.add(particleMaterial);
      const particles=new THREE.Points(particleGeometry,particleMaterial);root.add(particles);
      rec.tickers.push((elapsed)=>{particles.rotation.z=-elapsed*.25;particleMaterial.opacity=.38+.22*Math.sin(elapsed*2.4)**2});
      const badge=label(rec,"HINT PROTOCOL",rec.node.id,rec.node.accent==="GOLD"?"#d7b66d":"#76ddea",.88);badge.position.set(0,.86,.02);root.add(badge);reveal(rec,badge,.58,.45);
    }

    function buildWordGroups(rec){
      const leftX=-.31,rightX=.31;
      [leftX,rightX].forEach((x,groupIndex)=>{
        const groupFrame=frame(rec,.43,.62,groupIndex?0x2488ff:0x76ddea,.64);groupFrame.position.set(x,.02,.05);rec.visual.add(groupFrame);reveal(rec,groupFrame,.72+groupIndex*.12,.42);
        for(let i=0;i<4;i++){
          const y=.23-i*.15;
          const slot=box(rec,"word-group-slot",.27,.072,.026,groupIndex?0x2488ff:0x76ddea,.38);slot.position.set(x,y,.08);rec.visual.add(slot);reveal(rec,slot,.92+i*.10+groupIndex*.06,.30);
          if(groupIndex===0){
            const path=link(rec,new THREE.Vector3(leftX+.16,y,.055),new THREE.Vector3(rightX-.16,y,.055),i===3?0xd7b66d:0x76ddea,.009,i===3?.70:.34);rec.visual.add(path);reveal(rec,path,1.42+i*.15,.32);
          }
        }
      });
      const rule=node(rec,.052,0xd7b66d,.94);rule.position.set(0,.02,.13);rec.visual.add(rule);reveal(rec,rule,1.92,.38);pulse(rec,rule,2.25,.12,4.2);
    }
    function buildCompare(rec){
      if(rec.node.visual?.variant==="WORD_GROUPS"){buildWordGroups(rec);return}
      if(rec.node.visual?.variant==="FRAGMENT_FILTER"){buildFragmentFilter(rec);return}
      if(rec.node.visual?.variant==="GESTURE_VERIFY"){buildGestureVerify(rec);return}
      const group=new THREE.Group();rec.visual.add(group);
      [-.26,.26].forEach((x,index)=>{
        const panel=box(rec,"compare-panel",.42,.45,.026,index?0x2488ff:0x76ddea,.34);panel.position.set(x,.05,.05);group.add(panel);reveal(rec,panel,.82+index*.16,.46);
        const marker=node(rec,.035,0xd7b66d,.92);marker.position.set(x+(index?-.07:.08),.10,.09);group.add(marker);reveal(rec,marker,1.42+index*.18,.28);
      });
      const overlap=frame(rec,.42,.45,0xd7b66d,.62);overlap.position.set(0,.05,.11);group.add(overlap);reveal(rec,overlap,1.65,.50);
      rec.tickers.push((elapsed)=>{overlap.position.x=Math.sin(Math.max(0,elapsed-1.7)*2.2)*.11});
    }
    function buildFragmentFilter(rec){
      const fragments=[];
      for(let i=0;i<8;i++){
        const row=i<4?0:1,col=i%4;
        const piece=box(rec,"fragment-piece",.15,.12,.032,i%3===2?0xd7b66d:0x76ddea,.58);
        piece.position.set(-.30+col*.20,.31-row*.17,.08);piece.rotation.z=(i%2?-.12:.12);rec.visual.add(piece);fragments.push(piece);reveal(rec,piece,.66+i*.075,.28);
      }
      const wordFrame=frame(rec,.76,.18,0xf4fbff,.74);wordFrame.position.set(0,-.08,.10);rec.visual.add(wordFrame);reveal(rec,wordFrame,1.58,.42);
      fragments.forEach((piece,index)=>rec.tickers.push((elapsed)=>{
        const p=easeOut(phase(elapsed,1.20+index*.035,.62));
        piece.position.x+=(-.35+index*.10-piece.position.x)*p*.045;
        piece.position.y+=(-.08-piece.position.y)*p*.045;
        piece.rotation.z*=1-p*.04;
      }));
      for(let i=0;i<4;i++){
        const option=frame(rec,.20,.15,0x76ddea,.46);option.position.set(-.36+i*.24,-.38,.08);rec.visual.add(option);reveal(rec,option,2.02+i*.11,.30);
      }
      const guide=label(rec,"FRAGMENTS → WORD","WORD → CATEGORY","#76ddea",.69);guide.position.set(0,-.61,.12);rec.visual.add(guide);reveal(rec,guide,2.48,.40);
    }
    function buildGestureVerify(rec){
      const cards=[];
      for(let i=0;i<5;i++){
        const x=-.48+i*.24;const card=frame(rec,.20,.42,0x76ddea,.58);card.position.set(x,.08,.06);rec.visual.add(card);cards.push(card);reveal(rec,card,.66+i*.10,.34);
        const palm=box(rec,"gesture-palm",.085,.13,.035,0x2488ff,.40);palm.position.set(x,.02,.08);rec.visual.add(palm);reveal(rec,palm,.82+i*.10,.28);
        const finger=box(rec,"gesture-finger",.026,.18+.018*(i%3),.028,0x76ddea,.64);finger.position.set(x,.16,.09);finger.rotation.z=(i-2)*.08;rec.visual.add(finger);reveal(rec,finger,.94+i*.10,.28);
      }
      const sweep=box(rec,"gesture-sweep",.03,.55,.018,0xd7b66d,.45);sweep.position.set(-.60,.08,.13);rec.visual.add(sweep);reveal(rec,sweep,1.34,.26);
      rec.tickers.push((elapsed)=>{const p=phase(elapsed,1.48,1.55);sweep.position.x=-.60+1.20*p;cards.forEach((card,index)=>{card.material.opacity=.42+(Math.abs(p-index/4)<.16?.38:0)})});
      const criteria=label(rec,"SAME STANDARD","COUNT · ANGLE · FORM","#d7b66d",.72);criteria.position.set(0,-.45,.11);rec.visual.add(criteria);reveal(rec,criteria,2.75,.42);
    }
    function buildRelation(rec){
      if(rec.node.visual?.variant==="ROTATE_CLUE"){buildRotateClue(rec);return}
      const points=[new THREE.Vector3(-.43,.24,.06),new THREE.Vector3(0,.43,.06),new THREE.Vector3(.43,.24,.06),new THREE.Vector3(-.26,-.23,.06),new THREE.Vector3(.30,-.25,.06)];
      points.forEach((point,index)=>{const item=node(rec,index===1?.055:.044,index===4?0x5d6b74:0x76ddea,index===4?.30:.88);item.position.copy(point);rec.visual.add(item);reveal(rec,item,.75+index*.10,.32)});
      [[0,1],[1,2],[1,3],[3,4]].forEach(([a,b],index)=>{const value=link(rec,points[a],points[b],index===3?0xd7b66d:0x76ddea,.012,index===3?.78:.48);rec.visual.add(value);reveal(rec,value,1.18+index*.16,.35)});
      const slash=box(rec,"relation-slash",.18,.018,.018,0xff8585,.72);slash.position.copy(points[4]);slash.rotation.z=.72;rec.visual.add(slash);reveal(rec,slash,1.72,.35);
    }
    function buildRotateClue(rec){
      const clueGroup=new THREE.Group();clueGroup.position.y=.16;rec.visual.add(clueGroup);
      for(let i=0;i<5;i++){
        const x=-.46+i*.23;const glyph=new THREE.Group();glyph.position.set(x,0,.08);clueGroup.add(glyph);
        const stem=box(rec,"rotate-glyph-stem",.035,.23,.03,0x76ddea,.72);stem.position.x=-.035;glyph.add(stem);
        const arm=box(rec,"rotate-glyph-arm",.14,.035,.03,0x76ddea,.72);arm.position.set(.02,(i%2?-.07:.07),0);glyph.add(arm);
        reveal(rec,glyph,.68+i*.10,.32);
        rec.tickers.push((elapsed)=>{const p=easeOut(phase(elapsed,1.32+i*.06,.72));glyph.rotation.z=p*Math.PI*.5});
      }
      const pivot=ring(rec,.12,.012,0xd7b66d,.78);pivot.position.set(0,.16,.12);rec.visual.add(pivot);reveal(rec,pivot,1.18,.32);pulse(rec,pivot,1.65,.10,4.0);
      for(let i=0;i<5;i++){
        const x=-.46+i*.23;const option=node(rec,.030,0x76ddea,.55);option.position.set(x,-.23,.09);rec.visual.add(option);reveal(rec,option,2.08+i*.09,.28);
      }
      const guide=label(rec,"ROTATE 90°","VERIFY AGAIN","#d7b66d",.62);guide.position.set(0,-.48,.12);rec.visual.add(guide);reveal(rec,guide,2.58,.40);
    }
    function buildOrder(rec){
      if(rec.node.visual?.variant==="CODE_MAPPING"){buildCodeMapping(rec);return}
      const points=[];
      for(let i=0;i<4;i++){
        const x=-.54+i*.36;points.push(new THREE.Vector3(x,.02,.08));
        const slot=frame(rec,.25,.30,i===3?0xd7b66d:0x76ddea,.72);slot.position.copy(points[i]);rec.visual.add(slot);reveal(rec,slot,.78+i*.22,.38);
        const dot=node(rec,.028,i===3?0xd7b66d:0x76ddea,.88);dot.position.set(x,-.02,.10);rec.visual.add(dot);reveal(rec,dot,1.0+i*.22,.28);
        if(i){const arrow=link(rec,new THREE.Vector3(points[i-1].x+.13,.02,.05),new THREE.Vector3(x-.13,.02,.05),0xd7b66d,.010,.60);rec.visual.add(arrow);reveal(rec,arrow,1.18+i*.22,.30)}
      }
    }
    function buildCodeMapping(rec){
      const letters="ABCDEFGHI";
      for(let i=0;i<9;i++){
        const x=-.52+i*.13;const slot=frame(rec,.105,.14,0x76ddea,.58);slot.position.set(x,.27,.06);rec.visual.add(slot);reveal(rec,slot,.62+i*.055,.25);
      }
      const sourcePoints=[];
      for(let i=0;i<4;i++){
        const x=-.39+i*.26;const glyph=frame(rec,.19,.20,0xf4fbff,.72);glyph.position.set(x,-.10,.08);rec.visual.add(glyph);sourcePoints.push(new THREE.Vector3(x,-.10,.07));reveal(rec,glyph,1.14+i*.12,.32);
        const bar=box(rec,"mapping-glyph",.085,.026,.025,0x76ddea,.70);bar.position.set(x,-.10,.11);bar.rotation.z=(i%2?-.65:.65);rec.visual.add(bar);reveal(rec,bar,1.28+i*.12,.26);
      }
      const mapCore=node(rec,.045,0xd7b66d,.90);mapCore.position.set(0,.08,.12);rec.visual.add(mapCore);reveal(rec,mapCore,1.58,.30);pulse(rec,mapCore,1.92,.12,4.2);
      sourcePoints.forEach((point,index)=>{
        const path=link(rec,point,new THREE.Vector3(0,.08,.07),0x76ddea,.008,.38);rec.visual.add(path);reveal(rec,path,1.72+index*.11,.28);
      });
      const sweep=box(rec,"mapping-sweep",.025,.18,.018,0xd7b66d,.44);sweep.position.set(-.54,.27,.12);rec.visual.add(sweep);reveal(rec,sweep,1.88,.22);rec.tickers.push((elapsed)=>{sweep.position.x=-.54+1.08*phase(elapsed,2.05,1.45)});
      const guide=label(rec,letters,"POSITION MAPPING","#76ddea",.68);guide.position.set(0,-.43,.11);rec.visual.add(guide);reveal(rec,guide,2.28,.42);
    }
    function buildCombine(rec){
      if(rec.node.visual?.variant==="TRIPLE_DECODE"){buildTripleDecode(rec);return}
      const left=box(rec,"combine-fragment",.40,.34,.05,0x76ddea,.56),right=box(rec,"combine-fragment",.40,.34,.05,0xd7b66d,.56);
      left.position.set(-.48,.03,.05);right.position.set(.48,.03,.05);left.rotation.z=.16;right.rotation.z=-.16;rec.visual.add(left,right);
      reveal(rec,left,.78,.42);reveal(rec,right,.90,.42);
      let aperture=null;const semanticBars=[];
      if(rec.node.visual?.rotateLeft){
        aperture=ring(rec,.105,.012,0xf4fbff,.76);aperture.position.set(-.48,.03,.09);rec.visual.add(aperture);reveal(rec,aperture,1.04,.34);
        [-.07,0,.07].forEach((y,index)=>{const bar=box(rec,"semantic-bar",.20,.018,.018,index===1?0xd7b66d:0xf4fbff,.62);bar.position.set(.48,y+.03,.09);rec.visual.add(bar);semanticBars.push(bar);reveal(rec,bar,1.08+index*.09,.28)});
      }
      const merged=frame(rec,.54,.44,0xf4fbff,.78);merged.position.set(0,.03,.11);rec.visual.add(merged);reveal(rec,merged,2.0,.55);
      rec.tickers.push((elapsed)=>{const p=easeOut(phase(elapsed,1.2,.75));left.position.x=-.48+.34*p;right.position.x=.48-.34*p;if(rec.node.visual?.rotateLeft){left.rotation.z=.16+p*Math.PI*.5;if(aperture){aperture.position.x=left.position.x;aperture.rotation.z=left.rotation.z}semanticBars.forEach(bar=>{bar.position.x=right.position.x})}});
    }
    function buildTripleDecode(rec){
      const stagePoints=[];
      for(let i=0;i<3;i++){
        const x=-.40+i*.40;stagePoints.push(new THREE.Vector3(x,.15,.08));
        const panel=frame(rec,.31,.34,i===2?0xd7b66d:0x76ddea,.64);panel.position.set(x,.15,.06);rec.visual.add(panel);reveal(rec,panel,.66+i*.15,.36);
        if(i===0){
          for(let j=0;j<3;j++){const bar=box(rec,"triple-sequence",.16-j*.025,.018,.02,0x2488ff,.54);bar.position.set(x,.24-j*.08,.09);rec.visual.add(bar);reveal(rec,bar,.90+j*.09,.24)}
        }else if(i===1){
          const top=box(rec,"triple-grid",.18,.035,.022,0x76ddea,.58),bottom=box(rec,"triple-grid",.18,.035,.022,0x2488ff,.46);top.position.set(x,.22,.09);bottom.position.set(x,.10,.09);rec.visual.add(top,bottom);reveal(rec,top,1.02,.26);reveal(rec,bottom,1.14,.26);
        }else{
          for(let j=0;j<3;j++){const value=node(rec,.025+j*.006,j===2?0xd7b66d:0x76ddea,.64);value.position.set(x-.07+j*.07,.16+(j%2)*.07,.09);rec.visual.add(value);reveal(rec,value,1.06+j*.10,.25)}
        }
        if(i){const path=link(rec,new THREE.Vector3(stagePoints[i-1].x+.17,.15,.05),new THREE.Vector3(x-.17,.15,.05),0xd7b66d,.009,.48);rec.visual.add(path);reveal(rec,path,1.45+i*.14,.28)}
      }
      for(let i=0;i<4;i++){
        const slot=frame(rec,.20,.16,i===3?0xd7b66d:0x76ddea,.70);slot.position.set(-.33+i*.22,-.27,.08);rec.visual.add(slot);reveal(rec,slot,1.92+i*.12,.30);
      }
      const guide=label(rec,"SOLVE SEPARATELY","CONNECT LEFT → RIGHT","#d7b66d",.72);guide.position.set(0,-.50,.12);rec.visual.add(guide);reveal(rec,guide,2.48,.42);
    }
    function buildReveal(rec){
      const panel=box(rec,"reveal-panel",1.05,.52,.035,0x07111b,.90);panel.position.y=.03;rec.visual.add(panel);reveal(rec,panel,.74,.44);
      const hidden=label(rec,"HIDDEN TRACE","PARTIAL SIGNAL","#d7b66d",.64);hidden.position.set(0,.02,.08);rec.visual.add(hidden);reveal(rec,hidden,2.15,.50);
      const sweep=box(rec,"reveal-sweep",.055,.60,.018,0x76ddea,.42);sweep.position.set(-.54,.03,.10);rec.visual.add(sweep);reveal(rec,sweep,1.10,.28);
      rec.tickers.push((elapsed)=>{const p=phase(elapsed,1.25,1.15);sweep.position.x=-.54+1.08*p;hidden.material.opacity=.12+.82*p});
    }
    function buildDecode(rec){
      if(rec.node.visual?.variant==="TWO_STAGE"){buildTwoStageDecode(rec);return}
      const center=node(rec,.105,0xd7b66d,.92);center.position.y=.03;rec.visual.add(center);reveal(rec,center,1.24,.46);pulse(rec,center,2.0,.07,3.8);
      [-.54,-.33,.33,.54].forEach((x,index)=>{const slot=frame(rec,.16,.25,index<2?0x2488ff:0x76ddea,.62);slot.position.set(x,.03,.06);rec.visual.add(slot);reveal(rec,slot,.72+index*.15,.34);const end=index<2?new THREE.Vector3((index===0?-.12:-.12),.03,.05):new THREE.Vector3(.12,.03,.05);const path=link(rec,new THREE.Vector3(x+(index<2?.09:-.09),.03,.05),end,index<2?0x2488ff:0x76ddea,.010,.46);rec.visual.add(path);reveal(rec,path,1.40+index*.10,.30)});
    }
    function buildTwoStageDecode(rec){
      const leftFrame=frame(rec,.48,.39,0x76ddea,.66),rightFrame=frame(rec,.48,.39,0xd7b66d,.66);
      leftFrame.position.set(-.29,.17,.06);rightFrame.position.set(.29,.17,.06);rec.visual.add(leftFrame,rightFrame);reveal(rec,leftFrame,.68,.38);reveal(rec,rightFrame,.84,.38);
      const leftNodes=[new THREE.Vector3(-.41,.23,.09),new THREE.Vector3(-.28,.10,.09),new THREE.Vector3(-.15,.24,.09)];
      leftNodes.forEach((point,index)=>{const item=node(rec,.028,index===2?0xd7b66d:0x76ddea,.72);item.position.copy(point);rec.visual.add(item);reveal(rec,item,1.02+index*.10,.25);if(index){const path=link(rec,leftNodes[index-1],point,0x76ddea,.008,.36);rec.visual.add(path);reveal(rec,path,1.26+index*.10,.23)}});
      const star=ring(rec,.065,.014,0xd7b66d,.86);star.position.set(.29,.17,.10);rec.visual.add(star);reveal(rec,star,1.10,.28);pulse(rec,star,1.55,.10,4.2);
      const ruleA=box(rec,"rule-line",.16,.022,.02,0x2488ff,.60),ruleB=box(rec,"rule-line",.11,.022,.02,0xf4fbff,.62);ruleA.position.set(.29,.27,.09);ruleB.position.set(.29,.07,.09);rec.visual.add(ruleA,ruleB);reveal(rec,ruleA,1.18,.26);reveal(rec,ruleB,1.30,.26);
      for(let i=0;i<4;i++){
        const slot=frame(rec,.20,.17,i>1?0xd7b66d:0x76ddea,.70);slot.position.set(-.33+i*.22,-.25,.08);rec.visual.add(slot);reveal(rec,slot,1.78+i*.12,.30);
      }
      const leftPath=link(rec,new THREE.Vector3(-.29,-.04,.05),new THREE.Vector3(-.22,-.16,.05),0x76ddea,.009,.42),rightPath=link(rec,new THREE.Vector3(.29,-.04,.05),new THREE.Vector3(.22,-.16,.05),0xd7b66d,.009,.42);rec.visual.add(leftPath,rightPath);reveal(rec,leftPath,1.62,.26);reveal(rec,rightPath,1.72,.26);
      const guide=label(rec,"TWO RESULTS","CONNECT IN ORDER","#76ddea",.66);guide.position.set(0,-.49,.12);rec.visual.add(guide);reveal(rec,guide,2.42,.40);
    }
    function buildObserve(rec){
      const positions=[[-.37,.22],[.37,.22],[-.37,-.22],[.37,-.22]];
      const center=new THREE.Vector3(0,0,.14);
      positions.forEach(([x,y],index)=>{
        const screen=frame(rec,.38,.27,index===3?0xd7b66d:0x76ddea,.66);screen.position.set(x,y,.06);rec.visual.add(screen);reveal(rec,screen,.66+index*.13,.38);
        const scan=box(rec,"observe-scan",.27,.018,.018,index===3?0xd7b66d:0x2488ff,.58);scan.position.set(x,y,.09);rec.visual.add(scan);reveal(rec,scan,.88+index*.13,.28);
        const path=link(rec,new THREE.Vector3(x+(x<0?.18:-.18),y+(y<0?.08:-.08),.07),center,index===3?0xd7b66d:0x76ddea,.009,index===3?.68:.36);rec.visual.add(path);reveal(rec,path,1.32+index*.12,.32);
        rec.tickers.push((elapsed)=>{scan.position.y=y+Math.sin(elapsed*2.2+index*.9)*.07});
      });
      const common=ring(rec,.105,.014,0xd7b66d,.88);common.position.copy(center);rec.visual.add(common);reveal(rec,common,1.90,.42);pulse(rec,common,2.25,.10,3.8);
      const signal=node(rec,.036,0xf4fbff,.96);signal.position.copy(center);rec.visual.add(signal);reveal(rec,signal,2.04,.32);pulse(rec,signal,2.35,.14,4.6);
    }
    function buildPrefix(rec){
      const common=new THREE.Vector3(-.50,.02,.12);
      const core=node(rec,.058,0xd7b66d,.94);core.position.copy(common);rec.visual.add(core);reveal(rec,core,.76,.38);pulse(rec,core,1.25,.12,4.0);
      for(let i=0;i<5;i++){
        const y=.29-i*.145;
        const prefix=frame(rec,.13,.105,i===4?0xd7b66d:0x76ddea,.74);prefix.position.set(-.18,y,.08);rec.visual.add(prefix);reveal(rec,prefix,.84+i*.11,.30);
        const stem=box(rec,"prefix-word-stem",.38,.072,.026,0x2488ff,.34);stem.position.set(.16,y,.06);rec.visual.add(stem);reveal(rec,stem,1.02+i*.11,.30);
        const path=link(rec,common,new THREE.Vector3(-.25,y,.075),i===4?0xd7b66d:0x76ddea,.009,i===4?.68:.34);rec.visual.add(path);reveal(rec,path,1.28+i*.12,.28);
      }
      const guide=label(rec,"ONE POSITION","SHARED TRANSFORM","#76ddea",.64);guide.position.set(.06,-.49,.10);rec.visual.add(guide);reveal(rec,guide,2.10,.44);
    }
    function buildMotionGuide(rec){
      const center=new THREE.Vector3(0,.02,.08);const core=node(rec,.085,0xd7b66d,.95);core.position.copy(center);rec.visual.add(core);reveal(rec,core,1.45,.44);pulse(rec,core,2.1,.08,3.8);
      for(let i=0;i<6;i++){
        const angle=i/6*Math.PI*2+Math.PI/6;const point=new THREE.Vector3(Math.cos(angle)*.52,Math.sin(angle)*.43+.02,.06);
        const item=node(rec,.042,0x76ddea,.88);item.position.copy(point);rec.visual.add(item);reveal(rec,item,.68+i*.10,.34);
        const path=link(rec,point,center,0x76ddea,.010,.42);rec.visual.add(path);reveal(rec,path,1.30+i*.10,.36);
      }
    }
    function buildCodeRail(rec){
      const title=label(rec,"8 MISSIONS · 8 VALUES","1 FINAL CODE","#d7b66d",.88);title.position.set(0,.56,.08);rec.visual.add(title);reveal(rec,title,.72,.44);
      for(let i=0;i<8;i++){
        const row=i<4?0:1,col=i%4;const slot=frame(rec,.24,.23,i===7?0xd7b66d:0x76ddea,.72);
        slot.position.set(-.42+col*.28,.20-row*.31,.08);rec.visual.add(slot);reveal(rec,slot,.95+i*.16,.34);
        const dot=node(rec,.017,i===7?0xd7b66d:0x76ddea,.84);dot.position.set(slot.position.x,slot.position.y,.11);rec.visual.add(dot);reveal(rec,dot,1.15+i*.16,.24);
      }
    }
    function bookIcon(rec){
      const book=new THREE.Group();
      const left=box(rec,"book-cover",.34,.43,.035,0xd7b66d,.72),right=box(rec,"book-cover",.34,.43,.035,0xd7b66d,.72);
      left.position.x=-.18;right.position.x=.18;book.add(left,right);
      const spine=box(rec,"book-spine",.025,.45,.045,0xf4fbff,.62);book.add(spine);
      rec.tickers.push((elapsed)=>{const p=easeOut(phase(elapsed,1.18,.72));left.rotation.y=-p*.86;right.rotation.y=p*.86;left.position.x=-.18-.06*p;right.position.x=.18+.06*p});
      return book;
    }
    function buildSequenceReveal(rec){
      const book=bookIcon(rec);book.position.set(0,.39,.09);book.scale.set(.58,.58,.58);rec.visual.add(book);reveal(rec,book,.68,.44,.58);
      const panels=[];
      for(let i=0;i<4;i++){
        const x=-.48+i*.32;const banner=new THREE.Group();banner.position.set(x,-.04,.08);rec.visual.add(banner);
        const panel=box(rec,"banner-panel",.24,.38,.028,0x16303c,.80);banner.add(panel);
        const cap=box(rec,"banner-cap",.27,.026,.04,i===3?0xd7b66d:0x76ddea,.74);cap.position.y=.20;banner.add(cap);
        const slot=frame(rec,.18,.13,0xd7b66d,.74);slot.position.y=-.11;banner.add(slot);
        reveal(rec,banner,1.42+i*.18,.42);panels.push({banner,panel,slot});
      }
      const sweep=box(rec,"uv-sweep",.045,.56,.022,0x76ddea,.46);sweep.position.set(-.70,-.03,.14);rec.visual.add(sweep);reveal(rec,sweep,2.15,.28);
      rec.tickers.push((elapsed)=>{
        const p=phase(elapsed,2.25,1.40);sweep.position.x=-.70+1.40*p;
        panels.forEach(({panel,slot},i)=>{const on=p>(i+.2)/4;panel.material.color.setHex(on?0x28556b:0x16303c);slot.material.opacity=on?.92:.32});
      });
      const rail=label(rec,"FOUR POINTS","ONE FROM EACH","#d7b66d",.72);rail.position.set(0,-.48,.12);rec.visual.add(rail);reveal(rec,rail,3.35,.48);
    }
    function human(rec,x,index){
      const group=new THREE.Group();group.position.set(x,.08,.03);
      const matColor=index===2?0x47616b:0x30444d;
      const head=node(rec,.045,matColor,.25);head.position.y=.19;group.add(head);
      const body=box(rec,"human-body",.10,.27,.045,matColor,.25);body.position.y=.02;group.add(body);
      return group;
    }
    function buildSearch(rec){
      for(let i=0;i<5;i++){const figure=human(rec,-.54+i*.27,i);rec.visual.add(figure);reveal(rec,figure,.64+i*.09,.32,.82)}
      const object=new THREE.Group();object.position.set(.20,-.08,.16);rec.visual.add(object);
      const board=box(rec,"field-log",.34,.45,.045,0x263541,.92);object.add(board);
      const border=frame(rec,.35,.46,0x76ddea,.88);border.position.z=.03;object.add(border);
      const clip=box(rec,"field-clip",.13,.045,.06,0xd7b66d,.90);clip.position.set(0,.23,.02);object.add(clip);
      const backNode=node(rec,.035,0x76ddea,.96);backNode.position.set(.09,-.08,-.055);object.add(backNode);pulse(rec,backNode,3.6,.16,5.0);
      reveal(rec,object,1.55,.52,.82);
      const objectGlow=glow(rec,"rgba(118,221,234,1)",.72,.52);objectGlow.position.set(.20,-.08,.04);rec.visual.add(objectGlow);reveal(rec,objectGlow,1.72,.48,.72);
      rec.tickers.push((elapsed)=>{const p=easeOut(phase(elapsed,2.15,1.45));object.rotation.y=p*Math.PI;object.position.x=.20-.20*p;objectGlow.position.x=object.position.x;objectGlow.material.opacity=.28+.25*Math.sin(elapsed*3.2)**2});
      const signal=label(rec,"NEAR FIELD","PERSISTENT OBJECT","#76ddea",.72);signal.position.set(0,-.52,.11);rec.visual.add(signal);reveal(rec,signal,3.42,.45);
    }

    const BUILDERS=Object.freeze({
      COMPARE:buildCompare,RELATION:buildRelation,ORDER:buildOrder,SEARCH:buildSearch,
      COMBINE:buildCombine,REVEAL:buildReveal,DECODE:buildDecode,OBSERVE:buildObserve,PREFIX:buildPrefix,MOTION_GUIDE:buildMotionGuide,
      CODE_RAIL:buildCodeRail,SEQUENCE_REVEAL:buildSequenceReveal
    });

    function projectMarker(rec){
      const camera=hintScene?.camera,marker=rec.marker;
      const canvas=hintScene?.canvas||document.querySelector("#arScene canvas")||document.querySelector(".a-canvas");
      const rect=canvas?.getBoundingClientRect?.();
      if(!camera||!marker||!rect||rect.width<2||rect.height<2)return null;
      try{
        marker.object3D.updateMatrixWorld(true);camera.updateMatrixWorld(true);
        const matrix=marker.object3D.matrixWorld;
        const center=tempCenter.set(0,0,0).applyMatrix4(matrix).clone();
        const left=tempLeft.set(-.5,0,0).applyMatrix4(matrix).clone();
        const right=tempRight.set(.5,0,0).applyMatrix4(matrix).clone();
        const centerNdc=center.clone().project(camera),leftNdc=left.clone().project(camera),rightNdc=right.clone().project(camera);
        if(!Number.isFinite(centerNdc.x)||Math.abs(centerNdc.z)>2)return null;
        const x=rect.left+(centerNdc.x+1)*rect.width*.5,y=rect.top+(1-centerNdc.y)*rect.height*.5;
        const lx=rect.left+(leftNdc.x+1)*rect.width*.5,ly=rect.top+(1-leftNdc.y)*rect.height*.5;
        const rx=rect.left+(rightNdc.x+1)*rect.width*.5,ry=rect.top+(1-rightNdc.y)*rect.height*.5;
        const markerPixels=Math.hypot(rx-lx,ry-ly);
        camera.getWorldPosition(cameraPosition);
        const worldOnRay=centerNdc.clone();worldOnRay.z=.05;worldOnRay.unproject(camera);
        const localPoint=cameraPosition.clone().add(worldOnRay.sub(cameraPosition).normalize().multiplyScalar(1.45));
        camera.worldToLocal(localPoint);
        return {position:localPoint,scale:clamp(markerPixels/rect.width*2.45,.58,1.14),screen:{x,y,size:clamp(markerPixels*2.05,285,450)}};
      }catch(error){return null}
    }
    function updateAnchor(rec){
      if(rec.source==="operator"){
        rec.root.position.lerp(new THREE.Vector3(0,0,-1.45),.20);rec.root.scale.lerp(new THREE.Vector3(.82,.82,.82),.18);
        const canvas=hintScene?.canvas||document.querySelector("#arScene canvas"),rect=canvas?.getBoundingClientRect?.();
        if(rect)rec.screenAnchor={x:rect.left+rect.width/2,y:rect.top+rect.height/2,size:clamp(rect.width*.76,290,430)};
        return;
      }
      const projection=projectMarker(rec);
      if(!projection)return;
      rec.root.position.lerp(projection.position,rec.anchorReady?.28:1);
      const scaleVector=new THREE.Vector3(projection.scale,projection.scale,projection.scale);
      rec.root.scale.lerp(scaleVector,rec.anchorReady?.24:1);rec.anchorReady=true;rec.screenAnchor=projection.screen;
    }
    function countObjects(rec){let count=0;rec.visual.traverse(item=>{if(item.visible&&(item.isMesh||item.isLine||item.isPoints||item.isSprite))count++});return count}
    function loop(now){
      raf=0;fpsFrames++;
      if(now-fpsStamp>=1000){state.fps=Math.round(fpsFrames*1000/(now-fpsStamp));fpsFrames=0;fpsStamp=now}
      let objects=0;
      records.forEach(rec=>{
        if(rec.token.cancelled)return;
        updateAnchor(rec);const elapsed=(now-rec.started)/1000;
        rec.tickers.forEach(ticker=>ticker(elapsed,now));objects+=countObjects(rec);
      });
      state.activeObjects=objects;updateDOMAnchor();renderDiagnostics();
      if(records.size)raf=requestAnimationFrame(loop);
    }
    function ensureLoop(){if(!raf)raf=requestAnimationFrame(loop)}
    function create(node,marker,source,token){
      if(!hintScene?.camera||!global.THREE||!PRESETS.has(node.visualPreset)||!BUILDERS[node.visualPreset])return null;
      dispose(node.id);
      const root=new THREE.Group(),visual=new THREE.Group();root.add(visual);root.renderOrder=18;visual.renderOrder=18;
      const rec={node,marker,source,token,root,visual,materials:new Set(),ownedGeometry:new Set(),tickers:[],timers:new Set(),started:performance.now(),screenAnchor:null,anchorReady:false};
      root.position.set(0,0,-1.45);root.scale.set(.78,.78,.78);hintScene.camera.add(root);records.set(node.id,rec);
      addBase(rec);BUILDERS[node.visualPreset](rec);updateAnchor(rec);ensureLoop();return rec;
    }
    function dispose(id){
      const rec=records.get(id);if(!rec)return;
      rec.token.cancelled=true;rec.timers.forEach(clearTimeout);rec.timers.clear();
      rec.root.parent?.remove(rec.root);rec.materials.forEach(value=>value.dispose());rec.ownedGeometry.forEach(value=>value.dispose());
      records.delete(id);if(!records.size&&raf){cancelAnimationFrame(raf);raf=0;state.activeObjects=0}
    }
    function resetAll(){[...records.keys()].forEach(dispose)}
    function setLevelVisual(id,nextLevel){
      const rec=records.get(id);if(!rec)return;
      rec.materials.forEach(value=>{if(nextLevel===2&&value.color&&value.color.getHex()===0x76ddea)value.color.setHex(0xd7b66d)});
      const pulseGlow=glow(rec,"rgba(215,182,109,1)",1.0,.58);pulseGlow.position.z=.16;rec.visual.add(pulseGlow);reveal(rec,pulseGlow,0,.32,.88);
      const born=performance.now();rec.tickers.push((_elapsed,now)=>{const p=phase((now-born)/1000,0,.65);pulseGlow.material.opacity=.58*(1-p);pulseGlow.scale.setScalar(.4+1.35*p)});
    }
    return {create,dispose,resetAll,setLevelVisual,record:id=>records.get(id)||null,builders:BUILDERS};
  })();

  function schedule(rec,callback,delay){
    const timer=setTimeout(()=>{rec.timers.delete(timer);if(!rec.token.cancelled)callback()},delay);
    rec.timers.add(timer);return timer;
  }

  function run(id,source="operator",requestedLevel=1){
    const node=REGISTRY[id];
    if(!node||!node.enabled||node.implementation!=="COMPLETE")return false;
    if(typeof current!=="undefined"&&current)return false;
    if(activeId===id&&HintFX.record(id))return true;
    cancel("route-change",false);
    if(typeof spatialKey!=="undefined"&&spatialKey){global.__KEY_LENS_FX__?.setVisible?.(spatialKey,false);if(typeof hideSpatial==="function")hideSpatial()}
    if(typeof lostTimers!=="undefined")Object.values(lostTimers).forEach(clearTimeout);
    const token={id:++serial,nodeId:id,source,cancelled:false};
    const marker=markerById.get(id)||null;
    const rec=HintFX.create(node,marker,source,token);
    if(!rec){state.assetErrors.push(`${id}: 3D ENGINE NOT READY`);renderDiagnostics();return false}
    activeId=id;level=1;state.lastTarget=`${id} ${source==="marker"?"FOUND":"TEST"}`;state.route=nodeRoute(id);state.level=1;
    showDOM(node,1);setHintHud(node,1);
    if(typeof tone==="function")tone(820,.07,.022);navigator.vibrate?.(35);
    schedule(rec,()=>{if(activeId===id&&level===1)setHintHud(node,1)},520);
    if(requestedLevel===2&&canUseLevel2(node))schedule(rec,()=>setLevel(2,"operator"),650);
    renderDiagnostics();return true;
  }

  function setLevel(nextLevel=2,source="participant"){
    if(!activeId||nextLevel!==2)return false;
    if(level===2)return true;
    const node=REGISTRY[activeId];if(!node||!canUseLevel2(node))return false;
    level=2;state.level=2;showDOM(node,2);setHintHud(node,2);HintFX.setLevelVisual(activeId,2);
    state.route=`${nodeRoute(activeId)} / LEVEL 2 (${source.toUpperCase()})`;
    if(typeof tone==="function")tone(1040,.09,.026);navigator.vibrate?.([30,25,45]);renderDiagnostics();return true;
  }

  function cancel(reason="cancel",restore=true){
    if(!activeId)return;
    const id=activeId,rec=HintFX.record(id);if(rec)rec.token.cancelled=true;
    HintFX.dispose(id);activeId=null;level=1;state.level=0;state.route=`IDLE / ${reason.toUpperCase()}`;hideDOM();
    if(restore)restoreScannerHud();renderDiagnostics();
  }

  function resetAll(options={}){
    hintLostTimers.forEach(clearTimeout);hintLostTimers.clear();visibleMarkers.clear();
    if(activeId)cancel("reset",false);HintFX.resetAll();activeId=null;level=1;state.level=0;state.lastTarget="NONE";state.route="IDLE";state.activeObjects=0;hideDOM();
    if(options.hud!==false)restoreScannerHud("SYSTEM RESET");renderDiagnostics();
  }

  function handleMarkerFound(node,marker){
    clearTimeout(hintLostTimers.get(node.id));hintLostTimers.delete(node.id);visibleMarkers.add(node.id);
    state.lastTarget=`${node.id} FOUND`;state.route=nodeRoute(node.id);renderDiagnostics();
    if(typeof scannerStarted!=="undefined"&&scannerStarted)run(node.id,"marker",1);
  }
  function handleMarkerLost(node){
    visibleMarkers.delete(node.id);state.lastTarget=`${node.id} LOST`;renderDiagnostics();
    clearTimeout(hintLostTimers.get(node.id));
    const timer=setTimeout(()=>{hintLostTimers.delete(node.id);if(activeId===node.id)cancel("target-lost",true)},900);hintLostTimers.set(node.id,timer);
  }

  function mountNode(node){
    if(!markerRoot)return;
    const marker=document.createElement("a-marker");
    marker.id=`hint-marker-${node.id}`;marker.setAttribute("type","pattern");marker.setAttribute("url",patternUrl(node));marker.setAttribute("size",String(CONFIG.tracking?.markerSize||1));
    marker.setAttribute("emitevents","true");marker.setAttribute("smooth","true");marker.setAttribute("smooth-count","5");marker.setAttribute("smooth-tolerance","0.01");marker.setAttribute("smooth-threshold","2");
    marker.dataset.hintId=node.id;marker.addEventListener("markerFound",()=>handleMarkerFound(node,marker));marker.addEventListener("markerLost",()=>handleMarkerLost(node));
    markerRoot.appendChild(marker);markerById.set(node.id,marker);
  }

  async function verifyNodeAssets(){
    await Promise.all(mountedNodes.map(async node=>{
      try{
        const response=await fetch(patternUrl(node),{cache:"force-cache"});if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const text=await response.text();const values=text.trim().split(/\s+/).map(Number);
        if(values.length!==16*16*12||values.some(value=>!Number.isFinite(value)||value<0||value>255))throw new Error("INVALID PATTERN DATA");
        state.assetState[node.id]="LOADED";
      }catch(error){state.assetState[node.id]="NODE LOAD ERROR";state.assetErrors.push(`${node.id}: ${error.message}`);console.error("KEY LENS HINT NODE LOAD ERROR",node.id,error)}
      renderDiagnostics();
    }));
    global.dispatchEvent(new CustomEvent("keylenshintassets",{detail:{...state.assetState}}));
  }

  function installOperator(){
    const root=document.querySelector("#hintOperator");if(!root)return;
    const operatorPanel=document.querySelector("#operator");
    if(diagnosticMode&&operatorPanel)operatorPanel.style.display="block";
    if(diagnosticMode&&!operatorMode)document.querySelectorAll("#operator > button").forEach(button=>button.style.display="none");
    if(!operatorMode){root.style.display="none";return}
    const rounds=[...new Set(mountedNodes.map(node=>node.round))].sort();
    root.innerHTML=`<div class="hintOpTitle">HINT TEST · ${escapeHTML(state.activeGroup)}</div>${rounds.map(round=>
      `<div class="micro">ROUND ${round}</div>${mountedNodes.filter(node=>node.round===round).map(node=>`<button type="button" data-hint-test="${escapeHTML(node.id)}">${escapeHTML(node.id)} · ${escapeHTML(node.visualPreset)}</button>`).join("")}`
    ).join("")}`;
    root.style.display="block";
    root.querySelectorAll("[data-hint-test]").forEach(button=>button.addEventListener("click",()=>run(button.dataset.hintTest,"operator",1)));
  }

  function renderDiagnostics(){
    const diag=document.querySelector("#hintDiag");if(!diag||!diagnosticMode)return;
    const cameraOk=typeof cameraReady!=="undefined"&&cameraReady;
    const trackerOk=typeof trackingReady==="function"&&trackingReady();
    const loaded=Object.values(state.assetState).filter(value=>value==="LOADED").length;
    diag.textContent=[
      `CAMERA: ${cameraOk?"READY":"WAIT"}`,
      `TRACKER: ${trackerOk?"READY":"WAIT"}`,
      `MAIN TARGETS: ${typeof NFT_TARGETS!=="undefined"?NFT_TARGETS.length:5}`,
      `HINT NODES: ${state.mountedNodes}/${state.totalNodes}`,
      `NODE ASSETS: ${loaded}/${state.mountedNodes}`,
      `ACTIVE GROUP: ${state.activeGroup}`,
      `LAST TARGET: ${state.lastTarget}`,
      `ROUTE: ${state.route}`,
      `FPS: ${state.fps||"—"}`,
      `ACTIVE OBJECTS: ${state.activeObjects}`,
      state.assetErrors.length?`NODE LOAD ERROR: ${state.assetErrors.join(" | ")}`:"NODE LOAD ERROR: NONE"
    ].join("\n");
  }

  function installMainLifecycleBridge(){
    if(typeof markerFound==="function"){
      const mainFound=markerFound;
      markerFound=function(key){if(activeId)cancel("main-target",false);return mainFound(key)};
    }
    if(typeof markerLost==="function"){
      const mainLost=markerLost;
      markerLost=function(key){
        mainLost(key);
        if(!activeId)return;
        if(typeof lostTimers!=="undefined"){
          clearTimeout(lostTimers[key]);
          lostTimers[key]=setTimeout(()=>{
            global.__KEY_LENS_FX__?.setVisible?.(key,false);
            if(typeof resetGroup==="function")resetGroup(key);
            if(typeof hideSpatial==="function")hideSpatial(key);
          },1200);
        }
      };
    }
    if(typeof enterScanner==="function"){
      const mainEnter=enterScanner;
      enterScanner=function(){
        const was=typeof scannerStarted!=="undefined"&&scannerStarted;mainEnter();
        if(!was&&typeof scannerStarted!=="undefined"&&scannerStarted&&visibleMarkers.size){const id=[...visibleMarkers][0];setTimeout(()=>run(id,"marker",1),0)}
      };
    }
    document.querySelector("#operator-reset")?.addEventListener("click",()=>resetAll({hud:false}));
  }

  function initialize(){
    if(!markerRoot||!hintScene){state.assetErrors.push("HINT MARKER ROOT MISSING");renderDiagnostics();return}
    mountedNodes.forEach(mountNode);installOperator();installMainLifecycleBridge();void verifyNodeAssets();renderDiagnostics();
  }

  global.__KEY_LENS_HINT_PROTOCOL__={
    run,cancel,resetAll,setLevel,state,registry:REGISTRY,config:CONFIG,
    visualBuilders:HintFX.builders,
    markerFound:id=>{const node=REGISTRY[id],marker=markerById.get(id);if(node&&marker)handleMarkerFound(node,marker)},
    markerLost:id=>{const node=REGISTRY[id];if(node)handleMarkerLost(node)}
  };
  global.addEventListener("beforeunload",()=>{resetAll({hud:false});patternUrls.forEach(url=>{if(url.startsWith("blob:"))URL.revokeObjectURL(url)})},{once:true});
  initialize();
})(window);
