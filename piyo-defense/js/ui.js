'use strict';

// ── Stage Intro ───────────────────────────────────────────────────────────────
function drawStageIntro(stage, timer, totalTime) {
  var progress = 1 - timer/totalTime;
  var alpha = progress < 0.35 ? progress/0.35 : progress > 0.70 ? 1-(progress-0.70)/0.30 : 1;
  _ctx.fillStyle='rgba(0,0,0,'+(alpha*0.78)+')'; _ctx.fillRect(0,0,_W,_H);
  var sc=0.82+alpha*0.18;
  _ctx.save(); _ctx.translate(_W/2,_H/2); _ctx.scale(sc,sc); _ctx.globalAlpha=alpha; _ctx.textAlign='center';
  _ctx.shadowColor='#FFD700'; _ctx.shadowBlur=26;
  _ctx.fillStyle='#FFD700'; _ctx.font='bold 26px "Kosugi Maru",sans-serif'; _ctx.fillText('STAGE',0,-36);
  _ctx.shadowColor='#FFFFFF'; _ctx.shadowBlur=22;
  _ctx.fillStyle='#FFFFFF'; _ctx.font='bold 86px "Kosugi Maru",sans-serif'; _ctx.fillText(stage,0,52);
  _ctx.shadowBlur=0;
  _ctx.fillStyle='rgba(180,210,255,0.70)'; _ctx.font='15px "Kosugi Maru",sans-serif'; _ctx.fillText('タップでスキップ',0,96);
  _ctx.globalAlpha=1; _ctx.restore();
}

// ── Button gradient ───────────────────────────────────────────────────────────
function _btnGrd(x, y, w, h, colTop, colBot) {
  var g=_ctx.createLinearGradient(x,y,x,y+h);
  g.addColorStop(0,colTop); g.addColorStop(1,colBot); return g;
}

// ── Battle HUD ───────────────────────────────────────────────────────────────
function drawHudTop(earthHP, maxEarthHP, barrierActive, stage, wave, wavesPerStage, score, level, xp, xpMax, kills, hs, frame, coins, poisonDebuff) {
  var barG=_ctx.createLinearGradient(0,0,0,82);
  barG.addColorStop(0,'rgba(8,12,32,0.88)'); barG.addColorStop(1,'rgba(4,8,20,0.95)');
  _ctx.fillStyle=barG; _ctx.fillRect(0,0,_W,82);
  _ctx.strokeStyle='rgba(80,140,220,0.22)'; _ctx.lineWidth=1.5;
  _ctx.beginPath(); _ctx.moveTo(0,82); _ctx.lineTo(_W,82); _ctx.stroke();

  drawEarth(24,26,18);
  var ratio=earthHP/maxEarthHP;
  rrect(48,13,_W-110,24,12,'rgba(0,0,0,0.7)','rgba(80,100,140,0.4)',1);
  if (ratio>0) {
    var hcol=ratio>0.55?'#2ECC71':ratio>0.3?'#F39C12':'#E74C3C';
    var hG=_ctx.createLinearGradient(49,14,49,36);
    hG.addColorStop(0,hcol==='#2ECC71'?'#50FF90':hcol==='#F39C12'?'#FFB830':'#FF6060'); hG.addColorStop(1,hcol);
    rrectGrd(49,14,(_W-112)*ratio,22,11,hG,null);
    _ctx.fillStyle='rgba(255,255,255,0.22)';
    _ctx.beginPath(); _ctx.moveTo(52,15); _ctx.lineTo(49+(_W-112)*ratio-3,15); _ctx.lineTo(49+(_W-112)*ratio-3,20); _ctx.lineTo(52,20); _ctx.closePath(); _ctx.fill();
  }
  // 毒デバフ表示
  if (poisonDebuff > 0) {
    _ctx.globalAlpha=0.7+Math.sin(frame*0.2)*0.2;
    rrect(47,12,_W-110,26,13,null,'#88FF44',2);
    _ctx.globalAlpha=1;
  }
  _ctx.fillStyle='#fff'; _ctx.font='bold 11px "Kosugi Maru",sans-serif'; _ctx.textAlign='center';
  _ctx.fillText('HP '+earthHP+'/'+maxEarthHP, 48+(_W-112)/2, 29);
  if (barrierActive) {
    _ctx.globalAlpha=0.55+Math.sin(frame*0.12)*0.3; rrect(47,12,_W-110,26,13,null,'#00FFFF',2.5); _ctx.globalAlpha=1;
  }

  var pG=_btnGrd(_W-46,8,36,30,'rgba(50,55,80,0.95)','rgba(20,22,40,0.95)');
  rrectGrd(_W-46,8,36,30,6,pG,'rgba(120,130,180,0.5)',1.5);
  _ctx.fillStyle='#ccc'; _ctx.font='bold 13px sans-serif'; _ctx.textAlign='center'; _ctx.fillText('❚❚',_W-28,28);

  // STAGE/WAVE
  var swG=_btnGrd(8,44,80,30,'rgba(20,40,80,0.92)','rgba(8,18,45,0.92)');
  rrectGrd(8,44,80,30,6,swG,'rgba(68,138,187,0.7)',1.5);
  _ctx.fillStyle='#7EC8E3'; _ctx.font='bold 9px "Kosugi Maru",sans-serif'; _ctx.textAlign='center'; _ctx.fillText('STAGE '+stage,48,55);
  _ctx.fillStyle='#FFD700'; _ctx.font='bold 13px "Kosugi Maru",sans-serif'; _ctx.fillText('WAVE '+wave+'/'+wavesPerStage,48,70);

  // SCORE
  var scG=_btnGrd(96,44,100,30,'rgba(25,25,45,0.92)','rgba(10,10,28,0.92)');
  rrectGrd(96,44,100,30,6,scG,'rgba(80,80,110,0.5)',1.5);
  _ctx.fillStyle='#888'; _ctx.font='9px "Kosugi Maru",sans-serif'; _ctx.textAlign='center'; _ctx.fillText('SCORE',146,55);
  _ctx.fillStyle='#FFD700'; _ctx.font='bold 13px "Kosugi Maru",sans-serif'; _ctx.fillText(score,146,70);

  // LV/XP
  var lvG=_btnGrd(204,44,80,30,'rgba(40,15,70,0.92)','rgba(18,6,36,0.92)');
  rrectGrd(204,44,80,30,6,lvG,'rgba(155,89,182,0.6)',1.5);
  _ctx.fillStyle='#CC88FF'; _ctx.font='bold 10px "Kosugi Maru",sans-serif'; _ctx.textAlign='center'; _ctx.fillText('Lv.'+level,244,56);
  rrect(209,63,68,7,3,'rgba(0,0,0,0.55)',null);
  if (xp>0) {
    var xpG=_ctx.createLinearGradient(209,63,209,70);
    xpG.addColorStop(0,'#CC66FF'); xpG.addColorStop(1,'#7B00CC');
    rrectGrd(209,63,68*Math.min(1,xp/xpMax),7,3,xpG,null);
  }

  // コイン
  drawCoinIcon(_W-82, 57, 7);
  _ctx.fillStyle='#FFD700'; _ctx.font='bold 11px "Kosugi Maru",sans-serif'; _ctx.textAlign='left';
  _ctx.fillText(coins, _W-72, 61);

  // Kill/HS
  _ctx.fillStyle='#555'; _ctx.font='9px "Kosugi Maru",sans-serif'; _ctx.textAlign='right';
  _ctx.fillText('撃破:'+kills,_W-52,56);
  _ctx.fillStyle='#FFD700'; _ctx.fillText('HS:'+hs,_W-52,68);
}

function drawEvoBar(evoGauge, isEvolved, evoTimer, isAngel, angelTimer) {
  if (evoGauge<=0&&!isEvolved&&!isAngel) return;
  var bx=8,by=83,bw=_W-16,bh=8;
  rrect(bx-1,by-1,bw+2,bh+2,bh/2+1,'rgba(0,0,0,0.6)','rgba(60,60,80,0.4)',1);
  if (isAngel) {
    // エンジェルタイマーバー（青）
    var ea=_ctx.createLinearGradient(bx,by,bx,by+bh);
    ea.addColorStop(0,'#88CCFF'); ea.addColorStop(1,'#4488CC');
    rrectGrd(bx,by,bw*Math.max(0,Math.min(1,(angelTimer||0)/900)),bh,bh/2,ea,null);
    _ctx.fillStyle='#AADDFF'; _ctx.font='bold 9px "Kosugi Maru",sans-serif'; _ctx.textAlign='right';
    _ctx.fillText('😇 エンジェル変身中！ '+Math.ceil((angelTimer||0)/60)+'s',_W-10,by-1);
  } else {
    if (evoGauge>0) {
      var eg=_ctx.createLinearGradient(bx,by,bx,by+bh);
      eg.addColorStop(0,isEvolved?'#FF9060':'#FFE040'); eg.addColorStop(1,isEvolved?'#CC4400':'#E8A000');
      rrectGrd(bx,by,bw*(evoGauge/100),bh,bh/2,eg,null);
    }
    if (isEvolved) {
      _ctx.fillStyle='#FF6B35'; _ctx.font='bold 9px "Kosugi Maru",sans-serif'; _ctx.textAlign='right';
      _ctx.fillText('にわトリ変身中！ '+Math.ceil(evoTimer/60)+'s',_W-10,by-1);
    }
  }
}

function drawCompanionBtns(upg, cds, CD_MAX, frame) {
  var BTNS=[
    {id:'gunshi', label:'軍師',   x:50,    color:'#8B4513',hiColor:'#C06020',acc:'glasses'},
    {id:'nurse',  label:'ナース', x:_W/2,  color:'#C0397B',hiColor:'#E05090',acc:'nurse'  },
    {id:'barrier',label:'バリア', x:_W-50, color:'#1A5DAD',hiColor:'#2878CC',acc:'helmet' },
  ];
  var BY=_H-65,BR=30;
  BTNS.forEach(function(btn){
    var unlocked=upg[btn.id],cd=cds[btn.id],cdMax=CD_MAX[btn.id];
    _ctx.beginPath(); _ctx.arc(btn.x,BY+3,BR,0,Math.PI*2); _ctx.fillStyle='rgba(0,0,0,0.4)'; _ctx.fill();
    var ready=unlocked&&cd<=0;
    var cG=_ctx.createRadialGradient(btn.x-BR*0.3,BY-BR*0.3,2,btn.x,BY,BR);
    if(ready){cG.addColorStop(0,btn.hiColor);cG.addColorStop(1,btn.color);}
    else{cG.addColorStop(0,'#2A2A2A');cG.addColorStop(1,'#111');}
    _ctx.beginPath(); _ctx.arc(btn.x,BY,BR,0,Math.PI*2); _ctx.fillStyle=cG; _ctx.fill();
    _ctx.strokeStyle=ready?'rgba(255,255,255,0.7)':(unlocked?'#555':'#333'); _ctx.lineWidth=ready?2.5:1.5; _ctx.stroke();
    if(ready){_ctx.globalAlpha=0.25;_ctx.fillStyle='#fff';_ctx.beginPath();_ctx.arc(btn.x,BY,BR,Math.PI*1.1,Math.PI*1.9);_ctx.lineTo(btn.x,BY);_ctx.closePath();_ctx.fill();_ctx.globalAlpha=1;}
    if(unlocked&&cd>0){
      _ctx.globalAlpha=0.55;_ctx.fillStyle='#000';_ctx.beginPath();_ctx.moveTo(btn.x,BY);_ctx.arc(btn.x,BY,BR,-Math.PI/2,-Math.PI/2+Math.PI*2*(cd/cdMax));_ctx.closePath();_ctx.fill();_ctx.globalAlpha=1;
      _ctx.fillStyle='#fff';_ctx.font='bold 12px sans-serif';_ctx.textAlign='center';_ctx.fillText(Math.ceil(cd/60)+'s',btn.x,BY+5);
    } else if(unlocked){drawChick(btn.x,BY-2,22,false,btn.acc);}
    else{_ctx.fillStyle='#555';_ctx.font='20px sans-serif';_ctx.textAlign='center';_ctx.textBaseline='middle';_ctx.fillText('🔒',btn.x,BY);_ctx.textBaseline='alphabetic';}
    _ctx.fillStyle=unlocked?'#ddd':'#444';_ctx.font='9px "Kosugi Maru",sans-serif';_ctx.textAlign='center';_ctx.fillText(btn.label,btn.x,BY+BR+13);
  });
}

// ── Boss Warning ──────────────────────────────────────────────────────────────
function drawBossWarn(timer, totalWarnTime) {
  var pulse=Math.abs(Math.sin(timer*0.18));
  _ctx.fillStyle='rgba(160,0,0,'+(pulse*0.38)+')'; _ctx.fillRect(0,0,_W,_H);
  var sc=1+Math.sin(timer*0.22)*0.08;
  _ctx.save(); _ctx.translate(_W/2,_H/2-30); _ctx.scale(sc,sc); _ctx.textAlign='center';
  _ctx.shadowColor='#FF0000'; _ctx.shadowBlur=28; _ctx.strokeStyle='#000'; _ctx.lineWidth=10; _ctx.fillStyle='#FF1A1A';
  _ctx.font='bold 48px "Kosugi Maru",sans-serif'; _ctx.strokeText('⚠️ WARNING!! ⚠️',0,0); _ctx.fillText('⚠️ WARNING!! ⚠️',0,0);
  _ctx.shadowColor='#FF8800'; _ctx.shadowBlur=16; _ctx.strokeStyle='#000'; _ctx.lineWidth=7; _ctx.fillStyle='#FFD700';
  _ctx.font='bold 31px "Kosugi Maru",sans-serif'; _ctx.strokeText('BOSS INCOMING!!',0,50); _ctx.fillText('BOSS INCOMING!!',0,50);
  _ctx.shadowBlur=0; _ctx.restore();
}

// ── Stage Clear ───────────────────────────────────────────────────────────────
function drawStageClear(stage, totalStages, timer, totalTime, frame) {
  var progress=1-(timer/totalTime), fadeIn=Math.min(1,progress*5);
  _ctx.fillStyle='rgba(0,0,0,'+(0.55*fadeIn)+')'; _ctx.fillRect(0,0,_W,_H);
  var sc=(1+Math.sin(frame*0.08)*0.04)*fadeIn;
  _ctx.save(); _ctx.translate(_W/2,_H*0.38); _ctx.scale(sc,sc); _ctx.textAlign='center';
  _ctx.shadowColor='#FFD700'; _ctx.shadowBlur=28; _ctx.fillStyle='#FFD700'; _ctx.font='bold 44px "Kosugi Maru",sans-serif'; _ctx.fillText('STAGE '+stage,0,0);
  _ctx.shadowColor='#FFFFFF'; _ctx.shadowBlur=18; _ctx.fillStyle='#FFFFFF'; _ctx.font='bold 54px "Kosugi Maru",sans-serif'; _ctx.fillText('CLEAR!!',0,64);
  _ctx.shadowBlur=0; _ctx.restore();
  _ctx.globalAlpha=fadeIn;
  if (stage<totalStages) {
    _ctx.fillStyle='rgba(200,220,255,0.85)'; _ctx.font='16px "Kosugi Maru",sans-serif'; _ctx.textAlign='center'; _ctx.fillText('STAGE '+(stage+1)+' へ進む...',_W/2,_H*0.38+126);
    _ctx.fillStyle='#4EE890'; _ctx.font='14px "Kosugi Maru",sans-serif'; _ctx.fillText('地球HP +20 ボーナス！',_W/2,_H*0.38+150);
  } else {
    _ctx.fillStyle='#FFD700'; _ctx.font='bold 20px "Kosugi Maru",sans-serif'; _ctx.textAlign='center'; _ctx.fillText('ALL STAGES COMPLETE!!',_W/2,_H*0.38+126);
  }
  _ctx.globalAlpha=1;
}

// ── Title（全面刷新版） ────────────────────────────────────────────────────────
// タップ領域:
//   START:        y=450-510, x=50-340
//   図鑑:          y=522-568, x=50-190
//   実績:          y=522-568, x=200-340
//   設定&ショップ:  y=580-626, x=50-340
function drawTitle(frame, hs, bs, bgmOn, seOn, coins) {
  coins = coins || 0;
  // 背景
  var breathe=Math.sin(frame*0.007)*0.5+0.5;
  var g=_ctx.createLinearGradient(0,0,0,_H);
  g.addColorStop(0,'rgb('+Math.round(4+breathe*8)+','+Math.round(10+breathe*6)+','+Math.round(35+breathe*15)+')');
  g.addColorStop(0.5,'rgb('+Math.round(8+breathe*6)+','+Math.round(4+breathe*5)+','+Math.round(42+breathe*10)+')');
  g.addColorStop(1,'rgb(4,3,14)');
  _ctx.fillStyle=g; _ctx.fillRect(0,0,_W,_H);

  // 星
  for (var i=0;i<70;i++) {
    var sx=(i*141+47)%_W, sy=(i*233+31)%(_H*0.72);
    _ctx.globalAlpha=(Math.sin(frame*0.04+i)*0.22+0.60)*0.80;
    _ctx.fillStyle=i%5===0?'#FFE080':i%5===1?'#C8DDFF':'#FFFFFF';
    _ctx.beginPath(); _ctx.arc(sx,sy,0.55+(i%4)*0.35,0,Math.PI*2); _ctx.fill();
  }

  // 雲（横流れ）
  _ctx.globalAlpha=0.12;
  for (var ci=0;ci<4;ci++) {
    var cx3=((frame*0.35+ci*210)%(_W+180))-90;
    var cy3=80+ci*60+Math.sin(frame*0.01+ci)*8;
    var cw3=70+ci*30;
    _ctx.fillStyle='#AABBFF';
    _ctx.beginPath(); _ctx.ellipse(cx3,cy3,cw3,cw3*0.4,0,0,Math.PI*2); _ctx.fill();
    _ctx.beginPath(); _ctx.ellipse(cx3+cw3*0.4,cy3-cw3*0.18,cw3*0.55,cw3*0.32,0,0,Math.PI*2); _ctx.fill();
    _ctx.beginPath(); _ctx.ellipse(cx3-cw3*0.3,cy3-cw3*0.12,cw3*0.45,cw3*0.28,0,0,Math.PI*2); _ctx.fill();
  }
  _ctx.globalAlpha=1;

  // 浮遊パーティクル
  for (var j=0;j<20;j++) {
    var py=_H-((frame*0.48+j*42)%_H);
    var px=(j*91+Math.sin(frame*0.013+j*0.9)*28+22)%(_W-36)+18;
    var pa=Math.abs(Math.sin(frame*0.028+j*1.2))*0.44+0.06;
    _ctx.globalAlpha=pa;
    _ctx.fillStyle=j%4===0?'#FFD700':j%4===1?'#FF88CC':j%4===2?'#88CCFF':'#AAFFAA';
    _ctx.beginPath(); _ctx.arc(px,py,1.1+(j%3)*0.55,0,Math.PI*2); _ctx.fill();
  }
  _ctx.globalAlpha=1; _ctx.textAlign='center';

  // タイトルテキスト
  var titleBob=Math.sin(frame*0.042)*2.5, titleSc=1+Math.sin(frame*0.028)*0.016;
  var bloom=_ctx.createRadialGradient(_W/2,144+titleBob,0,_W/2,144+titleBob,130);
  bloom.addColorStop(0,'rgba(255,145,18,0.16)'); bloom.addColorStop(1,'rgba(255,100,0,0)');
  _ctx.fillStyle=bloom; _ctx.fillRect(0,50+titleBob,_W,170);
  _ctx.fillStyle='rgba(255,175,95,0.58)'; _ctx.font='bold 11px "Kosugi Maru",sans-serif'; _ctx.fillText('✦  PIYO  DEFENSE  ✦',_W/2,98+titleBob);
  _ctx.save(); _ctx.translate(_W/2,152+titleBob); _ctx.scale(titleSc,titleSc);
  _ctx.shadowColor='#FF6B00'; _ctx.shadowBlur=32;
  _ctx.fillStyle='#FFD700'; _ctx.font='bold 46px "Kosugi Maru",sans-serif'; _ctx.fillText('ひよこ防衛軍',0,0);
  _ctx.restore();
  _ctx.shadowColor='#FF9900'; _ctx.shadowBlur=9;
  _ctx.fillStyle='#FFA040'; _ctx.font='bold 15px "Kosugi Maru",sans-serif'; _ctx.fillText('～地球救出大作戦～',_W/2,176+titleBob);
  _ctx.shadowBlur=0;

  // キャラゾーン
  var chickBob=Math.sin(frame*0.052)*5, chickSc=1+Math.sin(frame*0.038)*0.028;
  _ctx.globalAlpha=0.15+Math.sin(frame*0.08)*0.06;
  var aGrd=_ctx.createRadialGradient(_W/2,288+chickBob,0,_W/2,288+chickBob,88);
  aGrd.addColorStop(0,'#FFD700'); aGrd.addColorStop(1,'rgba(255,200,0,0)');
  _ctx.fillStyle=aGrd; _ctx.beginPath(); _ctx.arc(_W/2,288+chickBob,88,0,Math.PI*2); _ctx.fill();
  _ctx.globalAlpha=1;

  // 歩くひよこ（タイトル画面アニメ）
  var walkCycle=Math.sin(frame*0.15)*0.12;
  var w1x=((frame*0.8+100)%(_W+80))-40;
  var w2x=_W-((frame*0.55+50)%(_W+80))+40;
  _ctx.save(); _ctx.translate(w1x, _H-148); _ctx.scale(1+Math.abs(walkCycle)*0.08,1); drawChick(0,walkCycle*20,24,false); _ctx.restore();
  _ctx.save(); _ctx.translate(w2x, _H-138); _ctx.scale(-1,1); drawChick(0,walkCycle*20,20,false); _ctx.restore();

  // 地面（草）
  var grassCol=_ctx.createLinearGradient(0,_H-120,0,_H);
  grassCol.addColorStop(0,'#2E7D32'); grassCol.addColorStop(1,'#1B5E20');
  _ctx.fillStyle=grassCol; _ctx.fillRect(0,_H-120,_W,120);
  // 草の葉
  for (var gi=0;gi<22;gi++) {
    var gx=(gi*43+17)%_W;
    var sway=Math.sin(frame*0.03+gi*0.7)*4;
    _ctx.strokeStyle='#4CAF50'; _ctx.lineWidth=2; _ctx.lineCap='round';
    _ctx.beginPath(); _ctx.moveTo(gx,_H-120); _ctx.quadraticCurveTo(gx+sway,_H-138,gx+sway*1.5,_H-150); _ctx.stroke();
  }

  // デコレーション的なカラス
  var orb=Math.sin(frame*0.025)*7;
  drawCrow({x:78+orb, y:256+Math.sin(frame*0.042)*5,  size:26, hp:3,  maxHp:3,  wobble:frame*0.05,   type:'normal',   hitFlash:0, rangedTimer:0});
  drawCrow({x:312-orb,y:250+Math.sin(frame*0.042+1)*5,size:20, hp:3,  maxHp:3,  wobble:frame*0.05+1, type:'fast',     hitFlash:0, rangedTimer:0});
  drawCrow({x:195,    y:238+Math.sin(frame*0.042+2)*4, size:36, hp:24, maxHp:24, wobble:frame*0.05+2, type:'tank',     hitFlash:0, rangedTimer:0});

  // メインひよこ
  _ctx.save(); _ctx.translate(_W/2,288+chickBob); _ctx.scale(chickSc,chickSc); drawChick(0,0,78,false); _ctx.restore();
  drawEarth(_W/2,402,36);

  // スコアパネル
  var spG=_btnGrd(44,446,_W-88,34,'rgba(10,14,40,0.90)','rgba(5,8,24,0.94)');
  rrectGrd(44,446,_W-88,34,8,spG,'rgba(68,88,138,0.5)',1.5);
  _ctx.fillStyle='#FFD700'; _ctx.font='bold 12px "Kosugi Maru",sans-serif'; _ctx.textAlign='center'; _ctx.fillText('🏆  ベスト: '+hs+'点  |  STAGE '+bs,_W/2,462);
  drawCoinIcon(_W/2-62,470,7);
  _ctx.fillStyle='#FFD700'; _ctx.font='bold 11px "Kosugi Maru",sans-serif'; _ctx.fillText('所持コイン: '+coins,_W/2+2,473);

  // STARTボタン (y=486-546)
  var pulse=Math.sin(frame*0.07)*5;
  rrect(76,492+pulse,238,52,14,'rgba(0,0,0,0.52)',null);
  var stG=_ctx.createLinearGradient(72,486+pulse,72,542+pulse);
  stG.addColorStop(0,'#FF8050'); stG.addColorStop(0.4,'#E84B2B'); stG.addColorStop(0.85,'#C03010'); stG.addColorStop(1,'#9E2008');
  _ctx.shadowColor='rgba(255,82,30,0.75)'; _ctx.shadowBlur=26;
  rrectGrd(72,486+pulse,246,56,15,stG,'#FFD700',3); _ctx.shadowBlur=0;
  _ctx.fillStyle='rgba(255,255,255,0.24)';
  _ctx.beginPath(); _ctx.moveTo(88,488+pulse); _ctx.lineTo(302,488+pulse); _ctx.lineTo(302,499+pulse); _ctx.lineTo(88,499+pulse); _ctx.closePath(); _ctx.fill();
  _ctx.shadowColor='rgba(0,0,0,0.6)'; _ctx.shadowBlur=5; _ctx.shadowOffsetY=2;
  _ctx.fillStyle='#FFFFFF'; _ctx.font='bold 27px "Kosugi Maru",sans-serif'; _ctx.fillText('▶  START  ◀',_W/2,522+pulse);
  _ctx.shadowBlur=0; _ctx.shadowOffsetY=0;

  // 図鑑ボタン (y=558-604, x=50-190)
  var bkG=_btnGrd(50,558,136,44,'rgba(16,40,100,0.92)','rgba(8,20,60,0.92)');
  rrectGrd(50,558,136,44,10,bkG,'rgba(60,110,200,0.6)',1.5);
  _ctx.fillStyle='#88AAFF'; _ctx.font='bold 14px "Kosugi Maru",sans-serif'; _ctx.textAlign='center'; _ctx.fillText('📚 図鑑',118,585);

  // 実績ボタン (y=558-604, x=204-344)
  var rkG=_btnGrd(204,558,136,44,'rgba(80,60,10,0.92)','rgba(50,30,4,0.92)');
  rrectGrd(204,558,136,44,10,rkG,'rgba(200,160,40,0.6)',1.5);
  _ctx.fillStyle='#FFD080'; _ctx.font='bold 14px "Kosugi Maru",sans-serif'; _ctx.fillText('🏆 実績',272,585);

  // 設定/ショップボタン (y=616-662, x=50-344)
  var sgG=_btnGrd(50,616,294,44,'rgba(20,20,50,0.92)','rgba(8,8,28,0.92)');
  rrectGrd(50,616,294,44,10,sgG,'rgba(80,80,140,0.6)',1.5);
  _ctx.fillStyle='#AAAADD'; _ctx.font='bold 14px "Kosugi Maru",sans-serif'; _ctx.fillText('⚙ 設定・強化ショップ',_W/2,643);

  // フッター
  _ctx.fillStyle='rgba(68,78,110,0.72)'; _ctx.font='11px "Kosugi Maru",sans-serif'; _ctx.fillText('全20ステージ × 5Wave構成',_W/2,676);
  _ctx.fillStyle='rgba(42,48,68,0.62)'; _ctx.font='10px sans-serif'; _ctx.fillText('PIYO-DEFENSE  v4.0',_W/2,_H-18);
}

// ── Settings & Shop（y範囲メモ：各ボタンy記載） ────────────────────────────
// ショップ購入エリア: y=140+i*106 height=90
// BGM: y=800-840, SE: y=852-892
// 戻る: y=752-798
function drawSettings(frame, bgmOn, seOn) {
  drawBg(frame);
  _ctx.fillStyle='rgba(0,0,12,0.86)'; _ctx.fillRect(0,0,_W,_H);
  _ctx.shadowColor='#AAAAFF'; _ctx.shadowBlur=14;
  _ctx.fillStyle='#AAAAFF'; _ctx.font='bold 24px "Kosugi Maru",sans-serif'; _ctx.textAlign='center'; _ctx.fillText('⚙ 設定 & 強化ショップ',_W/2,60);
  _ctx.shadowBlur=0;

  var coins=SaveManager.getCoins();
  drawCoinIcon(_W/2-50,85,10);
  _ctx.fillStyle='#FFD700'; _ctx.font='bold 16px "Kosugi Maru",sans-serif'; _ctx.textAlign='center'; _ctx.fillText('所持コイン: '+coins,_W/2+10,90);

  // ショップアイテム（最大6個）
  var lvls=SaveManager.getShopLevels();
  SHOP_ITEMS.forEach(function(item,i) {
    var lv=lvls[item.id]||0;
    var maxed=lv>=item.maxLv;
    var cost=maxed?0:item.costs[lv];
    var iy=110+i*112;
    var canAfford=!maxed&&coins>=cost;

    var ig=_btnGrd(18,iy,_W-36,96,
      canAfford?'rgba(20,30,80,0.95)':maxed?'rgba(10,40,10,0.95)':'rgba(30,15,15,0.95)',
      canAfford?'rgba(8,12,50,0.95)':maxed?'rgba(4,20,4,0.95)':'rgba(15,6,6,0.95)');
    rrectGrd(18,iy,_W-36,96,12,ig,
      canAfford?'rgba(80,120,200,0.6)':maxed?'rgba(80,200,80,0.5)':'rgba(120,60,60,0.4)',1.5);

    // アイコン
    _ctx.font='28px sans-serif'; _ctx.textAlign='left'; _ctx.fillText(item.icon,32,iy+44);
    // 名前
    _ctx.fillStyle=maxed?'#88FF88':canAfford?'#FFD700':'#888';
    _ctx.font='bold 15px "Kosugi Maru",sans-serif'; _ctx.textAlign='left'; _ctx.fillText(item.name,70,iy+32);
    // 説明
    _ctx.fillStyle='#aaa'; _ctx.font='12px "Kosugi Maru",sans-serif'; _ctx.fillText(item.desc,70,iy+52);
    // レベルドット
    for (var li=0;li<item.maxLv;li++) {
      _ctx.fillStyle=li<lv?'#FFD700':'rgba(255,255,255,0.18)';
      _ctx.beginPath(); _ctx.arc(70+li*14,iy+72,4.5,0,Math.PI*2); _ctx.fill();
    }
    // コスト or MAX
    if (maxed) {
      _ctx.fillStyle='#88FF88'; _ctx.font='bold 13px "Kosugi Maru",sans-serif'; _ctx.textAlign='right'; _ctx.fillText('MAX',_W-28,iy+72);
    } else {
      drawCoinIcon(_W-76,iy+64,8);
      _ctx.fillStyle=canAfford?'#FFD700':'#AA6655'; _ctx.font='bold 14px "Kosugi Maru",sans-serif'; _ctx.textAlign='right'; _ctx.fillText(cost,_W-28,iy+72);
    }
  });

  // BGM/SE (y=790, y=840)
  var bgmG=_btnGrd(18,780,(_W-44)/2,48,bgmOn?'rgba(10,55,10,0.95)':'rgba(48,10,10,0.95)',bgmOn?'rgba(4,33,4,0.95)':'rgba(28,4,4,0.95)');
  rrectGrd(18,780,(_W-44)/2,48,10,bgmG,bgmOn?'rgba(45,165,45,0.55)':'rgba(165,45,45,0.5)',1.5);
  _ctx.fillStyle=bgmOn?'#80F080':'#F08080'; _ctx.font='bold 14px "Kosugi Maru",sans-serif'; _ctx.textAlign='center';
  _ctx.fillText('♪ BGM '+(bgmOn?'ON':'OFF'),18+(_W-44)/4,810);

  var seG=_btnGrd(26+(_W-44)/2,780,(_W-44)/2,48,seOn?'rgba(10,55,10,0.95)':'rgba(48,10,10,0.95)',seOn?'rgba(4,33,4,0.95)':'rgba(28,4,4,0.95)');
  rrectGrd(26+(_W-44)/2,780,(_W-44)/2,48,10,seG,seOn?'rgba(45,165,45,0.55)':'rgba(165,45,45,0.5)',1.5);
  _ctx.fillStyle=seOn?'#80F080':'#F08080';
  _ctx.fillText('♩ SE  '+(seOn?'ON':'OFF'),26+(_W-44)/2+(_W-44)/4,810);

  // 戻る (y=840-888)
  var bk2G=_btnGrd(50,840,_W-100,46,'rgba(22,24,76,0.92)','rgba(9,10,48,0.92)');
  rrectGrd(50,840,_W-100,46,11,bk2G,'rgba(65,85,175,0.56)',1.5);
  _ctx.fillStyle='#AAC0FF'; _ctx.font='bold 16px "Kosugi Maru",sans-serif'; _ctx.fillText('← タイトルに戻る',_W/2,869);
}

// ── 図鑑 ──────────────────────────────────────────────────────────────────────
// 戻るボタン: y=790-838
var BESTIARY_LABELS = {
  normal:'ノーマル',fast:'ファスト',ranged:'遠距離',tank:'タンク',ghost:'ゴースト',
  healer:'ヒーラー',bomber:'ボンバー',sprinter:'スプリンター',armored:'装甲',
  regen:'リジェネ',shielded:'シールド',splitter:'分裂',swarm:'スウォーム',
  poison:'ポイズン',stealth:'ステルス',berserker:'バーサーカー',titan:'タイタン',
  leech:'リーチ',necro:'ネクロ',phantom:'ファントム',
  boss_chicken:'ニワトリ大魔王',boss_snake:'巨大ヘビ',boss:'UFOボス'
};
var BESTIARY_DESC = {
  normal:'基本的な敵。特殊能力なし。',
  fast:'移動速度が速い。HPは低め。',
  ranged:'遠距離から弾を発射する。',
  tank:'HPが高く移動が遅い。',
  ghost:'半透明で霞む。すり抜け注意。',
  healer:'周囲の敵を回復する。',
  bomber:'地面で爆発し大ダメージ。',
  sprinter:'突然高速ダッシュする。',
  armored:'ダメージが半減する。',
  regen:'自己回復する。',
  shielded:'シールドで最初の攻撃を吸収。',
  splitter:'死亡時に2体に分裂。',
  swarm:'分裂から生まれる小型敵。',
  poison:'到達時、攻撃速度が低下する。',
  stealth:'定期的に完全透明になる。',
  berserker:'HP低下で加速する。',
  titan:'巨大な超重装甲タンク。',
  leech:'自己回復する吸血鬼。',
  necro:'一度だけ復活する。',
  phantom:'定期的にテレポートする。',
  boss_chicken:'3way弾＋突進＋召喚。',
  boss_snake:'潜伏＋毒スプレー＋なぎ払い。',
  boss:'レーザー＋ミサイル＋回転弾。'
};

function drawBestiary(frame) {
  drawBg(frame);
  _ctx.fillStyle='rgba(0,0,12,0.86)'; _ctx.fillRect(0,0,_W,_H);
  _ctx.shadowColor='#88AAFF'; _ctx.shadowBlur=14;
  _ctx.fillStyle='#88AAFF'; _ctx.font='bold 24px "Kosugi Maru",sans-serif'; _ctx.textAlign='center'; _ctx.fillText('📚 敵図鑑',_W/2,56);
  _ctx.shadowBlur=0;

  var bestiary=SaveManager.getBestiary();
  var types=BESTIARY_TYPES;
  var total=types.length;
  var found=types.filter(function(t){return bestiary[t]>0;}).length;
  _ctx.fillStyle='#88CCFF'; _ctx.font='13px "Kosugi Maru",sans-serif'; _ctx.textAlign='center';
  _ctx.fillText('撃破済み: '+found+'/'+total,_W/2,78);

  // スクロール不要な4列グリッド（23種 → 6行）
  var cols=3, rowH=90, startY=96;
  for (var ri=0;ri<types.length;ri++) {
    var type=types[ri];
    var col2=ri%cols, row2=~~(ri/cols);
    var ix=18+col2*(_W-36)/cols, iy=startY+row2*rowH;
    var iw=(_W-36)/cols-6;
    var seen=bestiary[type]>0;

    var bG2=_btnGrd(ix,iy,iw,rowH-6,seen?'rgba(12,22,55,0.92)':'rgba(10,10,20,0.92)',seen?'rgba(5,10,30,0.92)':'rgba(5,5,12,0.92)');
    rrectGrd(ix,iy,iw,rowH-6,8,bG2,seen?'rgba(60,90,160,0.5)':'rgba(40,40,60,0.3)',1);

    _ctx.globalAlpha=seen?1:0.3;
    // 敵の小さい描画（型ごとに色分けのみ）
    var c2=CROW_COLORS[type]||CROW_COLORS.normal;
    _ctx.fillStyle=seen?c2.eye:'#444';
    _ctx.beginPath(); _ctx.arc(ix+18,iy+30,10,0,Math.PI*2); _ctx.fill();
    if (seen) { _ctx.shadowColor=c2.glow; _ctx.shadowBlur=8; _ctx.beginPath(); _ctx.arc(ix+18,iy+30,10,0,Math.PI*2); _ctx.fill(); _ctx.shadowBlur=0; }
    _ctx.globalAlpha=seen?1:0.25;
    _ctx.fillStyle=seen?'#FFD700':'#555'; _ctx.font='bold 10px "Kosugi Maru",sans-serif'; _ctx.textAlign='left';
    _ctx.fillText(seen?(BESTIARY_LABELS[type]||type):'???',ix+32,iy+26);
    if (seen) {
      _ctx.fillStyle='#888'; _ctx.font='9px "Kosugi Maru",sans-serif'; _ctx.fillText('×'+(bestiary[type]||0),ix+32,iy+40);
    }
    _ctx.globalAlpha=1;
  }

  // 戻る (y=790-838)
  var bkG2=_btnGrd(50,790,_W-100,46,'rgba(22,24,76,0.92)','rgba(9,10,48,0.92)');
  rrectGrd(50,790,_W-100,46,11,bkG2,'rgba(65,85,175,0.56)',1.5);
  _ctx.fillStyle='#AAC0FF'; _ctx.font='bold 16px "Kosugi Maru",sans-serif'; _ctx.textAlign='center'; _ctx.fillText('← タイトルに戻る',_W/2,819);
}

// ── 実績 ──────────────────────────────────────────────────────────────────────
// 戻る: y=780-828
function drawAchievements(frame) {
  drawBg(frame);
  _ctx.fillStyle='rgba(0,0,12,0.86)'; _ctx.fillRect(0,0,_W,_H);
  _ctx.shadowColor='#FFD700'; _ctx.shadowBlur=14;
  _ctx.fillStyle='#FFD700'; _ctx.font='bold 24px "Kosugi Maru",sans-serif'; _ctx.textAlign='center'; _ctx.fillText('🏆 実績',_W/2,56);
  _ctx.shadowBlur=0;

  var ach=SaveManager.getAchievements();
  var done=ACHIEVEMENT_DEFS.filter(function(d){return ach[d.id];}).length;
  _ctx.fillStyle='#FFCC66'; _ctx.font='13px "Kosugi Maru",sans-serif'; _ctx.textAlign='center';
  _ctx.fillText('達成済み: '+done+'/'+ACHIEVEMENT_DEFS.length,_W/2,78);

  ACHIEVEMENT_DEFS.forEach(function(def,i) {
    var achieved=!!ach[def.id];
    var ay=96+i*66;
    var ag=_btnGrd(18,ay,_W-36,58,
      achieved?'rgba(30,24,5,0.95)':'rgba(12,12,30,0.95)',
      achieved?'rgba(15,12,2,0.95)':'rgba(6,6,18,0.95)');
    rrectGrd(18,ay,_W-36,58,10,ag,achieved?'rgba(200,160,40,0.6)':'rgba(50,50,80,0.35)',1.5);

    _ctx.globalAlpha=achieved?1:0.35;
    _ctx.font='22px sans-serif'; _ctx.textAlign='left'; _ctx.fillText(def.icon,32,ay+38);
    _ctx.fillStyle=achieved?'#FFD700':'#888'; _ctx.font='bold 14px "Kosugi Maru",sans-serif'; _ctx.fillText(def.name,64,ay+26);
    _ctx.fillStyle=achieved?'#CCAA44':'#555'; _ctx.font='11px "Kosugi Maru",sans-serif'; _ctx.fillText(def.desc,64,ay+46);
    if (achieved) {
      drawCoinIcon(_W-56,ay+30,8);
      _ctx.fillStyle='#FFD700'; _ctx.font='bold 12px "Kosugi Maru",sans-serif'; _ctx.textAlign='right'; _ctx.fillText('+'+def.reward,_W-26,ay+35);
    }
    _ctx.globalAlpha=1;
  });

  var bkG3=_btnGrd(50,780,_W-100,46,'rgba(22,24,76,0.92)','rgba(9,10,48,0.92)');
  rrectGrd(50,780,_W-100,46,11,bkG3,'rgba(65,85,175,0.56)',1.5);
  _ctx.fillStyle='#AAC0FF'; _ctx.font='bold 16px "Kosugi Maru",sans-serif'; _ctx.textAlign='center'; _ctx.fillText('← タイトルに戻る',_W/2,809);
}

// ── 実績ポップアップ ─────────────────────────────────────────────────────────
function drawAchievementPopup(def, timer, maxTimer) {
  if (!def) return;
  var alpha=timer>maxTimer*0.8 ? (timer-maxTimer*0.8)/(maxTimer*0.2) :
             timer<maxTimer*0.2 ? timer/(maxTimer*0.2) : 1.0;
  alpha=Math.min(1,alpha);
  _ctx.save(); _ctx.globalAlpha=alpha;
  var py=_H-200;
  rrect(28,py,_W-56,72,14,'rgba(20,16,4,0.96)','rgba(200,160,40,0.8)',2.5);
  _ctx.font='26px sans-serif'; _ctx.textAlign='left'; _ctx.fillText(def.icon,46,py+44);
  _ctx.fillStyle='#FFD700'; _ctx.font='bold 14px "Kosugi Maru",sans-serif'; _ctx.fillText('実績解除: '+def.name,84,py+28);
  _ctx.fillStyle='#CCAA44'; _ctx.font='12px "Kosugi Maru",sans-serif'; _ctx.fillText(def.desc,84,py+48);
  drawCoinIcon(_W-64,py+36,9);
  _ctx.fillStyle='#FFD700'; _ctx.font='bold 13px "Kosugi Maru",sans-serif'; _ctx.textAlign='right'; _ctx.fillText('+'+def.reward,_W-38,py+41);
  _ctx.restore();
}

// ── How To ───────────────────────────────────────────────────────────────────
function drawHowTo(frame) {
  drawBg(frame);
  _ctx.fillStyle='rgba(0,0,10,0.84)'; _ctx.fillRect(0,0,_W,_H);
  _ctx.shadowColor='#FFD700'; _ctx.shadowBlur=12;
  _ctx.fillStyle='#FFD700'; _ctx.font='bold 26px "Kosugi Maru",sans-serif'; _ctx.textAlign='center'; _ctx.fillText('あそびかた',_W/2,78);
  _ctx.shadowBlur=0;
  var rows=[
    ['👆','画面を押しっぱなしで連続発射！'],
    ['🌍','地球のHPが0になるとゲームオーバー'],
    ['◀▶','◀▶ボタンかスワイプでレーン移動！'],
    ['⬆️','LvUP→フィールドにアイテムドロップ！'],
    ['⚠️','赤い警告列が出たら別レーンへ逃げろ！'],
    ['🏰','強化でタワーを設置して自動攻撃！'],
    ['💀','ボスは全20種！各ステージ固有の強敵！'],
    ['🏆','全20ステージをクリアせよ！'],
  ];
  rows.forEach(function(row,i) {
    var rG=_btnGrd(28,102+i*80,334,66,'rgba(12,12,44,0.92)','rgba(6,6,28,0.92)');
    rrectGrd(28,102+i*80,334,66,10,rG,'rgba(50,60,100,0.5)',1.5);
    _ctx.font='26px sans-serif'; _ctx.textAlign='left'; _ctx.fillStyle='#fff'; _ctx.fillText(row[0],56,146+i*80);
    _ctx.fillStyle='#dde'; _ctx.font='13px "Kosugi Maru",sans-serif'; _ctx.fillText(row[1],96,146+i*80);
  });
  var bkG4=_btnGrd(72,750,246,52,'rgba(28,42,100,0.95)','rgba(12,18,60,0.95)');
  rrectGrd(72,750,246,52,13,bkG4,'rgba(100,160,220,0.6)',2.5);
  _ctx.fillStyle='#AAC0FF'; _ctx.font='bold 18px "Kosugi Maru",sans-serif'; _ctx.textAlign='center'; _ctx.fillText('タイトルに戻る',_W/2,782);
}

// ── Level Up ─────────────────────────────────────────────────────────────────
function drawLevelUp(choices, level) {
  _ctx.fillStyle='rgba(0,0,12,0.80)'; _ctx.fillRect(0,0,_W,_H);
  _ctx.textAlign='center';
  _ctx.shadowColor='#FFD700'; _ctx.shadowBlur=28;
  _ctx.fillStyle='#FFD700'; _ctx.font='bold 38px "Kosugi Maru",sans-serif'; _ctx.fillText('LEVEL UP!',_W/2,172);
  _ctx.shadowBlur=0;
  _ctx.fillStyle='#CC88FF'; _ctx.font='bold 14px "Kosugi Maru",sans-serif'; _ctx.fillText('Lv.'+level+' に上がった！',_W/2,200);
  _ctx.fillStyle='rgba(255,200,80,0.85)'; _ctx.font='12px "Kosugi Maru",sans-serif'; _ctx.fillText('⏱ ゲームはスローで継続中',_W/2,222);
  _ctx.fillStyle='#888'; _ctx.font='12px "Kosugi Maru",sans-serif'; _ctx.fillText('強化を1つ選んでください',_W/2,242);

  choices.forEach(function(ch,i) {
    var cy=258+i*184;
    var cG=_btnGrd(20,cy,_W-40,168,'rgba(12,22,65,0.97)','rgba(5,10,40,0.97)');
    rrectGrd(20,cy,_W-40,168,14,cG,'rgba(80,100,200,0.6)',2.5);
    _ctx.fillStyle='rgba(255,255,255,0.07)';
    _ctx.beginPath(); _ctx.moveTo(34,cy+2); _ctx.lineTo(_W-34,cy+2); _ctx.lineTo(_W-34,cy+24); _ctx.lineTo(34,cy+24); _ctx.closePath(); _ctx.fill();
    _ctx.font='36px sans-serif'; _ctx.textAlign='center'; _ctx.fillText(ch.icon,_W/2,cy+54);
    _ctx.fillStyle='#FFD700'; _ctx.font='bold 19px "Kosugi Maru",sans-serif'; _ctx.fillText(ch.name,_W/2,cy+90);
    _ctx.fillStyle='#aaa'; _ctx.font='13px "Kosugi Maru",sans-serif'; _ctx.fillText(ch.desc,_W/2,cy+118);
    _ctx.fillStyle='rgba(255,255,255,0.25)'; _ctx.font='11px sans-serif'; _ctx.fillText('タップして選択',_W/2,cy+146);
  });
}

// ── Pause ────────────────────────────────────────────────────────────────────
function drawPause(stage, wave, score) {
  _ctx.fillStyle='rgba(0,0,0,0.82)'; _ctx.fillRect(0,0,_W,_H);
  _ctx.fillStyle='#fff'; _ctx.font='bold 40px "Kosugi Maru",sans-serif'; _ctx.textAlign='center'; _ctx.fillText('PAUSE',_W/2,280);
  _ctx.fillStyle='#666'; _ctx.font='14px "Kosugi Maru",sans-serif'; _ctx.fillText('STAGE '+stage+'  WAVE '+wave+'  SCORE '+score,_W/2,316);
  var r1G=_btnGrd(72,358,246,58,'rgba(32,72,180,0.95)','rgba(14,36,110,0.95)');
  rrectGrd(72,358,246,58,14,r1G,'rgba(100,180,220,0.6)',2.5);
  _ctx.fillStyle='#fff'; _ctx.font='bold 20px "Kosugi Maru",sans-serif'; _ctx.fillText('再開する',_W/2,394);
  var r2G=_btnGrd(72,436,246,58,'rgba(130,22,22,0.95)','rgba(80,8,8,0.95)');
  rrectGrd(72,436,246,58,14,r2G,'rgba(220,80,80,0.6)',2.5);
  _ctx.fillStyle='#fff'; _ctx.fillText('最初からやり直す',_W/2,472);
  var r3G=_btnGrd(72,514,246,58,'rgba(20,22,65,0.95)','rgba(8,10,38,0.95)');
  rrectGrd(72,514,246,58,14,r3G,'rgba(60,80,160,0.5)',2);
  _ctx.fillStyle='#AAC0FF'; _ctx.fillText('タイトルへ',_W/2,550);
}

// ── Game Over ─────────────────────────────────────────────────────────────────
function drawGameOver(score, stage, wave, kills, isNewHS, hs, bs, frame, runCoins) {
  drawBg(frame);
  _ctx.fillStyle='rgba(0,0,0,0.80)'; _ctx.fillRect(0,0,_W,_H);
  _ctx.textAlign='center';
  _ctx.shadowColor='#FF2020'; _ctx.shadowBlur=28; _ctx.fillStyle='#FF4444'; _ctx.font='bold 44px "Kosugi Maru",sans-serif'; _ctx.fillText('EARTH CRASH!',_W/2,148); _ctx.shadowBlur=0;
  drawEarth(_W/2,228,36);
  _ctx.strokeStyle='#FF4444'; _ctx.lineWidth=4;
  _ctx.beginPath(); _ctx.moveTo(_W/2-6,193); _ctx.lineTo(_W/2+5,218); _ctx.lineTo(_W/2-10,263); _ctx.stroke();
  if (isNewHS) {
    _ctx.shadowColor='#FFD700'; _ctx.shadowBlur=14; _ctx.fillStyle='#FFD700'; _ctx.font='bold 18px "Kosugi Maru",sans-serif'; _ctx.fillText('🏆 NEW HIGH SCORE! 🏆',_W/2,292); _ctx.shadowBlur=0;
  }
  var rows=[
    ['スコア',score],['到達ステージ','STAGE '+stage+' - WAVE '+wave],
    ['撃破数',kills+' 体'],['ベストスコア',hs],['最高クリアST',bs>0?'STAGE '+bs:'---'],
  ];
  rows.forEach(function(row,i) {
    var ry=308+i*42;
    var rG=_btnGrd(44,ry,_W-88,34,'rgba(12,14,36,0.92)','rgba(6,8,22,0.92)');
    rrectGrd(44,ry,_W-88,34,7,rG,'rgba(50,60,100,0.4)',1.5);
    _ctx.fillStyle='#777'; _ctx.font='11px "Kosugi Maru",sans-serif'; _ctx.textAlign='left'; _ctx.fillText(row[0],62,ry+21);
    _ctx.fillStyle='#fff'; _ctx.font='bold 14px "Kosugi Maru",sans-serif'; _ctx.textAlign='right'; _ctx.fillText(row[1],_W-56,ry+21);
  });
  // コイン獲得表示
  if (runCoins > 0) {
    var cy2=520;
    rrect(44,cy2,_W-88,36,8,'rgba(30,24,5,0.90)','rgba(180,140,30,0.6)',1.5);
    drawCoinIcon(64,cy2+18,9); _ctx.fillStyle='#FFD700'; _ctx.font='bold 15px "Kosugi Maru",sans-serif'; _ctx.textAlign='center';
    _ctx.fillText('コイン +'+runCoins+' 獲得！',_W/2+6,cy2+23);
  }
  var cG2=_ctx.createLinearGradient(44,566,44,622);
  cG2.addColorStop(0,'#FF8050'); cG2.addColorStop(0.4,'#E84B2B'); cG2.addColorStop(1,'#9E2008');
  _ctx.shadowColor='rgba(255,80,30,0.7)'; _ctx.shadowBlur=20;
  rrectGrd(44,566,_W-88,54,14,cG2,'#FFD700',3); _ctx.shadowBlur=0;
  _ctx.fillStyle='#fff'; _ctx.font='bold 17px "Kosugi Maru",sans-serif'; _ctx.textAlign='center'; _ctx.fillText('▶ STAGE '+stage+' からコンテニュー',_W/2,590);
  _ctx.fillStyle='rgba(255,220,180,0.75)'; _ctx.font='11px "Kosugi Maru",sans-serif'; _ctx.fillText('スコアはリセット',_W/2,608);
  var rG2=_btnGrd(44,630,_W-88,46,'rgba(30,12,12,0.95)','rgba(15,5,5,0.95)');
  rrectGrd(44,630,_W-88,46,11,rG2,'rgba(150,50,50,0.5)',1.5);
  _ctx.fillStyle='#F08080'; _ctx.font='bold 16px "Kosugi Maru",sans-serif'; _ctx.fillText('最初からやり直す',_W/2,659);
  var tG2=_btnGrd(44,686,_W-88,46,'rgba(18,20,60,0.95)','rgba(7,9,34,0.95)');
  rrectGrd(44,686,_W-88,46,11,tG2,'rgba(55,75,155,0.5)',1.5);
  _ctx.fillStyle='#AAC0FF'; _ctx.font='bold 16px "Kosugi Maru",sans-serif'; _ctx.fillText('タイトルへ',_W/2,715);
}

// ── Ending ───────────────────────────────────────────────────────────────────
function drawEnding(score, kills, playFrames, isNewHS, hs, frame, runCoins) {
  var g=_ctx.createLinearGradient(0,0,0,_H);
  g.addColorStop(0,'#001040'); g.addColorStop(1,'#001A08');
  _ctx.fillStyle=g; _ctx.fillRect(0,0,_W,_H);
  for (var i=0;i<70;i++) {
    var sx=(i*141+47)%_W,sy=(i*233+31)%_H;
    _ctx.globalAlpha=(Math.sin(frame*0.04+i)*0.3+0.7)*0.9; _ctx.fillStyle='#fff';
    _ctx.beginPath(); _ctx.arc(sx,sy,1+(i%3)*0.4,0,Math.PI*2); _ctx.fill();
  }
  _ctx.globalAlpha=1;
  [[110,220],[280,200],[195,330]].forEach(function(fw,k) {
    var t=frame*0.04+k*2.1;
    ['#FF4444','#FFD700','#4ECDC4','#FF69B4','#fff','#88FF88'].forEach(function(c2,j) {
      var a2=t+j*(Math.PI*2/6), r2=28*Math.abs(Math.sin(t*0.6));
      _ctx.globalAlpha=Math.max(0,Math.abs(Math.sin(t))); _ctx.shadowColor=c2; _ctx.shadowBlur=6; _ctx.fillStyle=c2;
      _ctx.beginPath(); _ctx.arc(fw[0]+Math.cos(a2)*r2,fw[1]+Math.sin(a2)*r2,3,0,Math.PI*2); _ctx.fill();
    });
  });
  _ctx.globalAlpha=1; _ctx.shadowBlur=0;
  drawEarth(_W/2,180,70); _ctx.fillStyle='#FFD700'; _ctx.font='32px sans-serif'; _ctx.textAlign='center'; _ctx.fillText('🌟',_W/2,104);
  _ctx.shadowColor='#FFD700'; _ctx.shadowBlur=22; _ctx.fillStyle='#FFD700'; _ctx.font='bold 52px "Kosugi Maru",sans-serif'; _ctx.textAlign='center'; _ctx.fillText('ALL CLEAR!!',_W/2,292); _ctx.shadowBlur=0;
  drawChick(_W/2,368,58,true); drawChick(_W/2-90,392,34,false,'glasses'); drawChick(_W/2+90,392,34,false,'nurse'); drawChick(_W/2,412,28,false,'helmet');
  if (isNewHS) { _ctx.shadowColor='#FFD700'; _ctx.shadowBlur=12; _ctx.fillStyle='#FFD700'; _ctx.font='bold 18px "Kosugi Maru",sans-serif'; _ctx.fillText('🏆 NEW HIGH SCORE! 🏆',_W/2,452); _ctx.shadowBlur=0; }
  if (runCoins>0) {
    rrect(60,460,_W-120,36,8,'rgba(30,24,5,0.90)','rgba(180,140,30,0.6)',1.5);
    drawCoinIcon(_W/2-55,478,9); _ctx.fillStyle='#FFD700'; _ctx.font='bold 15px "Kosugi Maru",sans-serif'; _ctx.fillText('コイン +'+runCoins+' 獲得！',_W/2+6,483);
  }
  var mins=~~(playFrames/60/60),secs=~~(playFrames/60)%60;
  var timeStr=(mins<10?'0':'')+mins+':'+(secs<10?'0':'')+secs;
  var rows2=[['最終スコア',score],['撃破数',kills+' 体'],['プレイ時間',timeStr]];
  rows2.forEach(function(row,i) {
    var ry=506+i*52;
    var rG=_btnGrd(55,ry,_W-110,44,'rgba(10,12,36,0.88)','rgba(4,6,20,0.88)');
    rrectGrd(55,ry,_W-110,44,8,rG,'rgba(40,55,100,0.4)',1.5);
    _ctx.fillStyle='#777'; _ctx.font='12px "Kosugi Maru",sans-serif'; _ctx.textAlign='left'; _ctx.fillText(row[0],76,ry+26);
    _ctx.fillStyle='#fff'; _ctx.font='bold 16px "Kosugi Maru",sans-serif'; _ctx.textAlign='right'; _ctx.fillText(row[1],_W-70,ry+26);
  });
  _ctx.fillStyle='#B8E8FF'; _ctx.font='bold 16px "Kosugi Maru",sans-serif'; _ctx.textAlign='center'; _ctx.fillText('THANK YOU FOR PLAYING!',_W/2,670);
  var eG=_ctx.createLinearGradient(55,682,55,736); eG.addColorStop(0,'#3060C0'); eG.addColorStop(1,'#1A3888');
  rrectGrd(55,682,_W-110,54,14,eG,'rgba(100,180,220,0.6)',2.5);
  _ctx.fillStyle='#fff'; _ctx.font='bold 20px "Kosugi Maru",sans-serif'; _ctx.fillText('もう一度プレイ',_W/2,716);
  var e2G=_btnGrd(55,746,_W-110,48,'rgba(20,22,65,0.95)','rgba(8,10,38,0.95)');
  rrectGrd(55,746,_W-110,48,13,e2G,'rgba(60,80,160,0.5)',2);
  _ctx.fillStyle='#AAC0FF'; _ctx.font='bold 18px "Kosugi Maru",sans-serif'; _ctx.fillText('タイトルへ',_W/2,777);
}
