/* MALIK ARCADE — Vanilla JavaScript arcade. No frameworks, cookies, APIs or backend. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const canvas = $('game-canvas');
  const ctx = canvas.getContext('2d');
  const W = 400, H = 620, GROUND = 595, KEY = 'malik-arcade-save-v1';
  ctx.setTransform(2, 0, 0, 2, 0, 0); // 2x canvas resolution, scaled via CSS.
  const gameNames = {flappy:'Flappy Malik',dash:'Malik Dash',catch:'Malik Love Rush',match:'Malik Match',whack:'Pop the Malik'};
  const gameMeta = {
    flappy:{tag:'01 / ENDLESS FLIGHT',heading:'Just keep flapping.',description:'Tap or press Space to fly through the gaps. Snag hearts, find shields, and survive the speed ramp.',tips:['Tap / Space = flap','Hearts = collectibles','Stars = shields'],hint:'TAP / SPACE TO FLAP ✦',start:'Start flying',intro:'Tap to fly. Dodge the pipes, collect hearts, and try not to embarrass him.'},
    dash:{tag:'02 / RUN & DODGE',heading:'Dodge like a legend.',description:'Swipe left/right or use the arrow keys to change lanes. Avoid the blocks. Collect hearts. You get three hits.',tips:['Swipe to steer','3 lives','Collect hearts'],hint:'SWIPE LEFT / RIGHT OR USE ← →',start:'Start running',intro:'Three lanes. Three lives. Way too many obstacles. Swipe left or right to dodge.'},
    catch:{tag:'03 / 45-SECOND CHALLENGE',heading:'Catch the love.',description:'Drag his face left and right. Catch hearts and stars, avoid the bombs, and build a multiplier before time runs out.',tips:['Drag to move','Avoid bombs','45 seconds'],hint:'DRAG / MOVE TO CATCH ♥',start:'Start catching',intro:'Catch the hearts and stars! Watch out for the bombs. You have 45 seconds.'},
    match:{tag:'04 / MEMORY PUZZLE',heading:'You know Malik, right?',description:'Flip two cards at a time. Match their colored emoji + face combinations as fast as possible.',tips:['Flip two cards','Find pairs','Beat your time'],hint:'TAP ANY TWO CARDS TO FLIP',start:'Shuffle & play',intro:'Find all eight matching pairs of Malik. Try to finish with the fewest moves.'},
    whack:{tag:'05 / 30-SECOND CHALLENGE',heading:"Malik is literally everywhere.",description:'Tap Malik before he disappears. Avoid the faces marked with bombs and rack up combos.',tips:['Tap faces','Avoid 💣','30 seconds'],hint:'TAP THE FACES, NOT THE BOMBS',start:'Start whacking',intro:'Malik keeps popping up. Tap Malik, dodge the bomb versions of Malik, and build your combo.'}
  };

  const blankSave = () => ({hearts:0,plays:{},best:{},skin:'photo',sound:true,reducedMotion:false,achievements:{}});
  let saveData = blankSave();
  try {
    const old = JSON.parse(localStorage.getItem(KEY) || '{}');
    saveData = {...blankSave(),...old,plays:{...(old.plays||{})},best:{...(old.best||{})},achievements:{...(old.achievements||{})}};
  } catch(e) { /* Private browsing may restrict storage: game still works. */ }
  const persist = () => {try{localStorage.setItem(KEY,JSON.stringify(saveData));}catch(e){}};
  const facePhoto = new Image();facePhoto.src='assets/face.png';
  const faceWinged = new Image();faceWinged.src='assets/face-winged.png';
  const skyImage = new Image();skyImage.src='assets/sky.webp';
  let mode='home', phase='idle', engine=null, sessionTimers=[], animationTime=0, previousFrame=0, pointerStart=null, audioCtx=null;
  let currentOverlayAction = null;
  let lastScoreText = '', lastExtraText = '';
  const rand=(a,b)=>a+Math.random()*(b-a);
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const pad=(n)=>String(Math.max(0,n)).padStart(2,'0');
  const timeText=(s)=>`${Math.floor(s/60)}:${pad(Math.floor(s%60))}`;
  const formatBest=(m)=>m==='match'?(saveData.best.match?timeText(saveData.best.match):'–'):(saveData.best[m]||0);

  const trophies = [
    ['first-flight','🪽','Malik Takes Flight','Set a Flappy Malik record'],
    ['flappy-10','🚀','Pipe Pro Malik','Clear 10 pipes in one flight'],
    ['dash-150','⚡','Speedster Malik','Reach 150 in Malik Dash'],
    ['catch-250','💗','Heart Magnet','Score 250 in Malik Love Rush'],
    ['memory-win','🧠','Malik Memorized','Complete a Malik Match board'],
    ['whack-150','💥','Pop Star Malik','Score 150 in Pop the Malik']
  ];
  function renderTrophies(){
    const shelf=$('trophy-grid'); if(!shelf)return;
    shelf.replaceChildren();
    for(const [id,emoji,title,desc] of trophies){
      const obtained=!!saveData.achievements[id];
      const card=document.createElement('div');card.className='trophy'+(obtained?' trophy-earned':'');
      const graphic=document.createElement('span');graphic.className='trophy-icon';graphic.textContent=obtained?emoji:'🔒';
      const copy=document.createElement('span');copy.className='trophy-copy';
      const heading=document.createElement('strong');heading.textContent=title;
      const sub=document.createElement('small');sub.textContent=obtained?'UNLOCKED · '+desc:desc;
      copy.append(heading,sub);card.append(graphic,copy);shelf.append(card);
    }
  }
  function renderStats() {
    renderTrophies();
    $('wallet-count').textContent=saveData.hearts||0;
    $('total-plays').textContent=Object.values(saveData.plays).reduce((a,b)=>a+b,0);
    $('best-flappy-hero').textContent=saveData.best.flappy||0;
    $('audio-toggle').textContent=saveData.sound?'♫':'♩';
    $('audio-toggle').setAttribute('aria-label',saveData.sound?'Mute sounds':'Unmute sounds');
    $('motion-state').textContent=saveData.reducedMotion?'ON':'OFF';
    document.body.classList.toggle('reduce-motion',!!saveData.reducedMotion);
    document.querySelectorAll('[data-skin]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.skin===saveData.skin)));
  }
  function sound(kind='tap') {
    if(!saveData.sound) return;
    try {
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return;
      audioCtx=audioCtx||new AC();if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});
      const osc=audioCtx.createOscillator(),vol=audioCtx.createGain();
      const now=audioCtx.currentTime, notes={tap:[480,630,.065],coin:[720,1100,.12],hit:[210,85,.2],win:[520,1040,.26],move:[280,420,.045]};
      const [a,b,d]=notes[kind]||notes.tap;
      osc.type=kind==='hit'?'sawtooth':'sine';osc.frequency.setValueAtTime(a,now);osc.frequency.exponentialRampToValueAtTime(b,now+d);
      vol.gain.setValueAtTime(.0001,now);vol.gain.exponentialRampToValueAtTime(.075,now+.006);vol.gain.exponentialRampToValueAtTime(.0001,now+d);
      osc.connect(vol);vol.connect(audioCtx.destination);osc.start(now);osc.stop(now+d+.015);
    } catch(e) {}
  }
  function toast(msg){
    const n=document.createElement('div');n.className='toast';n.textContent=msg;$('toast-area').append(n);
    setTimeout(()=>n.remove(),2400);
  }
  function achievement(id,label){if(saveData.achievements[id])return;saveData.achievements[id]=true;persist();renderTrophies();toast(`🏆 Achievement unlocked: ${label}`);sound('win');}
  function hearts(n){if(n<=0)return;saveData.hearts+=n;persist();renderStats();if(n>=3)toast(`+${n} ♥ hearts collected`);}
  function cancelTimers(){sessionTimers.forEach(t=>{clearInterval(t);clearTimeout(t);});sessionTimers=[];}
  function addTimer(t){sessionTimers.push(t);return t;}

  function syncHud(score,extra=''){
    const scoreString=String(score);
    if(scoreString!==lastScoreText){$('score-value').textContent=scoreString;lastScoreText=scoreString;}
    if(extra!==lastExtraText){$('touch-hint').textContent=extra || gameMeta[mode]?.hint || '';lastExtraText=extra;}
  }
  function showOverlay(kicker,title,message,button,callback,results){
    $('overlay-kicker').textContent=kicker;$('overlay-title').textContent=title;$('overlay-message').textContent=message;
    $('overlay-action').firstChild.textContent=button+' ';currentOverlayAction=callback;
    const r=$('overlay-results');r.replaceChildren();
    if(results?.length){
      results.forEach(([label,value])=>{let item=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=value;small.textContent=label;item.append(strong,small);r.append(item)});
      r.classList.remove('hidden');
    }else r.classList.add('hidden');
    $('game-overlay').classList.remove('hidden');
  }
  function hideOverlay(){$('game-overlay').classList.add('hidden');}
  function updateBest(score){
    if(mode==='match'){
      if(!saveData.best.match||score<saveData.best.match){saveData.best.match=score;persist();return true;}
    }else if(score>(saveData.best[mode]||0)){saveData.best[mode]=score;persist();return true;}
    return false;
  }
  function finishGame(score,detail=''){if(phase!=='running')return;
    phase='finished';cancelTimers();sound('hit');
    const record=updateBest(score);$('best-value').textContent=formatBest(mode);$('side-best').textContent=formatBest(mode);renderStats();
    const title=mode==='match'?(record?'New fastest match! ✦':'Malik matched! 💙'):(record?'New Malik record! ✦':'Game over!');
    const resultValue=mode==='match'?timeText(score):score;
    showOverlay(record?'MALIK RECORD BROKEN':'NICE TRY',title,detail||'Ready to give it another shot?', 'Play again',startGame,[['YOUR SCORE',resultValue],['PERSONAL BEST',formatBest(mode)]]);
    if(record){sound('win');if(mode==='flappy')achievement('first-flight','Malik takes flight');}
    if(mode==='flappy'&&score>=10)achievement('flappy-10','Malik: pipe pro');
    if(mode==='dash'&&score>=150)achievement('dash-150','Malik: road legend');
    if(mode==='catch'&&score>=250)achievement('catch-250','Malik: heart magnet');
    if(mode==='match')achievement('memory-win','Malik memorized');
    if(mode==='whack'&&score>=150)achievement('whack-150','Malik pop star');
  }
  function renderSuggestions(){
    $('suggested-games').replaceChildren();
    Object.keys(gameNames).filter(m=>m!==mode).slice(0,3).forEach(m=>{
      const b=document.createElement('button');b.type='button';b.className='suggested-game';b.textContent=gameNames[m]+'  ↗';b.addEventListener('click',()=>openGame(m));$('suggested-games').append(b);
    });
  }
  function openGame(next){
    if(!gameNames[next])return showHome();
    cancelTimers();engine=null;phase='idle';mode=next;lastScoreText='';lastExtraText='';
    $('home-screen').classList.add('hidden');$('play-screen').classList.remove('hidden');
    $('game-canvas').classList.toggle('hidden',next==='match'||next==='whack');
    $('dom-stage').classList.toggle('hidden',next!=='match'&&next!=='whack');
    $('dom-stage').className='dom-stage'+((next==='match'||next==='whack')?` ${next}-theme`:' hidden');
    $('dom-stage').replaceChildren();
    const meta=gameMeta[next];$('play-title').textContent=gameNames[next];$('play-category').textContent=meta.tag;
    $('info-title').textContent=meta.heading;$('info-text').textContent=meta.description;
    const tips=$('game-tips');tips.replaceChildren();meta.tips.forEach(t=>{const tag=document.createElement('span');tag.textContent='✦ '+t;tips.append(tag)});
    $('score-label').textContent=next==='match'?'PAIRS':next==='dash'?'DISTANCE':'SCORE';
    $('best-label').textContent='BEST';$('best-value').textContent=formatBest(next);$('side-best').textContent=formatBest(next);
    $('pause-btn').textContent='Ⅱ Pause';$('pause-btn').disabled=true;
    syncHud(next==='match'?'0/8':0,meta.hint);
    showOverlay('MALIK ARCADE',gameNames[next],meta.intro,meta.start,startGame);
    renderSuggestions();if(location.hash!==`#${next}`)history.replaceState(null,'',`#${next}`);
    window.scrollTo({top:0,behavior:'instant'});
    if(next==='match'||next==='whack')paintBoardPlaceholder(next);else drawStandby(next);
  }
  function showHome(){cancelTimers();engine=null;phase='idle';mode='home';
    $('home-screen').classList.remove('hidden');$('play-screen').classList.add('hidden');
    if(location.hash!=='#home')history.replaceState(null,'','#home');renderStats();window.scrollTo({top:0,behavior:'instant'});
  }
  function startGame(){if(mode==='home')return;cancelTimers();hideOverlay();phase='running';
    $('pause-btn').disabled=false;$('pause-btn').textContent='Ⅱ Pause';
    saveData.plays[mode]=(saveData.plays[mode]||0)+1;persist();renderStats();lastScoreText='';
    if(mode==='flappy'){engine=new Flappy();engine.flap();}
    if(mode==='dash'){engine=new Dash();}
    if(mode==='catch'){engine=new Catch();}
    if(mode==='match'){engine=new Match();engine.start();}
    if(mode==='whack'){engine=new Whack();engine.start();}
    sound('tap');
  }
  function pause(){if(phase==='running'){
    phase='paused';cancelTimers();$('pause-btn').textContent='▶ Resume';
    showOverlay('QUICK BREATHER','Paused','Malik is taking five. He’ll still be here.', 'Resume game',resume);
  }else if(phase==='paused')resume();}
  function resume(){if(phase!=='paused')return;phase='running';hideOverlay();$('pause-btn').textContent='Ⅱ Pause';previousFrame=0;if(engine?.resume)engine.resume();sound('tap');}
  function paintBoardPlaceholder(which){
    $('dom-stage').innerHTML=which==='match'?'<div class="memory-board" style="--rows:4"><div class="memory-card" aria-hidden="true"></div></div>':'<div class="whack-board"><div class="whack-hole"></div></div>';
  }

  // Graphics helpers; all coordinates are in 400x620 logical pixels.
  function roundRect(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function drawFace(x,y,size,angle=0,wings=false,glow=false){
    const img=saveData.skin==='winged'?faceWinged:facePhoto;
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    if(glow){ctx.shadowColor='#b2dfff';ctx.shadowBlur=17;ctx.fillStyle='#d7f4ff75';ctx.beginPath();ctx.ellipse(0,0,size*.40,size*.40,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
    if(wings&&saveData.skin==='photo'){
      [-1,1].forEach(dir=>{ctx.save();ctx.scale(dir,1);ctx.fillStyle='#f7fcff';ctx.strokeStyle='#579ed5';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(size*.46,-size*.04,size*.27,size*.13,-.4,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#b9ebff';ctx.beginPath();ctx.ellipse(size*.5,size*.09,size*.20,size*.10,.4,0,Math.PI*2);ctx.fill();ctx.restore();});
    }
    if(img.complete&&img.naturalWidth){const width=saveData.skin==='winged'?size:size*.78;ctx.shadowColor='#0d23528a';ctx.shadowBlur=8;ctx.shadowOffsetY=5;ctx.drawImage(img,-width/2,-size/2,width,size);}
    else {ctx.fillStyle='#ffc0aa';ctx.beginPath();ctx.arc(0,0,size*.35,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
  function heart(x,y,r,color='#ff4f9d'){
    ctx.save();ctx.translate(x,y);ctx.scale(r/18,r/18);ctx.fillStyle=color;ctx.strokeStyle='#ffedfa';ctx.lineWidth=1.8;
    ctx.beginPath();ctx.moveTo(0,14);ctx.bezierCurveTo(-21,-2,-17,-13,-7,-13);ctx.bezierCurveTo(-3,-13,0,-9,0,-7);ctx.bezierCurveTo(0,-9,3,-13,7,-13);ctx.bezierCurveTo(17,-13,21,-2,0,14);ctx.fill();ctx.stroke();ctx.restore();
  }
  function star(x,y,r,color='#ffd86b'){
    ctx.save();ctx.translate(x,y);ctx.fillStyle=color;ctx.strokeStyle='#fff9da';ctx.lineWidth=2;
    ctx.beginPath();for(let i=0;i<10;i++){let ang=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.45:r;const px=Math.cos(ang)*rr,py=Math.sin(ang)*rr;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
  function skyBackground(t,night=false){
    if(skyImage.complete&&skyImage.naturalWidth){
      const sourceW=skyImage.height*W/H;
      const travel=Math.sin(t*.00012)*32;
      ctx.drawImage(skyImage,(skyImage.width-sourceW)/2+travel,0,sourceW,skyImage.height,0,0,W,H);
      if(night){ctx.fillStyle='#12235c6e';ctx.fillRect(0,0,W,H);}
    }else{
      const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#338dff');g.addColorStop(1,'#9eeeff');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
      for(let i=0;i<6;i++){ctx.fillStyle='#ffffff85';ctx.beginPath();ctx.ellipse((i*120-t*.016)%500-60,105+i*70,65,22,0,0,Math.PI*2);ctx.fill();}
    }
  }
  function paintLand(scroll){
    ctx.fillStyle='#cde8a6';ctx.fillRect(0,GROUND,W,H-GROUND);
    ctx.fillStyle='#62ad79';ctx.fillRect(0,GROUND,W,7);
    ctx.fillStyle='#98cf79';for(let x=-((scroll*.6)%31);x<W;x+=31)ctx.fillRect(x,GROUND+9,18,3);
  }
  function particle(list,x,y,color,n=6){for(let i=0;i<n;i++)list.push({x,y,vx:rand(-3,3),vy:rand(-4,1),life:rand(15,34),c:color,size:rand(2,5)});}
  function tickParticles(p,dt){for(let i=p.length-1;i>=0;i--){const a=p[i];a.x+=a.vx*dt;a.y+=a.vy*dt;a.vy+=.12*dt;a.life-=dt;if(a.life<=0)p.splice(i,1)}}
  function paintParticles(p){p.forEach(a=>{ctx.globalAlpha=clamp(a.life/30,0,1);ctx.fillStyle=a.c;ctx.beginPath();ctx.arc(a.x,a.y,a.size,0,Math.PI*2);ctx.fill()});ctx.globalAlpha=1;}
  function pipeGraphic(x,y,h,top){if(h<=0)return;
    const grad=ctx.createLinearGradient(x,0,x+70,0);grad.addColorStop(0,'#137c50');grad.addColorStop(.23,'#6bf0a1');grad.addColorStop(.52,'#2aba72');grad.addColorStop(1,'#0b8756');
    roundRect(x+5,y,60,h,5,grad);
    ctx.fillStyle='#ffffff43';ctx.fillRect(x+16,y+6,7,Math.max(0,h-12));
    const capY=top?y+h-24:y;roundRect(x,capY,70,27,6,'#0e7b52');roundRect(x+4,capY+4,62,19,5,'#54df92');
    ctx.fillStyle='#ffffff66';ctx.fillRect(x+13,capY+5,6,16);
  }
  function drawStandby(next){ctx.clearRect(0,0,W,H);if(next==='flappy'){skyBackground(0);paintLand(0);drawFace(115,300,82,-.06,true,true)}else if(next==='dash'){new Dash().draw()}else if(next==='catch'){new Catch().draw()}}

  class Flappy {
    constructor(){this.x=105;this.y=270;this.vy=0;this.t=0;this.pipes=[];this.parts=[];this.spawn=65;this.points=0;this.scroll=0;this.shield=0;this.inv=0;}
    flap(){this.vy=-5.6;particle(this.parts,this.x-15,this.y+16,'#effaff',3);sound('tap');}
    update(dt){
      this.t+=dt;this.scroll+=2.1*dt;this.vy+=.315*dt;this.vy=clamp(this.vy,-8,7.5);this.y+=this.vy*dt;this.inv=Math.max(0,this.inv-dt);
      this.spawn-=dt;
      let speed=2.55+Math.min(2.5,this.points*.065);
      if(this.spawn<=0){
        const gap=clamp(187-this.points*1.12,147,187);
        const center=rand(160+gap/2*.30,GROUND-110-gap/2*.33);
        this.pipes.push({x:W+30,w:70,center,gap,got:false,collect:false,shield:Math.random()<.14,shieldUsed:false,scored:false,phase:rand(0,6.28)});
        this.spawn=Math.max(77,113-this.points*.55);
      }
      for(const p of this.pipes){
        p.x-=speed*dt;
        const shift=this.points>=9?Math.sin(this.t*.023+p.phase)*14:0;
        const low=p.center+shift-p.gap/2,high=p.center+shift+p.gap/2;
        if(!p.scored&&p.x+p.w<this.x-17){p.scored=true;this.points++;sound('coin');particle(this.parts,this.x+20,this.y,'#fff9b0',8);}
        if(!p.collect){let cx=p.x+p.w/2,cy=p.center+shift;
          if(Math.hypot(cx-this.x,cy-this.y)<29){p.collect=true;hearts(1);particle(this.parts,cx,cy,'#ff5aaf',13);sound('coin');}
        }
        if(p.shield&&!p.shieldUsed){let sx=p.x+p.w/2,sy=p.center+shift-46;
          if(Math.hypot(sx-this.x,sy-this.y)<29){p.shieldUsed=true;this.shield=1;particle(this.parts,sx,sy,'#ffffa8',12);sound('win');}
        }
        if(this.inv<=0&&p.x<this.x+21&&p.x+p.w>this.x-21&&(this.y-25<low||this.y+25>high)){
          if(this.shield){this.shield=0;this.inv=85;this.vy=-3;particle(this.parts,this.x,this.y,'#9afaf2',16);sound('win');}
          else {finishGame(this.points,'Malik flew face-first into a pipe. The disrespect.');return;}
        }
      }
      this.pipes=this.pipes.filter(p=>p.x>-90);
      tickParticles(this.parts,dt);
      if(this.y<22||this.y>GROUND-26){finishGame(this.points,'Gravity got Malik again. Another flight?');return;}
      syncHud(this.points,this.shield?'SHIELD ACTIVE ✦   ·   TAP TO FLAP':`TAP TO FLAP   ·   ${this.points>=9?'MOVING PIPES!':'COLLECT ♥'}`);
    }
    draw(){skyBackground(this.t,this.points>=17);paintLand(this.scroll);
      for(const p of this.pipes){const cy=p.center+(this.points>=9?Math.sin(this.t*.023+p.phase)*14:0),top=cy-p.gap/2,bottom=cy+p.gap/2;
        pipeGraphic(p.x,0,top,true);pipeGraphic(p.x,bottom,GROUND-bottom,false);
        if(!p.collect){heart(p.x+35,cy+Math.sin(this.t*.065)*5,15);}
        if(p.shield&&!p.shieldUsed){star(p.x+35,cy-46,18,'#fff36b');}
      }
      if(this.shield||this.inv){ctx.save();ctx.strokeStyle='#f6ffba';ctx.lineWidth=4;ctx.shadowColor='#eeff88';ctx.shadowBlur=24;ctx.beginPath();ctx.arc(this.x,this.y,43,0,Math.PI*2);ctx.stroke();ctx.restore();}
      drawFace(this.x,this.y,69,clamp(this.vy*.085,-.5,.9),true,true);paintParticles(this.parts);
    }
  }

  class Dash {
    constructor(){this.t=0;this.lane=1;this.laneVisual=1;this.objs=[];this.parts=[];this.spawn=47;this.distance=0;this.lives=3;this.inv=0;this.scroll=0;this.y=505;}
    move(dir){if(phase!=='running')return;const newLane=clamp(this.lane+dir,0,2);if(newLane!==this.lane){this.lane=newLane;sound('move');}}
    update(dt){this.t+=dt;this.inv=Math.max(0,this.inv-dt);this.laneVisual+=(this.lane-this.laneVisual)*Math.min(1,.23*dt);
      const sp=3.3+Math.min(3,this.distance/180);this.scroll+=sp*dt;this.distance+=sp*.18*dt;
      this.spawn-=dt;
      if(this.spawn<=0){const first=Math.floor(rand(0,3));this.objs.push({lane:first,y:-50,type:Math.random()<.26?'heart':'block',used:false});
        if(this.distance>60&&Math.random()<.3){const other=(first+Math.floor(rand(1,3)))%3;this.objs.push({lane:other,y:-145,type:'block',used:false});}
        this.spawn=Math.max(36,70-this.distance*.09);
      }
      for(const o of this.objs){o.y+=sp*dt;
        if(!o.used&&Math.abs(o.y-this.y)<43&&o.lane===this.lane){o.used=true;
          if(o.type==='heart'){hearts(1);particle(this.parts,75+o.lane*125,this.y,'#ff81b4',12);sound('coin');}
          else if(this.inv<=0){this.lives--;this.inv=78;particle(this.parts,75+o.lane*125,this.y,'#ff4f8d',15);sound('hit');if(this.lives<=0){finishGame(Math.floor(this.distance),'Malik ran out of lives. The traffic was personal.');return;}}
        }
      }
      this.objs=this.objs.filter(o=>o.y<670&&!o.used);tickParticles(this.parts,dt);
      syncHud(Math.floor(this.distance),`SWIPE ← →   ·   ${'♥'.repeat(this.lives)}${'♡'.repeat(3-this.lives)}`);
    }
    draw(){
      const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#171d55');bg.addColorStop(.56,'#514190');bg.addColorStop(1,'#242351');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#7d78ff24';for(let i=0;i<12;i++){let y=((i*83+this.scroll*.5)%760)-100;ctx.fillRect((i%2)*350+10,y,28,2);}
      roundRect(18,0,364,620,12,'#272d62');ctx.fillStyle='#4e57a5';ctx.fillRect(24,0,4,H);ctx.fillRect(372,0,4,H);
      ctx.save();ctx.setLineDash([32,30]);ctx.lineDashOffset=-this.scroll*3;ctx.strokeStyle='#bbb7ff6e';ctx.lineWidth=4;
      for(const x of [137,262]){ctx.beginPath();ctx.moveTo(x,-30);ctx.lineTo(x,H+30);ctx.stroke();}ctx.restore();
      for(let i=0;i<8;i++){const y=(i*110+this.scroll*2.1)%(H+100)-50;ctx.fillStyle='#ad9fff21';ctx.fillRect(27,y,345,8);}
      for(const o of this.objs){const x=75+o.lane*125;if(o.type==='heart'){heart(x,o.y,22);}else{
        roundRect(x-33,o.y-30,66,62,13,'#f65c88');roundRect(x-27,o.y-25,54,49,10,'#ff7c9d');ctx.fillStyle='#ffdce5';ctx.font='bold 27px system-ui';ctx.textAlign='center';ctx.fillText('✕',x,o.y+12);
      }}
      const faceX=75+this.laneVisual*125;
      ctx.fillStyle='#94f5ff3a';ctx.beginPath();ctx.ellipse(faceX,555,51,12,0,0,Math.PI*2);ctx.fill();
      if(this.inv>0){ctx.fillStyle='#fff7c2';ctx.beginPath();ctx.arc(faceX,this.y,50,0,Math.PI*2);ctx.fill();}
      if(this.inv<1||Math.floor(this.inv/7)%2===0)drawFace(faceX,this.y,78,Math.sin(this.t*.16)*.06,false,true);
      paintParticles(this.parts);
    }
  }

  class Catch {
    constructor(){this.t=0;this.remaining=45;this.x=200;this.target=200;this.objs=[];this.parts=[];this.spawn=20;this.points=0;this.streak=0;this.badHits=0;}
    move(x){this.target=clamp(x,36,W-36);}
    update(dt){this.t+=dt;this.remaining-=dt/60;if(this.remaining<=0){finishGame(this.points,`Time's up! You caught ${this.streak} in your final streak.`);return;}
      this.x+=(this.target-this.x)*Math.min(1,.28*dt);this.spawn-=dt;
      if(this.spawn<=0){const v=Math.random();this.objs.push({x:rand(25,375),y:-35,vy:rand(2.9,4.5)+Math.min(1.5,this.t/300),kind:v<.13?'bomb':v<.24?'star':'heart',angle:rand(0,6.28)});this.spawn=rand(16,27);}
      for(let i=this.objs.length-1;i>=0;i--){const o=this.objs[i];o.y+=o.vy*dt;o.angle+=.022*dt;
        if(Math.abs(o.y-516)<35&&Math.abs(o.x-this.x)<43){
          if(o.kind==='bomb'){this.points=Math.max(0,this.points-15);this.streak=0;this.badHits++;sound('hit');particle(this.parts,o.x,o.y,'#a78bff',14);}
          else{this.streak++;const amount=o.kind==='star'?25:10;this.points+=amount+Math.min(20,Math.floor(this.streak/5)*5);if(o.kind==='star'||this.streak%3===0)hearts(1);sound('coin');particle(this.parts,o.x,o.y,o.kind==='star'?'#ffe27d':'#ff9dce',12);}
          this.objs.splice(i,1);
        }else if(o.y>630){if(o.kind!=='bomb')this.streak=0;this.objs.splice(i,1);}
      }
      tickParticles(this.parts,dt);syncHud(this.points,`TIME ${Math.ceil(this.remaining)}s   ·   COMBO x${this.streak}`);
    }
    draw(){const g=ctx.createLinearGradient(0,0,400,H);g.addColorStop(0,'#522fa8');g.addColorStop(.55,'#a04aa5');g.addColorStop(1,'#fd92b8');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
      for(let i=0;i<18;i++){const x=(i*97)%400,y=(i*149+this.t*.29)%620;ctx.globalAlpha=.25+Math.sin(this.t*.02+i)*.13;star(x,y,i%3===0?8:3,'#ffe7fa');}ctx.globalAlpha=1;
      ctx.fillStyle='#b44c9b44';ctx.beginPath();ctx.ellipse(190,640,450,160,0,0,Math.PI*2);ctx.fill();
      for(const o of this.objs){ctx.save();ctx.translate(o.x,o.y);ctx.rotate(Math.sin(o.angle)*.25);if(o.kind==='bomb'){roundRect(-20,-20,40,40,9,'#3e3268');ctx.font='29px system-ui';ctx.textAlign='center';ctx.fillText('💣',0,11);}else if(o.kind==='star')star(0,0,23);else heart(0,0,22);ctx.restore();}
      ctx.fillStyle='#ffffff53';ctx.beginPath();ctx.ellipse(this.x,573,60,11,0,0,Math.PI*2);ctx.fill();drawFace(this.x,514,89,Math.sin(this.t*.043)*.08,false,true);paintParticles(this.parts);
    }
  }

  const cardSymbols=[
    {mark:'💙',color:'#2773c8'},{mark:'🌈',color:'#ab5cc8'},{mark:'🔥',color:'#e76b68'},{mark:'👑',color:'#d39c33'},
    {mark:'💎',color:'#39969f'},{mark:'🍓',color:'#bc437b'},{mark:'⚡',color:'#8371d3'},{mark:'🦋',color:'#498fba'}
  ];
  class Match {
    constructor(){this.pairs=0;this.turns=0;this.elapsed=0;this.shown=[];this.locked=false;this.cards=[];}
    start(){
      const cards=[...cardSymbols.keys(),...cardSymbols.keys()];
      for(let i=cards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}
      const board=document.createElement('div');board.className='memory-board';board.style.setProperty('--rows','4');
      cards.forEach((id,index)=>{
        const d=cardSymbols[id],button=document.createElement('button');button.type='button';button.className='memory-card';button.setAttribute('aria-label',`Card ${index+1}, face down`);
        button.dataset.symbol=id;
        const inner=document.createElement('span');inner.className='card-inside';inner.style.setProperty('--card-color',d.color);
        const img=document.createElement('img');img.src=saveData.skin==='winged'?'assets/face-winged.png':'assets/face.png';img.alt='';img.draggable=false;
        const mark=document.createElement('span');mark.textContent=d.mark;inner.append(img,mark);button.append(inner);
        button.addEventListener('click',()=>this.flip(button));board.append(button);this.cards.push(button);
      });
      const meta=document.createElement('div');meta.className='dom-meta';meta.textContent='EIGHT PAIRS • ALL MALIK';
      $('dom-stage').replaceChildren(board,meta);this.resume();this.updateHud();
    }
    resume(){addTimer(setInterval(()=>{if(phase==='running'){this.elapsed++;this.updateHud();}},1000));
      if(this.locked&&this.shown.length===2)addTimer(setTimeout(()=>this.fold(),380));
    }
    updateHud(){syncHud(`${this.pairs}/8`,`MOVES ${this.turns}   ·   TIME ${timeText(this.elapsed)}`);}
    flip(card){if(phase!=='running'||this.locked||card.classList.contains('revealed')||card.classList.contains('matched'))return;
      card.classList.add('revealed');card.setAttribute('aria-label',`Revealed ${cardSymbols[Number(card.dataset.symbol)].mark}`);this.shown.push(card);sound('tap');
      if(this.shown.length===2){this.turns++;
        if(this.shown[0].dataset.symbol===this.shown[1].dataset.symbol){
          this.shown.forEach(x=>{x.classList.remove('revealed');x.classList.add('matched');x.disabled=true;});
          this.shown=[];this.pairs++;sound('coin');this.updateHud();
          if(this.pairs===8){hearts(5);finishGame(Math.max(1,this.elapsed),`You found all eight pairs in ${this.turns} moves! +5 ♥`);}
        }else{this.locked=true;addTimer(setTimeout(()=>this.fold(),700));}
      }
    }
    fold(){this.shown.forEach(x=>{x.classList.remove('revealed');x.setAttribute('aria-label','Face down');});this.shown=[];this.locked=false;this.updateHud();}
  }
  class Whack {
    constructor(){this.timeLeft=30;this.points=0;this.combo=0;this.active=-1;this.isBomb=false;this.holes=[];this.lastIndex=-1;}
    start(){const board=document.createElement('div');board.className='whack-board';
      for(let i=0;i<9;i++){
        const b=document.createElement('button');b.type='button';b.className='whack-hole';b.setAttribute('aria-label',`Hole ${i+1}`);
        const img=document.createElement('img');img.src=saveData.skin==='winged'?'assets/face-winged.png':'assets/face.png';img.alt='';img.draggable=false;
        const bomb=document.createElement('span');bomb.className='bomb';bomb.textContent='💣';b.append(img,bomb);
        b.addEventListener('click',()=>this.whack(i));board.append(b);this.holes.push(b);
      }
      const meta=document.createElement('div');meta.className='dom-meta';meta.textContent='TAP MALIK • AVOID 💣 MALIK';$('dom-stage').replaceChildren(board,meta);
      this.updateHud();this.showRandom();this.resume();
    }
    resume(){
      addTimer(setInterval(()=>{if(phase!=='running')return;this.timeLeft=Math.max(0,this.timeLeft-.1);this.updateHud();if(this.timeLeft<=0)finishGame(this.points,`Time's up! Your best combo was ${this.combo} at the finish.`);},100));
      addTimer(setInterval(()=>{if(phase==='running')this.showRandom();},700));
    }
    updateHud(){syncHud(this.points,`TIME ${Math.ceil(this.timeLeft)}s   ·   COMBO x${this.combo}`);}
    showRandom(){if(phase!=='running')return;
      this.holes.forEach(b=>b.classList.remove('active','bad','hit'));
      let choice=Math.floor(rand(0,9));if(choice===this.lastIndex)choice=(choice+1+Math.floor(rand(0,8)))%9;
      this.lastIndex=choice;this.active=choice;this.isBomb=Math.random()<.19;this.holes[choice].classList.add('active');if(this.isBomb)this.holes[choice].classList.add('bad');
      this.holes[choice].setAttribute('aria-label',this.isBomb?'Bomb face. Avoid!':'Tap the face!');
    }
    whack(index){if(phase!=='running'||index!==this.active)return;
      const hole=this.holes[index];hole.classList.remove('active');hole.classList.add('hit');this.active=-1;
      if(this.isBomb){this.points=Math.max(0,this.points-20);this.combo=0;sound('hit');toast('💣 Oops! −20 points');}
      else{this.combo++;this.points+=10+Math.min(25,Math.floor(this.combo/4)*5);if(this.combo%4===0){hearts(2);sound('coin');}else sound('tap');}
      this.updateHud();
    }
  }

  // User input: touch, mouse and keyboard all work with the same gameplay logic.
  function pointerX(e){const bounds=canvas.getBoundingClientRect();return clamp((e.clientX-bounds.left)*W/bounds.width,0,W);}
  canvas.addEventListener('pointerdown',(e)=>{
    if(phase!=='running')return;e.preventDefault();pointerStart={x:e.clientX,y:e.clientY};
    try{canvas.setPointerCapture(e.pointerId)}catch(_){}
    if(mode==='flappy')engine.flap();
    if(mode==='catch')engine.move(pointerX(e));
  });
  canvas.addEventListener('pointermove',(e)=>{if(phase==='running'&&mode==='catch'&&(e.buttons||e.pointerType==='touch')){e.preventDefault();engine.move(pointerX(e));}});
  canvas.addEventListener('pointerup',(e)=>{if(phase!=='running')return;
    if(mode==='dash'&&pointerStart){const xdiff=e.clientX-pointerStart.x;
      if(Math.abs(xdiff)>24)engine.move(xdiff>0?1:-1);
      else engine.move(pointerX(e)>W/2?1:-1);
    }
    pointerStart=null;
  });
  window.addEventListener('keydown',(e)=>{
    if($('settings-dialog').open)return;
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&mode!=='home')e.preventDefault();
    if(e.code==='Escape'&&phase==='running'){pause();return;}
    if(e.code==='KeyP'&&(phase==='running'||phase==='paused')){pause();return;}
    if(phase!=='running'){
      if((e.code==='Enter'||e.code==='Space')&&mode!=='home'&&!$('game-overlay').classList.contains('hidden')){
        e.preventDefault();currentOverlayAction?.();
      }
      return;
    }
    if((e.code==='Space'||e.code==='ArrowUp')&&mode==='flappy')engine.flap();
    else if(mode==='dash'&&e.code==='ArrowLeft')engine.move(-1);
    else if(mode==='dash'&&e.code==='ArrowRight')engine.move(1);
    else if(mode==='catch'&&e.code==='ArrowLeft')engine.move(engine.target-38);
    else if(mode==='catch'&&e.code==='ArrowRight')engine.move(engine.target+38);
  });
  function frame(timestamp){
    const dt=previousFrame?clamp((timestamp-previousFrame)/16.6667,.1,2.1):1;previousFrame=timestamp;animationTime+=dt;
    if((mode==='flappy'||mode==='dash'||mode==='catch')&&engine){
      if(phase==='running')engine.update(dt);
      if(phase!=='idle')engine.draw();
    }
    requestAnimationFrame(frame);
  }

  document.querySelectorAll('[data-open]').forEach(el=>el.addEventListener('click',()=>openGame(el.dataset.open)));
  $('go-home').addEventListener('click',showHome);$('overlay-back').addEventListener('click',showHome);
  $('overlay-action').addEventListener('click',()=>currentOverlayAction?.());
  $('pause-btn').addEventListener('click',pause);
  $('audio-toggle').addEventListener('click',()=>{saveData.sound=!saveData.sound;persist();renderStats();if(saveData.sound)sound('tap');});
  $('settings-toggle').addEventListener('click',()=>{if(phase==='running')pause();$('settings-dialog').showModal();});
  $('close-settings').addEventListener('click',()=>$('settings-dialog').close());
  $('motion-toggle').addEventListener('click',()=>{saveData.reducedMotion=!saveData.reducedMotion;persist();renderStats();});
  document.querySelectorAll('[data-skin]').forEach(btn=>btn.addEventListener('click',()=>{
    saveData.skin=btn.dataset.skin;persist();renderStats();toast(`Character changed to ${saveData.skin==='photo'?'Real Malik':'Angel Malik'}!`);
    if(mode==='match'||mode==='whack')$('dom-stage').querySelectorAll('img').forEach(i=>i.src=saveData.skin==='photo'?'assets/face.png':'assets/face-winged.png');
  }));
  $('settings-dialog').addEventListener('click',e=>{if(e.target===$('settings-dialog'))$('settings-dialog').close();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='running')pause();});
  window.addEventListener('hashchange',()=>{
    const next=location.hash.substring(1);
    if(gameNames[next]&&next!==mode)openGame(next);else if(next==='home'&&mode!=='home')showHome();
  });
  const initial=location.hash.slice(1);
  renderStats();if(gameNames[initial])openGame(initial);else showHome();
  requestAnimationFrame(frame);
  if('serviceWorker' in navigator&&location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
