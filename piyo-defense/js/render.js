'use strict';

let _ctx, _W, _H;
function setRenderCtx(ctx, W, H) { _ctx = ctx; _W = W; _H = H; }

// ── Primitives ───────────────────────────────────────────────────────────────
function rrect(x, y, w, h, r, fill, stroke, lw) {
  lw = lw === undefined ? 2 : lw;
  _ctx.beginPath();
  _ctx.moveTo(x+r, y);
  _ctx.lineTo(x+w-r, y); _ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  _ctx.lineTo(x+w, y+h-r); _ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  _ctx.lineTo(x+r, y+h); _ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  _ctx.lineTo(x, y+r); _ctx.quadraticCurveTo(x, y, x+r, y);
  _ctx.closePath();
  if (fill)   { _ctx.fillStyle   = fill;   _ctx.fill();   }
  if (stroke) { _ctx.strokeStyle = stroke; _ctx.lineWidth = lw; _ctx.stroke(); }
}

function rrectGrd(x, y, w, h, r, grd, stroke, lw) {
  lw = lw === undefined ? 2 : lw;
  _ctx.beginPath();
  _ctx.moveTo(x+r, y);
  _ctx.lineTo(x+w-r, y); _ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  _ctx.lineTo(x+w, y+h-r); _ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  _ctx.lineTo(x+r, y+h); _ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  _ctx.lineTo(x, y+r); _ctx.quadraticCurveTo(x, y, x+r, y);
  _ctx.closePath();
  _ctx.fillStyle = grd; _ctx.fill();
  if (stroke) { _ctx.strokeStyle = stroke; _ctx.lineWidth = lw; _ctx.stroke(); }
}

// ── Background ───────────────────────────────────────────────────────────────
var _SBG = [
  { t:'#04091E', m:'#08142E', b:'#04080E' },
  { t:'#060820', m:'#0A1230', b:'#040610' },
  { t:'#0C0822', m:'#140C32', b:'#08061A' },
  { t:'#160622', m:'#1E082C', b:'#0C0414' },
  { t:'#220408', m:'#300606', b:'#180204' },
  { t:'#1C0604', m:'#280804', b:'#140402' },
  { t:'#100A1E', m:'#160C28', b:'#080612' },
  { t:'#1C0408', m:'#240406', b:'#0E0204' },
  { t:'#160010', m:'#1E0018', b:'#0C0008' },
  { t:'#09000C', m:'#110012', b:'#050006' },
  { t:'#04000A', m:'#06000F', b:'#020007' },
  { t:'#000308', m:'#000510', b:'#000204' },
  { t:'#060009', m:'#08000F', b:'#030004' },
  { t:'#080002', m:'#0C0004', b:'#040001' },
  { t:'#050004', m:'#090008', b:'#030003' },
  { t:'#000008', m:'#00000E', b:'#000004' },
  { t:'#050000', m:'#090000', b:'#030000' },
  { t:'#000505', m:'#000A0A', b:'#000303' },
  { t:'#020002', m:'#030003', b:'#010001' },
  { t:'#000000', m:'#010001', b:'#000000' },
];

function drawBg(frame, stage) {
  var si = Math.max(0, Math.min(19, (stage||1) - 1));
  var bg = _SBG[si];
  var g  = _ctx.createLinearGradient(0, 0, 0, _H);
  g.addColorStop(0, bg.t); g.addColorStop(0.6, bg.m); g.addColorStop(1, bg.b);
  _ctx.fillStyle = g; _ctx.fillRect(0, 0, _W, _H);
  var cnt = 58 + Math.min(si, 9) * 4;
  for (var i = 0; i < cnt; i++) {
    var sx = (i*141+47) % _W, sy = (i*233+31) % (_H*0.73);
    _ctx.globalAlpha = (Math.sin(frame*0.04+i)*0.22+0.62)*0.82;
    _ctx.fillStyle = si >= 14 ? '#FFAAFF' : si >= 7 ? '#FFCCCC' : si >= 4 ? '#FFE8CC' : '#FFFFFF';
    _ctx.beginPath(); _ctx.arc(sx, sy, 0.55+(i%4)*0.36, 0, Math.PI*2); _ctx.fill();
  }
  if (si >= 3) {
    var na = Math.min(0.13, (si-3)/7*0.13);
    var nc = si >= 14 ? '140,0,160' : si >= 7 ? '200,30,30' : si >= 4 ? '110,30,175' : '55,25,135';
    var ng = _ctx.createRadialGradient(_W*0.65, _H*0.25, 0, _W*0.65, _H*0.25, _W*0.72);
    ng.addColorStop(0, 'rgba('+nc+','+na+')'); ng.addColorStop(1, 'rgba('+nc+',0)');
    _ctx.globalAlpha = 1; _ctx.fillStyle = ng; _ctx.fillRect(0, 0, _W, _H);
  }
  _ctx.globalAlpha = 1;
}

function drawGround(stage) {
  var t   = Math.max(0, Math.min(1, ((stage||1)-1)/19));
  var r1  = Math.round(40+t*52), g1 = Math.round(138-t*112), b1 = Math.round(70-t*62);
  var r2  = Math.round(30+t*42), g2 = Math.round(106-t*92),  b2 = Math.round(54-t*50);
  var grd = _ctx.createLinearGradient(0, _H-128, 0, _H);
  grd.addColorStop(0, 'rgb('+r1+','+g1+','+b1+')');
  grd.addColorStop(1, 'rgb('+r2+','+g2+','+b2+')');
  _ctx.fillStyle = grd;
  _ctx.beginPath();
  _ctx.moveTo(0, _H-108);
  _ctx.quadraticCurveTo(_W*0.25, _H-125, _W*0.5, _H-112);
  _ctx.quadraticCurveTo(_W*0.75, _H-100, _W, _H-118);
  _ctx.lineTo(_W, _H); _ctx.lineTo(0, _H); _ctx.closePath(); _ctx.fill();
  _ctx.strokeStyle = 'rgba(255,255,255,0.12)'; _ctx.lineWidth = 2;
  _ctx.beginPath();
  _ctx.moveTo(0, _H-108);
  _ctx.quadraticCurveTo(_W*0.25, _H-125, _W*0.5, _H-112);
  _ctx.quadraticCurveTo(_W*0.75, _H-100, _W, _H-118);
  _ctx.stroke();
}

// ── Chick ────────────────────────────────────────────────────────────────────
function drawChick(x, y, sz, evolved, acc) {
  sz      = sz      === undefined ? 40    : sz;
  evolved = evolved === undefined ? false : evolved;
  acc     = acc     === undefined ? null  : acc;
  _ctx.save(); _ctx.translate(x, y);
  _ctx.shadowColor = 'rgba(0,0,0,0.5)'; _ctx.shadowBlur = sz*0.45;
  _ctx.shadowOffsetX = sz*0.05; _ctx.shadowOffsetY = sz*0.09;

  if (evolved) {
    _ctx.fillStyle = '#E74C3C'; _ctx.strokeStyle = '#922B21'; _ctx.lineWidth = 2;
    _ctx.beginPath();
    _ctx.moveTo(-7, -sz*0.72); _ctx.quadraticCurveTo(-13, -sz*1.0, -4, -sz*0.88);
    _ctx.quadraticCurveTo(0, -sz*1.12, 4, -sz*0.88); _ctx.quadraticCurveTo(13, -sz*1.0, 7, -sz*0.72);
    _ctx.closePath(); _ctx.fill(); _ctx.stroke();
  }

  var bg = _ctx.createRadialGradient(-sz*0.12, sz*0.0, sz*0.04, 0, sz*0.1, sz*0.56);
  bg.addColorStop(0,'#FFF9C4'); bg.addColorStop(0.45,'#FFE135'); bg.addColorStop(1,'#CC8800');
  _ctx.fillStyle = bg; _ctx.strokeStyle = '#B8860B'; _ctx.lineWidth = 2;
  _ctx.beginPath(); _ctx.ellipse(0, sz*0.1, sz*0.52, sz*0.48, 0, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();

  var hg = _ctx.createRadialGradient(-sz*0.08, -sz*0.38, sz*0.02, 0, -sz*0.3, sz*0.38);
  hg.addColorStop(0,'#FFFDE7'); hg.addColorStop(0.4,'#FFE135'); hg.addColorStop(1,'#C08000');
  _ctx.fillStyle = hg;
  _ctx.beginPath(); _ctx.arc(0, -sz*0.3, sz*0.36, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
  _ctx.shadowBlur = 0; _ctx.shadowOffsetX = 0; _ctx.shadowOffsetY = 0;

  _ctx.fillStyle = '#F0BF00'; _ctx.strokeStyle = '#B8860B'; _ctx.lineWidth = 1.5;
  _ctx.beginPath(); _ctx.ellipse(-sz*0.52, sz*0.08, sz*0.18, sz*0.26, -0.4, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
  _ctx.beginPath(); _ctx.ellipse( sz*0.52, sz*0.08, sz*0.18, sz*0.26,  0.4, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();

  if (evolved) {
    _ctx.fillStyle = '#E74C3C'; _ctx.strokeStyle = '#922B21'; _ctx.lineWidth = 1.5;
    _ctx.beginPath(); _ctx.arc(sz*0.12, -sz*0.1, sz*0.1, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
  }

  _ctx.fillStyle = '#222';
  _ctx.beginPath(); _ctx.arc(-sz*0.12, -sz*0.33, sz*0.078, 0, Math.PI*2); _ctx.fill();
  _ctx.beginPath(); _ctx.arc( sz*0.12, -sz*0.33, sz*0.078, 0, Math.PI*2); _ctx.fill();
  _ctx.fillStyle = '#fff';
  _ctx.beginPath(); _ctx.arc(-sz*0.09, -sz*0.355, sz*0.034, 0, Math.PI*2); _ctx.fill();
  _ctx.beginPath(); _ctx.arc( sz*0.15, -sz*0.355, sz*0.034, 0, Math.PI*2); _ctx.fill();
  _ctx.fillStyle = 'rgba(255,255,255,0.9)';
  _ctx.beginPath(); _ctx.arc(-sz*0.07, -sz*0.375, sz*0.019, 0, Math.PI*2); _ctx.fill();
  _ctx.beginPath(); _ctx.arc( sz*0.17, -sz*0.375, sz*0.019, 0, Math.PI*2); _ctx.fill();

  _ctx.fillStyle = '#FF8C00'; _ctx.strokeStyle = '#CC5500'; _ctx.lineWidth = 1.5;
  _ctx.beginPath();
  _ctx.moveTo(-sz*0.1, -sz*0.22); _ctx.lineTo(sz*0.1, -sz*0.22); _ctx.lineTo(0, -sz*0.1); _ctx.closePath(); _ctx.fill(); _ctx.stroke();

  _ctx.strokeStyle = '#FF8C00'; _ctx.lineWidth = 2.5; _ctx.lineCap = 'round';
  [[-sz*0.18, sz*0.55],[sz*0.18, sz*0.55]].forEach(function(ft) {
    _ctx.beginPath(); _ctx.moveTo(ft[0], ft[1]); _ctx.lineTo(ft[0]-sz*0.12, ft[1]+sz*0.12); _ctx.stroke();
    _ctx.beginPath(); _ctx.moveTo(ft[0], ft[1]); _ctx.lineTo(ft[0]+sz*0.12, ft[1]+sz*0.12); _ctx.stroke();
    _ctx.beginPath(); _ctx.moveTo(ft[0], ft[1]); _ctx.lineTo(ft[0], ft[1]+sz*0.16); _ctx.stroke();
  });

  if (acc === 'glasses') {
    _ctx.strokeStyle = '#555'; _ctx.lineWidth = 2;
    _ctx.beginPath(); _ctx.arc(-sz*0.12, -sz*0.33, sz*0.14, 0, Math.PI*2); _ctx.stroke();
    _ctx.beginPath(); _ctx.arc( sz*0.12, -sz*0.33, sz*0.14, 0, Math.PI*2); _ctx.stroke();
    _ctx.beginPath(); _ctx.moveTo(-sz*0.02, -sz*0.33); _ctx.lineTo(sz*0.02, -sz*0.33); _ctx.stroke();
  } else if (acc === 'nurse') {
    rrect(-sz*0.3, -sz*0.72, sz*0.6, sz*0.28, 3, '#fff', '#ddd', 1.5);
    _ctx.fillStyle = '#FF6B6B';
    _ctx.fillRect(-sz*0.05, -sz*0.7,  sz*0.1,  sz*0.22);
    _ctx.fillRect(-sz*0.15, -sz*0.56, sz*0.3,  sz*0.08);
  } else if (acc === 'helmet') {
    _ctx.fillStyle = '#4ECDC4'; _ctx.strokeStyle = '#2E9E96'; _ctx.lineWidth = 2;
    _ctx.beginPath(); _ctx.arc(0, -sz*0.3, sz*0.4, Math.PI, 0); _ctx.fill(); _ctx.stroke();
    _ctx.fillStyle = '#2E9E96'; _ctx.fillRect(-sz*0.4, -sz*0.36, sz*0.8, sz*0.09);
  }
  _ctx.restore();
}

// ── Crow colors (全種類) ─────────────────────────────────────────────────────
var CROW_COLORS = {
  normal:    { wing:'#141414', body:'#282828', hi:'#424242', eye:'#FF1A1A', glow:'rgba(255,20,20,0.55)'   },
  fast:      { wing:'#001166', body:'#163388', hi:'#2850BB', eye:'#00EEFF', glow:'rgba(0,220,255,0.55)'   },
  ranged:    { wing:'#1A3A1A', body:'#1E6B1E', hi:'#3AAA3A', eye:'#FFCC00', glow:'rgba(255,210,0,0.58)'  },
  tank:      { wing:'#3A0000', body:'#7A0000', hi:'#BB1818', eye:'#FF5500', glow:'rgba(255,80,0,0.55)'    },
  ghost:     { wing:'#5A6A88', body:'#7A92AF', hi:'#A8C0D0', eye:'#88EEFF', glow:'rgba(100,210,255,0.55)' },
  healer:    { wing:'#7A1A4A', body:'#AA2060', hi:'#D85090', eye:'#FF88CC', glow:'rgba(255,120,200,0.58)' },
  bomber:    { wing:'#3A1800', body:'#8C3200', hi:'#CC5010', eye:'#FF8C00', glow:'rgba(255,110,0,0.60)'   },
  sprinter:  { wing:'#2A4400', body:'#548B00', hi:'#88CC00', eye:'#AAFF00', glow:'rgba(140,220,0,0.60)'   },
  armored:   { wing:'#2A2A3A', body:'#4A5060', hi:'#7A88A0', eye:'#AACCFF', glow:'rgba(140,180,255,0.50)' },
  regen:     { wing:'#003A14', body:'#006B28', hi:'#00AA40', eye:'#44FF88', glow:'rgba(40,220,100,0.58)'   },
  shielded:  { wing:'#0A1A3A', body:'#102866', hi:'#2050BB', eye:'#66AAFF', glow:'rgba(80,150,255,0.60)'  },
  splitter:  { wing:'#2A004A', body:'#550088', hi:'#8800CC', eye:'#CC44FF', glow:'rgba(180,60,255,0.60)'   },
  swarm:     { wing:'#3A0808', body:'#6A0C0C', hi:'#991414', eye:'#FF3333', glow:'rgba(220,40,40,0.50)'    },
  // 新型
  poison:    { wing:'#1A3A00', body:'#2A5A10', hi:'#55AA22', eye:'#AAFF44', glow:'rgba(140,255,60,0.65)'  },
  stealth:   { wing:'#1A1A2A', body:'#2A2A3A', hi:'#4A4A6A', eye:'#CCAAFF', glow:'rgba(180,140,255,0.60)' },
  berserker: { wing:'#4A0000', body:'#880000', hi:'#CC2222', eye:'#FF4400', glow:'rgba(255,60,0,0.70)'    },
  titan:     { wing:'#1A1A1A', body:'#333333', hi:'#555555', eye:'#FFAA00', glow:'rgba(255,160,0,0.65)'   },
  leech:     { wing:'#3A0020', body:'#660040', hi:'#AA0066', eye:'#FF44AA', glow:'rgba(255,60,160,0.60)'  },
  necro:     { wing:'#0A2A0A', body:'#103010', hi:'#228822', eye:'#88FF66', glow:'rgba(120,255,80,0.60)'  },
  phantom:   { wing:'#2A2A4A', body:'#3A3A6A', hi:'#6060AA', eye:'#FFFFFF', glow:'rgba(200,200,255,0.70)' },
};

function drawCrow(e) {
  _ctx.save();
  _ctx.translate(e.x, e.y + Math.sin(e.wobble) * 4);
  var s = e.size;
  var c = CROW_COLORS[e.type] || CROW_COLORS.normal;
  var al = (e.hitFlash > 0 && e.hitFlash % 2 === 0) ? 0.25 : 1.0;

  // ゴースト：透明パルス
  if (e.type === 'ghost') al *= (0.20 + Math.abs(Math.sin(e.wobble * 0.30)) * 0.80);
  // ステルス：完全透明
  if (e.type === 'stealth' && e.isHidden) al *= 0.06;
  // ファントム：幽霊的な透明感
  if (e.type === 'phantom') al *= (0.55 + Math.abs(Math.sin(e.wobble * 0.4)) * 0.45);

  _ctx.globalAlpha = al;
  // 影
  _ctx.globalAlpha = al * 0.38;
  _ctx.fillStyle = 'rgba(0,0,0,0.55)';
  _ctx.beginPath(); _ctx.ellipse(0, s*0.9, s*0.46, s*0.1, 0, 0, Math.PI*2); _ctx.fill();
  _ctx.globalAlpha = al;

  // スプリンター：ダッシュ中速度線
  if (e.type === 'sprinter' && e.sprintPhase === 1) {
    _ctx.globalAlpha = al*0.55; _ctx.strokeStyle = '#AAFF00'; _ctx.lineWidth = 2;
    for (var sl = 0; sl < 3; sl++) {
      _ctx.shadowColor = '#88FF00'; _ctx.shadowBlur = 6;
      _ctx.beginPath(); _ctx.moveTo((sl-1)*12, -s*0.4); _ctx.lineTo((sl-1)*12, s*1.2); _ctx.stroke();
    }
    _ctx.shadowBlur = 0; _ctx.globalAlpha = al;
  }
  // 装甲：金属オーバーレイ
  if (e.type === 'armored') {
    _ctx.globalAlpha = al*0.35; _ctx.strokeStyle = '#AACCFF'; _ctx.lineWidth = 2.5;
    _ctx.shadowColor = '#8899BB'; _ctx.shadowBlur = 8;
    _ctx.beginPath(); _ctx.ellipse(0, 0, s*0.52, s*0.46, 0, 0, Math.PI*2); _ctx.stroke();
    _ctx.shadowBlur = 0; _ctx.globalAlpha = al;
  }
  // リジェネ：回復パルス
  if (e.type === 'regen' && e.regenTimer > 55) {
    var rr = (e.regenTimer-55)/30;
    _ctx.globalAlpha = al*rr*0.35; _ctx.shadowColor = '#44FF88'; _ctx.shadowBlur = 14;
    _ctx.fillStyle = '#44FF88'; _ctx.beginPath(); _ctx.arc(0, 0, s*0.80, 0, Math.PI*2); _ctx.fill();
    _ctx.shadowBlur = 0; _ctx.globalAlpha = al;
  }
  // シールド
  if (e.type === 'shielded' && e.shield > 0) {
    var sr = e.shield/e.maxShield;
    _ctx.globalAlpha = al*(0.15+sr*0.25); _ctx.shadowColor = '#66AAFF'; _ctx.shadowBlur = 16;
    _ctx.fillStyle = '#2266CC'; _ctx.beginPath(); _ctx.arc(0, 0, s*0.95, 0, Math.PI*2); _ctx.fill();
    _ctx.shadowBlur = 0; _ctx.globalAlpha = al*(0.35+sr*0.25); _ctx.strokeStyle = '#88CCFF'; _ctx.lineWidth = 2.5;
    _ctx.beginPath(); _ctx.arc(0, 0, s*0.95, 0, Math.PI*2); _ctx.stroke(); _ctx.globalAlpha = al;
  }
  // 分裂：紫のクラック
  if (e.type === 'splitter') {
    _ctx.globalAlpha = al*0.5; _ctx.strokeStyle = '#CC44FF'; _ctx.lineWidth = 1.5;
    _ctx.shadowColor = '#AA00FF'; _ctx.shadowBlur = 8;
    _ctx.beginPath(); _ctx.moveTo(-s*0.3,-s*0.4); _ctx.lineTo(0,0); _ctx.lineTo(s*0.3,-s*0.4); _ctx.stroke();
    _ctx.beginPath(); _ctx.moveTo(-s*0.2,s*0.3); _ctx.lineTo(0,0); _ctx.lineTo(s*0.2,s*0.3); _ctx.stroke();
    _ctx.shadowBlur = 0; _ctx.globalAlpha = al;
  }
  // ヒーラー：回復オーラ
  if (e.type === 'healer' && e.healTimer > 55) {
    var hr = Math.min(1,(e.healTimer-55)/40);
    _ctx.globalAlpha = al*hr*0.42; _ctx.shadowColor = '#FF88CC'; _ctx.shadowBlur = 22;
    _ctx.fillStyle = '#FF88CC'; _ctx.beginPath(); _ctx.arc(0, 0, s*0.88, 0, Math.PI*2); _ctx.fill();
    _ctx.shadowBlur = 0; _ctx.globalAlpha = al;
  }
  // ボンバー：ヒューズ光
  if (e.type === 'bomber' && e.y > 180) {
    var fuse = Math.min(1,(e.y-180)/(_H-320));
    var fuseFlash = Math.abs(Math.sin(e.wobble*(1.2+fuse*3.5)));
    _ctx.globalAlpha = al*fuse*fuseFlash*0.55; _ctx.shadowColor = '#FF5500'; _ctx.shadowBlur = 26;
    _ctx.fillStyle = '#FF7700'; _ctx.beginPath(); _ctx.arc(0, 0, s*0.94, 0, Math.PI*2); _ctx.fill();
    _ctx.shadowBlur = 0; _ctx.globalAlpha = al;
  }
  // 遠距離：チャージオーラ
  if (e.type === 'ranged' && e.rangedTimer > 35) {
    var cr = Math.min(1,(e.rangedTimer-35)/45);
    _ctx.globalAlpha = al*cr*0.55; _ctx.shadowColor = '#FFCC00'; _ctx.shadowBlur = 20;
    _ctx.fillStyle = '#FFE040'; _ctx.beginPath(); _ctx.arc(0, 0, s*0.78, 0, Math.PI*2); _ctx.fill();
    _ctx.shadowBlur = 0; _ctx.globalAlpha = al;
  }
  // 毒型：緑バブル
  if (e.type === 'poison') {
    var pb = Math.abs(Math.sin(e.wobble * 1.2)) * 0.4;
    _ctx.globalAlpha = al * (0.15 + pb * 0.3); _ctx.shadowColor = '#88FF44'; _ctx.shadowBlur = 12;
    _ctx.fillStyle = '#66EE22'; _ctx.beginPath(); _ctx.arc(0, -s*0.1, s*0.85, 0, Math.PI*2); _ctx.fill();
    _ctx.shadowBlur = 0; _ctx.globalAlpha = al;
  }
  // バーサーカー：エンレイジ時赤炎
  if (e.type === 'berserker' && e.enraged) {
    var rage = Math.abs(Math.sin(e.wobble * 2.0));
    _ctx.globalAlpha = al * (0.3 + rage * 0.35); _ctx.shadowColor = '#FF2200'; _ctx.shadowBlur = 22;
    _ctx.fillStyle = '#FF4400'; _ctx.beginPath(); _ctx.arc(0, 0, s * 1.05, 0, Math.PI*2); _ctx.fill();
    _ctx.shadowBlur = 0; _ctx.globalAlpha = al;
  }
  // タイタン：金属アーマーオーバーレイ
  if (e.type === 'titan') {
    _ctx.globalAlpha = al * 0.4; _ctx.strokeStyle = '#AAAAAA'; _ctx.lineWidth = 4;
    _ctx.shadowColor = '#888888'; _ctx.shadowBlur = 10;
    _ctx.beginPath(); _ctx.ellipse(0, 0, s*0.55, s*0.50, 0, 0, Math.PI*2); _ctx.stroke();
    _ctx.shadowBlur = 0; _ctx.globalAlpha = al;
  }
  // ネクロ：死亡待機時の幽霊エフェクト
  if (e.type === 'necro' && !e.necroRevived) {
    _ctx.globalAlpha = al * 0.28; _ctx.shadowColor = '#88FF66'; _ctx.shadowBlur = 16;
    _ctx.fillStyle = '#44AA44'; _ctx.beginPath(); _ctx.arc(0, 0, s*0.82, 0, Math.PI*2); _ctx.fill();
    _ctx.shadowBlur = 0; _ctx.globalAlpha = al;
  }

  // ── 共通ボディ描画 ───────────────────────────────────────────────────────
  _ctx.fillStyle = c.wing; _ctx.strokeStyle = 'rgba(0,0,0,0.6)'; _ctx.lineWidth = 1.5;
  _ctx.beginPath();
  _ctx.moveTo(-s*0.1, -s*0.05);
  _ctx.quadraticCurveTo(-s*0.85, -s*0.45, -s*0.65, s*0.25);
  _ctx.quadraticCurveTo(-s*0.35, s*0.1, -s*0.1, s*0.05);
  _ctx.closePath(); _ctx.fill(); _ctx.stroke();
  _ctx.beginPath();
  _ctx.moveTo(s*0.1, -s*0.05);
  _ctx.quadraticCurveTo(s*0.85, -s*0.45, s*0.65, s*0.25);
  _ctx.quadraticCurveTo(s*0.35, s*0.1, s*0.1, s*0.05);
  _ctx.closePath(); _ctx.fill(); _ctx.stroke();

  var bG = _ctx.createRadialGradient(-s*0.14, -s*0.08, s*0.04, 0, 0, s*0.5);
  bG.addColorStop(0, c.hi); bG.addColorStop(1, c.body);
  _ctx.fillStyle = bG; _ctx.strokeStyle = 'rgba(0,0,0,0.7)'; _ctx.lineWidth = 1.5;
  _ctx.beginPath(); _ctx.ellipse(0, 0, s*0.45, s*0.4, 0, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();

  var hG = _ctx.createRadialGradient(s*0.14, -s*0.35, s*0.04, s*0.28, -s*0.28, s*0.3);
  hG.addColorStop(0, c.hi); hG.addColorStop(1, c.body);
  _ctx.fillStyle = hG;
  _ctx.beginPath(); _ctx.arc(s*0.28, -s*0.28, s*0.28, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();

  _ctx.fillStyle = '#555';
  _ctx.beginPath(); _ctx.moveTo(s*0.5,-s*0.22); _ctx.lineTo(s*0.82,-s*0.16); _ctx.lineTo(s*0.5,-s*0.08); _ctx.closePath(); _ctx.fill();

  _ctx.shadowColor = c.glow; _ctx.shadowBlur = s*0.45;
  _ctx.fillStyle = c.eye;
  _ctx.beginPath(); _ctx.arc(s*0.33, -s*0.3, s*0.09, 0, Math.PI*2); _ctx.fill();
  _ctx.shadowBlur = 0;
  _ctx.fillStyle = '#000'; _ctx.beginPath(); _ctx.arc(s*0.35, -s*0.3, s*0.05, 0, Math.PI*2); _ctx.fill();
  _ctx.fillStyle = 'rgba(255,255,255,0.85)'; _ctx.beginPath(); _ctx.arc(s*0.37, -s*0.32, s*0.025, 0, Math.PI*2); _ctx.fill();

  // タイタン：追加の鎧プレート
  if (e.type === 'titan') {
    _ctx.fillStyle = 'rgba(150,150,160,0.45)'; _ctx.strokeStyle = '#888'; _ctx.lineWidth = 1.5;
    _ctx.beginPath(); _ctx.rect(-s*0.35, -s*0.28, s*0.7, s*0.5); _ctx.fill(); _ctx.stroke();
    _ctx.fillStyle = 'rgba(200,200,210,0.25)';
    _ctx.beginPath(); _ctx.moveTo(-s*0.35,-s*0.28); _ctx.lineTo(s*0.35,-s*0.28); _ctx.lineTo(s*0.35,-s*0.14); _ctx.lineTo(-s*0.35,-s*0.14); _ctx.closePath(); _ctx.fill();
  }

  // HPバー（重要度高い敵のみ）
  var showHp = (e.type === 'tank' || e.type === 'healer' || e.type === 'bomber' ||
    e.type === 'splitter' || e.type === 'regen' || e.type === 'shielded' ||
    e.type === 'titan' || e.type === 'leech' || e.type === 'necro' || e.maxHp > 14);
  if (showHp) {
    var bw = s*1.6, bx = -bw/2, by = s*0.65;
    rrect(bx-1, by-1, bw+2, 12, 4, 'rgba(0,0,0,0.75)', null);
    var ratio2 = e.hp/e.maxHp;
    var hc = ratio2 > 0.5 ? '#2ECC71' : ratio2 > 0.25 ? '#F39C12' : '#E74C3C';
    rrect(bx, by, bw*ratio2, 10, 3, hc, null);
    // ネクロ復活時は緑バー表示
    if (e.type === 'necro' && e.necroRevived) {
      _ctx.fillStyle = '#88FF66'; _ctx.font = 'bold 7px sans-serif'; _ctx.textAlign = 'center';
      _ctx.fillText('復活！', 0, by-2);
    }
  }
  // シールドバー
  if (e.type === 'shielded' && e.shield > 0) {
    var sbw = s*1.6, sbx = -sbw/2, sby = s*0.80;
    rrect(sbx, sby, sbw*(e.shield/e.maxShield), 6, 3, '#66AAFF', null);
  }

  _ctx.globalAlpha = 1; _ctx.restore();
}

// ── Boss UFO ─────────────────────────────────────────────────────────────────
function drawBoss(e, frame) {
  if (e.type === 'boss_chicken') { drawBossChicken(e, frame); return; }
  if (e.type === 'boss_snake')   { drawBossSnake(e, frame);   return; }
  if (e.type.startsWith('boss_s')) {
    var cfg = typeof BOSS_CONFIG !== 'undefined' ? BOSS_CONFIG[e._stageNum] : null;
    if (cfg) {
      switch (cfg.arch) {
        case 'bird':    drawBossArchBird(e, frame, cfg);    return;
        case 'beast':   drawBossArchBeast(e, frame, cfg);   return;
        case 'reptile': drawBossArchReptile(e, frame, cfg); return;
        case 'mech':    drawBossArchMech(e, frame, cfg);    return;
        case 'final':   drawBossArchFinal(e, frame, cfg);   return;
      }
    }
  }
  // UFOボス (既存)
  _ctx.save(); _ctx.translate(e.x, e.y);
  var s = e.size;
  var al = (e.hitFlash > 0 && e.hitFlash % 2 === 0) ? 0.25 : 1.0;
  _ctx.globalAlpha = al;

  if (e.bossTimer > 92) {
    var wa = (e.bossTimer-92)/20;
    _ctx.globalAlpha = al*wa*0.55;
    var bG2 = _ctx.createLinearGradient(0, s*0.4, 0, _H-e.y);
    bG2.addColorStop(0,'rgba(200,80,255,0.95)'); bG2.addColorStop(1,'rgba(155,89,182,0)');
    _ctx.fillStyle = bG2;
    _ctx.beginPath(); _ctx.moveTo(-32,s*0.4); _ctx.lineTo(32,s*0.4); _ctx.lineTo(100,_H-e.y); _ctx.lineTo(-100,_H-e.y); _ctx.closePath(); _ctx.fill();
    _ctx.globalAlpha = al;
  }

  var phase = e.phase||1;
  var auraBase = phase===3?'rgba(255,60,60,':'rgba(175,75,255,';
  var pa = (0.07+Math.sin(frame*(0.05+phase*0.02))*0.04)*al*(1+(phase-1)*0.5);
  var aG = _ctx.createRadialGradient(0,0,s*0.3,0,0,s*(1.4+(phase-1)*0.2));
  aG.addColorStop(0,auraBase+pa+')'); aG.addColorStop(1,auraBase+'0)');
  _ctx.fillStyle = aG; _ctx.beginPath(); _ctx.arc(0,0,s*1.6,0,Math.PI*2); _ctx.fill();
  if (phase >= 2) {
    _ctx.globalAlpha = al*(0.12+Math.sin(frame*0.12)*0.08);
    _ctx.strokeStyle = phase===3?'#FF4444':'#FF8800'; _ctx.lineWidth = phase===3?4:2.5;
    _ctx.beginPath(); _ctx.arc(0,0,s*1.6,0,Math.PI*2); _ctx.stroke(); _ctx.globalAlpha = al;
  }

  _ctx.shadowColor = '#AA55FF'; _ctx.shadowBlur = 20;
  var dG = _ctx.createRadialGradient(0,s*0.0,s*0.1,0,s*0.1,s*1.0);
  dG.addColorStop(0,'#8868C8'); dG.addColorStop(0.5,'#504070'); dG.addColorStop(1,'#281840');
  _ctx.fillStyle = dG; _ctx.strokeStyle = '#CC88FF'; _ctx.lineWidth = 2.5;
  _ctx.beginPath(); _ctx.ellipse(0,s*0.1,s*0.95,s*0.24,0,0,Math.PI*2); _ctx.fill(); _ctx.stroke();
  _ctx.shadowBlur = 0;
  _ctx.fillStyle = 'rgba(200,160,255,0.18)';
  _ctx.beginPath(); _ctx.ellipse(0,s*0.02,s*0.65,s*0.11,0,0,Math.PI*2); _ctx.fill();

  _ctx.shadowColor = '#DD88FF'; _ctx.shadowBlur = 18;
  var dmG = _ctx.createRadialGradient(-s*0.18,-s*0.28,s*0.04,0,-s*0.1,s*0.55);
  dmG.addColorStop(0,'rgba(230,170,255,0.82)'); dmG.addColorStop(0.6,'rgba(160,80,240,0.50)'); dmG.addColorStop(1,'rgba(100,40,180,0.22)');
  _ctx.fillStyle = dmG; _ctx.strokeStyle = '#EE99FF'; _ctx.lineWidth = 2;
  _ctx.beginPath(); _ctx.ellipse(0,-s*0.05,s*0.5,s*0.5,0,Math.PI,0); _ctx.fill(); _ctx.stroke();
  _ctx.shadowBlur = 0;

  ['#FF3333','#33FF66','#CC44FF','#FFFF33','#FF33FF'].forEach(function(col,i) {
    var a2 = (frame*0.06)+i*(Math.PI*2/5);
    _ctx.shadowColor=col; _ctx.shadowBlur=10; _ctx.fillStyle=col;
    _ctx.beginPath(); _ctx.arc(Math.cos(a2)*s*0.62,s*0.08+Math.sin(a2)*s*0.12,5.5,0,Math.PI*2); _ctx.fill();
  });
  _ctx.shadowBlur = 0;
  _ctx.fillStyle='#111'; _ctx.strokeStyle='#000'; _ctx.lineWidth=2;
  _ctx.beginPath(); _ctx.ellipse(0,-s*0.62,s*0.22,s*0.18,0,0,Math.PI*2); _ctx.fill(); _ctx.stroke();
  _ctx.beginPath(); _ctx.arc(s*0.15,-s*0.82,s*0.16,0,Math.PI*2); _ctx.fill(); _ctx.stroke();
  _ctx.shadowColor='#FF44FF'; _ctx.shadowBlur=8; _ctx.fillStyle='#FF00FF';
  _ctx.beginPath(); _ctx.arc(s*0.2,-s*0.83,4.5,0,Math.PI*2); _ctx.fill(); _ctx.shadowBlur=0;
  _ctx.fillStyle='#000'; _ctx.beginPath(); _ctx.arc(s*0.21,-s*0.83,2.5,0,Math.PI*2); _ctx.fill();
  _ctx.fillStyle='#444'; _ctx.beginPath(); _ctx.moveTo(s*0.28,-s*0.78); _ctx.lineTo(s*0.45,-s*0.75); _ctx.lineTo(s*0.28,-s*0.7); _ctx.closePath(); _ctx.fill();

  _drawBossHpBar(e, s, 'BOSS UFO', '#EE99FF', '#E066FF', '#7B00CC', '#7733AA');
  _ctx.globalAlpha=1; _ctx.restore();
}

// ── Boss Chicken（ニワトリ大魔王） ───────────────────────────────────────────
function drawBossChicken(e, frame) {
  _ctx.save(); _ctx.translate(e.x, e.y);
  var s  = e.size;
  var al = (e.hitFlash > 0 && e.hitFlash % 2 === 0) ? 0.25 : 1.0;
  _ctx.globalAlpha = al;

  var phase = e.phase || 1;
  // 怒りオーラ
  var auraCol = phase===3 ? 'rgba(255,80,0,' : phase===2 ? 'rgba(255,160,0,' : 'rgba(255,220,80,';
  var pa2 = (0.06 + Math.sin(frame*0.06)*0.04)*al*(1+(phase-1)*0.6);
  var aG2 = _ctx.createRadialGradient(0,0,s*0.3,0,0,s*1.5);
  aG2.addColorStop(0,auraCol+pa2+')'); aG2.addColorStop(1,auraCol+'0)');
  _ctx.fillStyle=aG2; _ctx.beginPath(); _ctx.arc(0,0,s*1.6,0,Math.PI*2); _ctx.fill();
  if (phase>=2) {
    _ctx.globalAlpha=al*(0.14+Math.sin(frame*0.1)*0.08);
    _ctx.strokeStyle=phase===3?'#FF4400':'#FF8800'; _ctx.lineWidth=phase===3?5:3;
    _ctx.beginPath(); _ctx.arc(0,0,s*1.4,0,Math.PI*2); _ctx.stroke(); _ctx.globalAlpha=al;
  }

  // 尾羽（後ろ）
  _ctx.fillStyle='#8B4513';
  for (var fi=0;fi<5;fi++) {
    var fa = -0.5 + fi*0.25;
    _ctx.beginPath(); _ctx.moveTo(0,s*0.1);
    _ctx.quadraticCurveTo(Math.sin(fa)*s*1.0, s*0.5, Math.sin(fa)*s*1.3, s*0.2+Math.cos(fa)*s*0.8);
    _ctx.lineWidth=8-(fi%3)*2; _ctx.strokeStyle=['#8B4513','#D2691E','#FF8C00','#CC6600','#994400'][fi];
    _ctx.stroke();
  }
  // 胴体
  var bodyG = _ctx.createRadialGradient(-s*0.1,-s*0.1,s*0.05,0,0,s*0.6);
  bodyG.addColorStop(0,'#FF8C00'); bodyG.addColorStop(0.5,'#CC5500'); bodyG.addColorStop(1,'#882200');
  _ctx.fillStyle=bodyG; _ctx.strokeStyle='rgba(0,0,0,0.6)'; _ctx.lineWidth=2;
  _ctx.beginPath(); _ctx.ellipse(0,s*0.1,s*0.52,s*0.48,0,0,Math.PI*2); _ctx.fill(); _ctx.stroke();
  // 頭
  var headG = _ctx.createRadialGradient(-s*0.06,-s*0.35,s*0.02,0,-s*0.28,s*0.38);
  headG.addColorStop(0,'#FFA030'); headG.addColorStop(1,'#AA4400');
  _ctx.fillStyle=headG; _ctx.beginPath(); _ctx.arc(0,-s*0.28,s*0.36,0,Math.PI*2); _ctx.fill(); _ctx.stroke();
  // 冠（トサカ）
  _ctx.fillStyle='#FF2222'; _ctx.strokeStyle='#AA0000'; _ctx.lineWidth=1.5;
  for (var ci=0;ci<4;ci++) {
    var cx2 = (ci-1.5)*s*0.14;
    _ctx.beginPath(); _ctx.ellipse(cx2,-s*0.66-Math.abs(ci-1.5)*s*0.08,s*0.08,s*0.18,0,0,Math.PI*2); _ctx.fill(); _ctx.stroke();
  }
  // くちばし
  _ctx.fillStyle='#FFCC00'; _ctx.strokeStyle='#AA8800'; _ctx.lineWidth=1.5;
  _ctx.beginPath(); _ctx.moveTo(-s*0.12,-s*0.22); _ctx.lineTo(s*0.12,-s*0.22); _ctx.lineTo(0,-s*0.08); _ctx.closePath(); _ctx.fill(); _ctx.stroke();
  // 目（怒り目）
  _ctx.fillStyle='#FF2200'; _ctx.shadowColor='#FF0000'; _ctx.shadowBlur=s*0.3;
  _ctx.beginPath(); _ctx.arc(-s*0.13,-s*0.3,s*0.09,0,Math.PI*2); _ctx.fill();
  _ctx.beginPath(); _ctx.arc( s*0.13,-s*0.3,s*0.09,0,Math.PI*2); _ctx.fill();
  _ctx.shadowBlur=0; _ctx.fillStyle='#000';
  _ctx.beginPath(); _ctx.arc(-s*0.13,-s*0.3,s*0.05,0,Math.PI*2); _ctx.fill();
  _ctx.beginPath(); _ctx.arc( s*0.13,-s*0.3,s*0.05,0,Math.PI*2); _ctx.fill();
  // 翼
  _ctx.fillStyle='#AA4400'; _ctx.strokeStyle='rgba(0,0,0,0.5)'; _ctx.lineWidth=1.5;
  _ctx.beginPath(); _ctx.moveTo(-s*0.08,-s*0.05); _ctx.quadraticCurveTo(-s*0.9,-s*0.4,-s*0.7,s*0.3); _ctx.quadraticCurveTo(-s*0.35,s*0.1,-s*0.08,s*0.05); _ctx.closePath(); _ctx.fill(); _ctx.stroke();
  _ctx.beginPath(); _ctx.moveTo( s*0.08,-s*0.05); _ctx.quadraticCurveTo( s*0.9,-s*0.4, s*0.7,s*0.3); _ctx.quadraticCurveTo( s*0.35,s*0.1, s*0.08,s*0.05); _ctx.closePath(); _ctx.fill(); _ctx.stroke();
  // 肉垂（あごの赤いやつ）
  _ctx.fillStyle='#FF3333'; _ctx.strokeStyle='#CC0000'; _ctx.lineWidth=1.5;
  _ctx.beginPath(); _ctx.ellipse(0,-s*0.08,s*0.09,s*0.14,0,0,Math.PI*2); _ctx.fill(); _ctx.stroke();

  _drawBossHpBar(e, s, 'ニワトリ大魔王', '#FFCC66', '#FF8800', '#CC4400', '#884400');
  _ctx.globalAlpha=1; _ctx.restore();
}

// ── Boss Snake（巨大ヘビ） ────────────────────────────────────────────────────
function drawBossSnake(e, frame) {
  // 潜伏中は非表示
  if (e.isBurrowed) return;
  _ctx.save(); _ctx.translate(e.x, e.y);
  var s  = e.size;
  var al = (e.hitFlash > 0 && e.hitFlash % 2 === 0) ? 0.25 : 1.0;
  _ctx.globalAlpha = al;
  var phase = e.phase || 1;

  // オーラ
  var snakeAura = phase===3 ? 'rgba(80,220,80,' : 'rgba(50,180,50,';
  var spa = (0.06+Math.sin(frame*0.05)*0.04)*al;
  var sG = _ctx.createRadialGradient(0,0,s*0.3,0,0,s*1.5);
  sG.addColorStop(0,snakeAura+(spa)+')'); sG.addColorStop(1,snakeAura+'0)');
  _ctx.fillStyle=sG; _ctx.beginPath(); _ctx.arc(0,0,s*1.6,0,Math.PI*2); _ctx.fill();

  // 尻尾セグメント（後ろに描く）
  _ctx.strokeStyle='#2A6A2A'; _ctx.lineWidth=s*0.55;
  _ctx.lineCap='round';
  _ctx.beginPath();
  _ctx.moveTo(0,s*0.3);
  _ctx.quadraticCurveTo(-s*0.8,s*0.8,-s*0.5,s*1.4);
  _ctx.quadraticCurveTo(s*0.3,s*1.8,s*0.6,s*1.2);
  _ctx.stroke();
  _ctx.strokeStyle='#3A8A3A'; _ctx.lineWidth=s*0.35;
  _ctx.beginPath();
  _ctx.moveTo(0,s*0.3);
  _ctx.quadraticCurveTo(-s*0.8,s*0.8,-s*0.5,s*1.4);
  _ctx.quadraticCurveTo(s*0.3,s*1.8,s*0.6,s*1.2);
  _ctx.stroke();

  // 胴体（楕円）
  var snakeBodyG = _ctx.createRadialGradient(-s*0.12,-s*0.1,s*0.05,0,0,s*0.58);
  snakeBodyG.addColorStop(0,'#55AA44'); snakeBodyG.addColorStop(0.6,'#336622'); snakeBodyG.addColorStop(1,'#1A3A10');
  _ctx.fillStyle=snakeBodyG; _ctx.strokeStyle='rgba(0,0,0,0.6)'; _ctx.lineWidth=2;
  _ctx.beginPath(); _ctx.ellipse(0,s*0.08,s*0.52,s*0.44,0,0,Math.PI*2); _ctx.fill(); _ctx.stroke();
  // 鱗模様
  _ctx.strokeStyle='rgba(80,180,60,0.35)'; _ctx.lineWidth=1.5;
  for (var sci=0;sci<3;sci++) {
    _ctx.beginPath(); _ctx.arc(0,s*0.08,s*(0.22+sci*0.12),0,Math.PI*2); _ctx.stroke();
  }

  // 頭
  var snakeHeadG = _ctx.createRadialGradient(-s*0.08,-s*0.36,s*0.02,0,-s*0.3,s*0.40);
  snakeHeadG.addColorStop(0,'#66CC44'); snakeHeadG.addColorStop(1,'#224A18');
  _ctx.fillStyle=snakeHeadG; _ctx.strokeStyle='rgba(0,0,0,0.6)'; _ctx.lineWidth=2;
  _ctx.beginPath(); _ctx.ellipse(0,-s*0.3,s*0.42,s*0.32,0,0,Math.PI*2); _ctx.fill(); _ctx.stroke();

  // 目（縦長の瞳）
  _ctx.fillStyle='#FFEE00'; _ctx.shadowColor='#88FF44'; _ctx.shadowBlur=s*0.3;
  _ctx.beginPath(); _ctx.ellipse(-s*0.16,-s*0.33,s*0.1,s*0.12,0,0,Math.PI*2); _ctx.fill();
  _ctx.beginPath(); _ctx.ellipse( s*0.16,-s*0.33,s*0.1,s*0.12,0,0,Math.PI*2); _ctx.fill();
  _ctx.shadowBlur=0; _ctx.fillStyle='#000';
  _ctx.beginPath(); _ctx.ellipse(-s*0.16,-s*0.33,s*0.04,s*0.10,0,0,Math.PI*2); _ctx.fill();
  _ctx.beginPath(); _ctx.ellipse( s*0.16,-s*0.33,s*0.04,s*0.10,0,0,Math.PI*2); _ctx.fill();

  // 舌
  _ctx.strokeStyle='#FF4444'; _ctx.lineWidth=3; _ctx.lineCap='round';
  _ctx.beginPath();
  _ctx.moveTo(-s*0.04,-s*0.01); _ctx.lineTo(0,-s*0.14);
  _ctx.moveTo(0,-s*0.14); _ctx.lineTo(-s*0.07,-s*0.24);
  _ctx.moveTo(0,-s*0.14); _ctx.lineTo( s*0.07,-s*0.24);
  _ctx.stroke();

  // 毒エフェクト（スプレータイマー）
  if (e.sprayTimer > 40) {
    var pt = (e.sprayTimer-40)/30;
    _ctx.globalAlpha = al*pt*0.45; _ctx.shadowColor='#88FF44'; _ctx.shadowBlur=20;
    _ctx.fillStyle='#66FF22';
    _ctx.beginPath(); _ctx.arc(0,-s*0.1,s*0.9,0,Math.PI*2); _ctx.fill();
    _ctx.shadowBlur=0; _ctx.globalAlpha=al;
  }

  _drawBossHpBar(e, s, '★ 巨大ヘビ ★', '#88FF88', '#44CC44', '#228822', '#114411');
  _ctx.globalAlpha=1; _ctx.restore();
}

// ── ボスHPバー共通 ───────────────────────────────────────────────────────────
function _drawBossHpBar(e, s, label, labelCol, barTop, barBot, border) {
  var bw=s*2.4, bx=-bw/2, by=s*0.52;
  rrect(bx-2,by-2,bw+4,22,6,'rgba(0,0,0,0.85)',border,1.5);
  var ratio=e.hp/e.maxHp;
  if (ratio > 0) {
    var hpG=_ctx.createLinearGradient(bx,by,bx,by+18);
    hpG.addColorStop(0,barTop); hpG.addColorStop(1,barBot);
    rrectGrd(bx,by,bw*ratio,18,5,hpG,null);
    _ctx.fillStyle='rgba(255,255,255,0.26)';
    _ctx.beginPath(); _ctx.moveTo(bx+4,by+2); _ctx.lineTo(bx+bw*ratio-4,by+2); _ctx.lineTo(bx+bw*ratio-4,by+7); _ctx.lineTo(bx+4,by+7); _ctx.closePath(); _ctx.fill();
  }
  _ctx.fillStyle='#fff'; _ctx.font='bold 11px "Kosugi Maru",sans-serif'; _ctx.textAlign='center';
  _ctx.fillText(e.hp+'/'+e.maxHp, 0, by+14);
  _ctx.shadowColor=labelCol; _ctx.shadowBlur=12;
  _ctx.fillStyle=labelCol; _ctx.font='bold 13px "Kosugi Maru",sans-serif';
  _ctx.fillText(label, 0, -s*1.06);
  _ctx.shadowBlur=0;
  // フェーズインジケーター
  var ph = e.phase||1;
  if (ph > 1) {
    _ctx.fillStyle=ph>=3?'#FF4444':'#FF8800'; _ctx.font='bold 11px "Kosugi Maru",sans-serif';
    _ctx.fillText('PHASE '+ph, 0, -s*1.06+16);
  }
}

// ── Earth ────────────────────────────────────────────────────────────────────
function drawEarth(x, y, r) {
  _ctx.save(); _ctx.translate(x, y);
  var gG=_ctx.createRadialGradient(0,0,r*0.8,0,0,r*1.7);
  gG.addColorStop(0,'rgba(40,130,255,0.22)'); gG.addColorStop(1,'rgba(40,130,255,0)');
  _ctx.fillStyle=gG; _ctx.beginPath(); _ctx.arc(0,0,r*1.7,0,Math.PI*2); _ctx.fill();
  var oG=_ctx.createRadialGradient(-r*0.3,-r*0.3,0,0,0,r);
  oG.addColorStop(0,'#3498DB'); oG.addColorStop(1,'#1A5A8E');
  _ctx.fillStyle=oG; _ctx.beginPath(); _ctx.arc(0,0,r,0,Math.PI*2); _ctx.fill();
  _ctx.fillStyle='#27AE60';
  [[-.18,-.08,.28,.38],[.22,.12,.32,.22],[-.1,.3,.18,.14]].forEach(function(v){
    _ctx.beginPath(); _ctx.ellipse(r*v[0],r*v[1],r*v[2],r*v[3],0.6,0,Math.PI*2); _ctx.fill();
  });
  _ctx.strokeStyle='#1A4A8A'; _ctx.lineWidth=2;
  _ctx.beginPath(); _ctx.arc(0,0,r,0,Math.PI*2); _ctx.stroke();
  _ctx.strokeStyle='rgba(100,180,255,0.3)'; _ctx.lineWidth=r*0.13;
  _ctx.beginPath(); _ctx.arc(0,0,r*1.05,0,Math.PI*2); _ctx.stroke();
  _ctx.fillStyle='rgba(255,255,255,0.38)';
  _ctx.beginPath(); _ctx.ellipse(-r*0.22,-r*0.22,r*0.2,r*0.13,-0.5,0,Math.PI*2); _ctx.fill();
  _ctx.restore();
}

// ── Egg ──────────────────────────────────────────────────────────────────────
function drawEgg(x, y) {
  _ctx.save(); _ctx.translate(x, y);
  _ctx.shadowColor='#FFCC00'; _ctx.shadowBlur=14;
  _ctx.fillStyle='#FFFDE7'; _ctx.strokeStyle='#FF8C00'; _ctx.lineWidth=2.5;
  _ctx.beginPath(); _ctx.ellipse(0,0,10,14,0,0,Math.PI*2); _ctx.fill(); _ctx.stroke();
  _ctx.shadowBlur=0;
  _ctx.fillStyle='#FF8C00'; _ctx.font='12px sans-serif'; _ctx.textAlign='center'; _ctx.textBaseline='middle'; _ctx.fillText('✨',0,0);
  _ctx.restore();
}

// ── Coin ─────────────────────────────────────────────────────────────────────
function drawCoinIcon(x, y, r) {
  _ctx.save(); _ctx.translate(x, y);
  _ctx.shadowColor='#FFD700'; _ctx.shadowBlur=8;
  _ctx.fillStyle='#FFD700'; _ctx.beginPath(); _ctx.arc(0,0,r,0,Math.PI*2); _ctx.fill();
  _ctx.fillStyle='#CC8800'; _ctx.beginPath(); _ctx.arc(0,0,r*0.72,0,Math.PI*2); _ctx.fill();
  _ctx.fillStyle='#FFE840'; _ctx.font='bold '+Math.round(r*1.0)+'px sans-serif';
  _ctx.textAlign='center'; _ctx.textBaseline='middle'; _ctx.fillText('$',0,0);
  _ctx.shadowBlur=0; _ctx.restore();
}

// ── Enemy Bullet ─────────────────────────────────────────────────────────────
function drawEnemyBullet(eb) {
  _ctx.save(); _ctx.translate(eb.x, eb.y);
  var col = eb.color || '#FF6600';
  _ctx.shadowColor=col; _ctx.shadowBlur=18;
  var g=_ctx.createRadialGradient(0,0,0,0,0,eb.size);
  if (eb.color === '#88FF44') {
    g.addColorStop(0,'#CCFF88'); g.addColorStop(0.6,'#88FF44'); g.addColorStop(1,'#44AA00');
  } else {
    g.addColorStop(0,'#FFE800'); g.addColorStop(0.6,'#FF8800'); g.addColorStop(1,'#FF3300');
  }
  _ctx.fillStyle=g; _ctx.beginPath(); _ctx.arc(0,0,eb.size,0,Math.PI*2); _ctx.fill();
  _ctx.shadowBlur=0; _ctx.restore();
}

// ── Tower ─────────────────────────────────────────────────────────────────────
function drawTower(slot, showRange) {
  _ctx.save(); _ctx.translate(slot.x, slot.y);
  if (!slot.type) {
    _ctx.globalAlpha=0.22; _ctx.setLineDash([5,6]);
    _ctx.strokeStyle='#667'; _ctx.lineWidth=1.5;
    _ctx.beginPath(); _ctx.arc(0,0,18,0,Math.PI*2); _ctx.stroke();
    _ctx.setLineDash([]);
    _ctx.fillStyle='#667'; _ctx.font='14px sans-serif'; _ctx.textAlign='center'; _ctx.textBaseline='middle'; _ctx.fillText('+',0,1);
    _ctx.textBaseline='alphabetic'; _ctx.globalAlpha=1; _ctx.restore(); return;
  }
  var def=(typeof TOWER_DEFS!=='undefined')?TOWER_DEFS[slot.type]:null;
  if (!def) { _ctx.restore(); return; }
  if (showRange) {
    _ctx.globalAlpha=0.07; _ctx.fillStyle=def.col;
    _ctx.beginPath(); _ctx.arc(0,0,def.range,0,Math.PI*2); _ctx.fill();
    _ctx.globalAlpha=0.18; _ctx.strokeStyle=def.col; _ctx.lineWidth=1;
    _ctx.beginPath(); _ctx.arc(0,0,def.range,0,Math.PI*2); _ctx.stroke(); _ctx.globalAlpha=1;
  }
  _ctx.globalAlpha=0.38; _ctx.fillStyle='rgba(0,0,0,0.5)';
  _ctx.beginPath(); _ctx.ellipse(0,16,18,5,0,0,Math.PI*2); _ctx.fill(); _ctx.globalAlpha=1;
  _ctx.shadowColor=def.col; _ctx.shadowBlur=12;
  var bG=_ctx.createRadialGradient(-7,-7,1,0,0,20);
  bG.addColorStop(0,'rgba(255,255,255,0.35)'); bG.addColorStop(1,def.col);
  _ctx.fillStyle=bG; _ctx.strokeStyle='rgba(255,255,255,0.35)'; _ctx.lineWidth=1.5;
  _ctx.beginPath(); _ctx.moveTo(-11,12); _ctx.lineTo(11,12); _ctx.lineTo(15,-2); _ctx.lineTo(0,-18); _ctx.lineTo(-15,-2); _ctx.closePath(); _ctx.fill(); _ctx.stroke(); _ctx.shadowBlur=0;
  _ctx.fillStyle='rgba(0,0,0,0.68)'; _ctx.beginPath(); _ctx.rect(2,-24,6,14); _ctx.fill();
  _ctx.fillStyle='rgba(255,255,255,0.28)'; _ctx.beginPath(); _ctx.rect(3,-24,2,12); _ctx.fill();
  for (var li=0;li<slot.level-1;li++) {
    _ctx.fillStyle='#FFD700'; _ctx.shadowColor='#FFD700'; _ctx.shadowBlur=5;
    _ctx.beginPath(); _ctx.arc(-14+li*8,16,2.5,0,Math.PI*2); _ctx.fill(); _ctx.shadowBlur=0;
  }
  _ctx.font='13px sans-serif'; _ctx.textAlign='center'; _ctx.textBaseline='middle'; _ctx.fillText(def.icon,0,-5); _ctx.textBaseline='alphabetic';
  if (slot.maxHp>0) {
    var ratio=Math.max(0,slot.hp/slot.maxHp);
    var bw2=32,bh=4,bx2=-bw2/2,by2=22;
    _ctx.fillStyle='rgba(0,0,0,0.5)'; _ctx.fillRect(bx2,by2,bw2,bh);
    _ctx.fillStyle=ratio>0.5?'#4CFF6A':ratio>0.25?'#FFD700':'#FF4444'; _ctx.fillRect(bx2,by2,bw2*ratio,bh);
  }
  _ctx.restore();
}

// ── Particle ─────────────────────────────────────────────────────────────────
function drawParticle(p) {
  var a=p.life/p.maxLife;
  _ctx.save(); _ctx.globalAlpha=a;
  if (p.type==='crit'||p.type==='explosion'||p.type==='levelup'||p.type==='stageclear'||p.type==='boss_beam'||p.type==='achieve') {
    _ctx.shadowColor=p.color; _ctx.shadowBlur=12;
  }
  _ctx.fillStyle=p.color;
  _ctx.beginPath();
  if (p.type==='poof') _ctx.arc(p.x,p.y,p.size*(1.2-a*0.5),0,Math.PI*2);
  else if (p.type==='coin') {
    _ctx.arc(p.x,p.y,Math.max(1,p.size*a),0,Math.PI*2);
  }
  else _ctx.arc(p.x,p.y,Math.max(1,p.size*a),0,Math.PI*2);
  _ctx.fill();
  _ctx.shadowBlur=0; _ctx.globalAlpha=1; _ctx.restore();
}

// ── レーンインジケーター ────────────────────────────────────────────────────────
function drawLaneIndicators(chickLane, laneWarnings, frame) {
  var laneXs = typeof LANE_X !== 'undefined' ? LANE_X : [78, 195, 312];
  var groundY = _H - 128;

  // 薄いレーン縦線（常時）
  for (var li = 0; li < 3; li++) {
    _ctx.save();
    _ctx.globalAlpha = li === chickLane ? 0.18 : 0.07;
    _ctx.strokeStyle = li === chickLane ? '#AAFFEE' : '#667788';
    _ctx.lineWidth = li === chickLane ? 2 : 1;
    _ctx.setLineDash([12, 18]);
    _ctx.beginPath();
    _ctx.moveTo(laneXs[li], 90);
    _ctx.lineTo(laneXs[li], groundY);
    _ctx.stroke();
    _ctx.setLineDash([]);
    _ctx.restore();
  }

  // 警告カラム（赤フラッシュ）
  for (var wi = 0; wi < laneWarnings.length; wi++) {
    var warn = laneWarnings[wi];
    var ratio = warn.timer / warn.maxTimer;
    var flashAmt = (ratio > 0.5) ? 0.32 : (Math.abs(Math.sin(frame * 0.55)) * 0.45 + 0.1);
    for (var wli = 0; wli < warn.lanes.length; wli++) {
      var lx = laneXs[warn.lanes[wli]];
      _ctx.save();
      _ctx.globalAlpha = flashAmt;
      var wg = _ctx.createLinearGradient(lx - 52, 0, lx + 52, 0);
      wg.addColorStop(0, 'rgba(255,0,0,0)');
      wg.addColorStop(0.5, 'rgba(255,30,0,0.9)');
      wg.addColorStop(1, 'rgba(255,0,0,0)');
      _ctx.fillStyle = wg;
      _ctx.fillRect(lx - 52, 80, 104, groundY - 80);
      _ctx.restore();
      // ⚠ アイコン
      _ctx.save();
      _ctx.globalAlpha = 0.85;
      _ctx.font = 'bold 22px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillStyle = '#FF4400';
      _ctx.shadowColor = '#FF0000';
      _ctx.shadowBlur = 16;
      _ctx.fillText('⚠', lx, 145 + Math.sin(frame * 0.25) * 5);
      _ctx.shadowBlur = 0;
      _ctx.restore();
    }
  }
}

// ── レーンボタン（左右矢印） ──────────────────────────────────────────────────
function drawLaneBtns(chickLane, frame) {
  var btns = [{x:22, dir:'◀', active:chickLane>0}, {x:_W-22, dir:'▶', active:chickLane<2}];
  btns.forEach(function(b) {
    _ctx.save();
    _ctx.globalAlpha = b.active ? (0.65 + Math.sin(frame*0.07)*0.15) : 0.22;
    _ctx.fillStyle = b.active ? 'rgba(0,255,220,0.15)' : 'rgba(100,100,100,0.1)';
    _ctx.strokeStyle = b.active ? '#00FFCC' : '#445566';
    _ctx.lineWidth = 1.5;
    _ctx.beginPath();
    _ctx.roundRect ? _ctx.roundRect(b.x-18, _H-242, 36, 88, 10) : _ctx.rect(b.x-18, _H-242, 36, 88);
    _ctx.fill(); _ctx.stroke();
    _ctx.fillStyle = b.active ? '#AAFFEE' : '#445566';
    _ctx.font = 'bold 22px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.shadowColor = b.active ? '#00FFCC' : 'transparent';
    _ctx.shadowBlur = b.active ? 10 : 0;
    _ctx.fillText(b.dir, b.x, _H - 198);
    _ctx.shadowBlur = 0;
    _ctx.textBaseline = 'alphabetic';
    _ctx.restore();
  });
}

// ── ドロップ強化アイテム ──────────────────────────────────────────────────────
function drawDropItem(item, frame) {
  var bob  = Math.sin(item.bob) * 8;
  var life = item.life / item.maxLife;
  var fade = life < 0.25 ? (life / 0.25) : 1.0;
  var pulse = 0.7 + Math.sin(item.bob) * 0.3;

  _ctx.save();
  _ctx.translate(item.x, item.y + bob);
  _ctx.globalAlpha = fade;

  // 外周グロー
  _ctx.shadowColor = '#00FFCC';
  _ctx.shadowBlur  = 22 * pulse;
  var grd = _ctx.createRadialGradient(0, 0, 6, 0, 0, 26);
  grd.addColorStop(0, 'rgba(0,255,210,0.45)');
  grd.addColorStop(1, 'rgba(0,160,140,0)');
  _ctx.fillStyle = grd;
  _ctx.beginPath(); _ctx.arc(0, 0, 26, 0, Math.PI*2); _ctx.fill();

  // 本体
  _ctx.fillStyle   = 'rgba(0,30,28,0.85)';
  _ctx.strokeStyle = '#00FFCC';
  _ctx.lineWidth   = 2.5;
  _ctx.beginPath(); _ctx.arc(0, 0, 18, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();

  // アイコン
  _ctx.shadowBlur = 0;
  _ctx.font = '18px sans-serif';
  _ctx.textAlign = 'center';
  _ctx.textBaseline = 'middle';
  _ctx.fillText(item.upgrade ? item.upgrade.icon : '⬆', 0, 0);

  // 残り時間バー
  var bw = 38, bx = -bw/2, by = 22;
  _ctx.fillStyle = 'rgba(0,0,0,0.55)';
  _ctx.fillRect(bx, by, bw, 4);
  _ctx.fillStyle = life > 0.5 ? '#00FFCC' : life > 0.25 ? '#FFAA00' : '#FF4444';
  _ctx.fillRect(bx, by, bw * life, 4);

  _ctx.shadowBlur = 0;
  _ctx.textBaseline = 'alphabetic';
  _ctx.globalAlpha = 1;
  _ctx.restore();
}

// ── ボスアーキタイプ描画（bird / beast / reptile / mech / final） ─────────────

function _drawBossAuraPhase(e, frame, auraRGB) {
  var phase = e.phase || 1;
  var pa = (0.06 + Math.sin(frame * 0.05) * 0.04) * (1 + (phase-1) * 0.5);
  var aG = _ctx.createRadialGradient(0, 0, e.size*0.3, 0, 0, e.size*1.5);
  aG.addColorStop(0, 'rgba('+auraRGB+','+pa+')');
  aG.addColorStop(1, 'rgba('+auraRGB+',0)');
  _ctx.fillStyle = aG;
  _ctx.beginPath(); _ctx.arc(0, 0, e.size*1.6, 0, Math.PI*2); _ctx.fill();
  if (phase >= 2) {
    _ctx.globalAlpha *= (0.14 + Math.sin(frame*0.10)*0.08);
    _ctx.strokeStyle = phase===3 ? '#FF4400' : '#FF8800';
    _ctx.lineWidth = phase===3 ? 5 : 3;
    _ctx.beginPath(); _ctx.arc(0, 0, e.size*1.35, 0, Math.PI*2); _ctx.stroke();
    _ctx.globalAlpha = 1;
  }
}

// bird アーキタイプ（s1〜s4: カラス/フクロウ/ハゲタカ/ワシ）
function drawBossArchBird(e, frame, cfg) {
  _ctx.save(); _ctx.translate(e.x, e.y);
  var s  = e.size;
  var al = (e.hitFlash>0 && e.hitFlash%2===0) ? 0.25 : 1.0;
  _ctx.globalAlpha = al;
  _drawBossAuraPhase(e, frame, cfg.aura);

  // 羽
  _ctx.fillStyle = cfg.col;
  _ctx.strokeStyle = 'rgba(0,0,0,0.55)'; _ctx.lineWidth = 2;
  var wingFlap = Math.sin(frame*0.18)*0.32;
  _ctx.save(); _ctx.rotate(-0.3 + wingFlap);
  _ctx.beginPath(); _ctx.moveTo(-s*0.08,-s*0.05); _ctx.quadraticCurveTo(-s*0.95,-s*0.5,-s*0.70,s*0.25); _ctx.quadraticCurveTo(-s*0.35,s*0.1,-s*0.08,s*0.05); _ctx.closePath(); _ctx.fill(); _ctx.stroke();
  _ctx.restore();
  _ctx.save(); _ctx.rotate(0.3 - wingFlap);
  _ctx.beginPath(); _ctx.moveTo(s*0.08,-s*0.05); _ctx.quadraticCurveTo(s*0.95,-s*0.5,s*0.70,s*0.25); _ctx.quadraticCurveTo(s*0.35,s*0.1,s*0.08,s*0.05); _ctx.closePath(); _ctx.fill(); _ctx.stroke();
  _ctx.restore();

  // 胴体
  var bG = _ctx.createRadialGradient(-s*0.14,-s*0.08,s*0.04,0,0,s*0.5);
  bG.addColorStop(0,'rgba(255,255,255,0.18)'); bG.addColorStop(1, cfg.col);
  _ctx.fillStyle=bG; _ctx.strokeStyle='rgba(0,0,0,0.6)'; _ctx.lineWidth=1.5;
  _ctx.beginPath(); _ctx.ellipse(0,0,s*0.46,s*0.42,0,0,Math.PI*2); _ctx.fill(); _ctx.stroke();
  // 頭
  _ctx.fillStyle=cfg.col;
  _ctx.beginPath(); _ctx.arc(0,-s*0.32,s*0.32,0,Math.PI*2); _ctx.fill(); _ctx.stroke();
  // 目
  _ctx.shadowColor=cfg.eyeCol; _ctx.shadowBlur=s*0.28;
  _ctx.fillStyle=cfg.eyeCol;
  _ctx.beginPath(); _ctx.arc(-s*0.12,-s*0.33,s*0.09,0,Math.PI*2); _ctx.fill();
  _ctx.beginPath(); _ctx.arc( s*0.12,-s*0.33,s*0.09,0,Math.PI*2); _ctx.fill();
  _ctx.shadowBlur=0; _ctx.fillStyle='#000';
  _ctx.beginPath(); _ctx.arc(-s*0.12,-s*0.33,s*0.05,0,Math.PI*2); _ctx.fill();
  _ctx.beginPath(); _ctx.arc( s*0.12,-s*0.33,s*0.05,0,Math.PI*2); _ctx.fill();
  // くちばし
  _ctx.fillStyle='#FFCC00'; _ctx.strokeStyle='#AA8800'; _ctx.lineWidth=1.5;
  _ctx.beginPath(); _ctx.moveTo(-s*0.1,-s*0.18); _ctx.lineTo(s*0.1,-s*0.18); _ctx.lineTo(0,-s*0.05); _ctx.closePath(); _ctx.fill(); _ctx.stroke();

  _drawBossHpBar(e, s, cfg.name, cfg.eyeCol, cfg.col, cfg.col, '#442200');
  _ctx.globalAlpha=1; _ctx.restore();
}

// beast アーキタイプ（s5〜s8: タイガー/ウルフ/グリズリー/デモン）
function drawBossArchBeast(e, frame, cfg) {
  _ctx.save(); _ctx.translate(e.x, e.y);
  var s  = e.size;
  var al = (e.hitFlash>0 && e.hitFlash%2===0) ? 0.25 : 1.0;
  _ctx.globalAlpha = al;
  _drawBossAuraPhase(e, frame, cfg.aura);

  // 耳
  _ctx.fillStyle=cfg.col; _ctx.strokeStyle='rgba(0,0,0,0.5)'; _ctx.lineWidth=1.5;
  [[-s*0.26,-s*0.62],[s*0.26,-s*0.62]].forEach(function(p) {
    _ctx.beginPath(); _ctx.moveTo(p[0]-s*0.1,p[1]+s*0.12); _ctx.lineTo(p[0],p[1]-s*0.18); _ctx.lineTo(p[0]+s*0.1,p[1]+s*0.12); _ctx.closePath(); _ctx.fill(); _ctx.stroke();
  });
  // 胴体
  var bG2 = _ctx.createRadialGradient(-s*0.14,-s*0.08,s*0.04,0,0,s*0.55);
  bG2.addColorStop(0,'rgba(255,255,255,0.22)'); bG2.addColorStop(1,cfg.col);
  _ctx.fillStyle=bG2; _ctx.lineWidth=2;
  _ctx.beginPath(); _ctx.ellipse(0,s*0.05,s*0.52,s*0.45,0,0,Math.PI*2); _ctx.fill(); _ctx.stroke();
  // 頭
  _ctx.fillStyle=cfg.col;
  _ctx.beginPath(); _ctx.arc(0,-s*0.28,s*0.38,0,Math.PI*2); _ctx.fill(); _ctx.stroke();
  // 鼻
  _ctx.fillStyle='#222'; _ctx.beginPath(); _ctx.ellipse(0,-s*0.14,s*0.09,s*0.06,0,0,Math.PI*2); _ctx.fill();
  // 目
  _ctx.shadowColor=cfg.eyeCol; _ctx.shadowBlur=s*0.3;
  _ctx.fillStyle=cfg.eyeCol;
  _ctx.beginPath(); _ctx.arc(-s*0.14,-s*0.31,s*0.1,0,Math.PI*2); _ctx.fill();
  _ctx.beginPath(); _ctx.arc( s*0.14,-s*0.31,s*0.1,0,Math.PI*2); _ctx.fill();
  _ctx.shadowBlur=0; _ctx.fillStyle='#111';
  _ctx.beginPath(); _ctx.arc(-s*0.14,-s*0.31,s*0.055,0,Math.PI*2); _ctx.fill();
  _ctx.beginPath(); _ctx.arc( s*0.14,-s*0.31,s*0.055,0,Math.PI*2); _ctx.fill();
  // ひっかき傷
  _ctx.strokeStyle='rgba(255,255,255,0.22)'; _ctx.lineWidth=1.5;
  [[-s*0.22,s*0.05],[-s*0.1,s*0.2],[s*0.1,s*0.05],[s*0.22,s*0.2]].forEach(function(p,i) {
    if (i%2===0) { _ctx.beginPath(); _ctx.moveTo(p[0],p[1]-s*0.12); _ctx.lineTo(p[0]+s*0.04,p[1]+s*0.12); _ctx.stroke(); }
  });

  _drawBossHpBar(e, s, cfg.name, cfg.eyeCol, cfg.col, cfg.col, '#333');
  _ctx.globalAlpha=1; _ctx.restore();
}

// reptile アーキタイプ（s9〜s12: ワニ/ヘビ王/カメレオン/ドラゴン）
function drawBossArchReptile(e, frame, cfg) {
  _ctx.save(); _ctx.translate(e.x, e.y);
  var s  = e.size;
  var al = (e.hitFlash>0 && e.hitFlash%2===0) ? 0.25 : 1.0;
  _ctx.globalAlpha = al;
  _drawBossAuraPhase(e, frame, cfg.aura);

  // 尾（後ろに）
  _ctx.strokeStyle=cfg.col; _ctx.lineWidth=s*0.45; _ctx.lineCap='round';
  _ctx.beginPath();
  _ctx.moveTo(0,s*0.3);
  _ctx.quadraticCurveTo(s*0.7,s*0.7,s*0.5,s*1.35);
  _ctx.quadraticCurveTo(-s*0.2,s*1.7,-s*0.5,s*1.15);
  _ctx.stroke();
  _ctx.strokeStyle='rgba(255,255,255,0.15)'; _ctx.lineWidth=s*0.18;
  _ctx.stroke();

  // 胴体
  var bG3 = _ctx.createRadialGradient(-s*0.12,-s*0.1,s*0.05,0,0,s*0.58);
  bG3.addColorStop(0,'rgba(255,255,255,0.18)'); bG3.addColorStop(1,cfg.col);
  _ctx.fillStyle=bG3; _ctx.strokeStyle='rgba(0,0,0,0.55)'; _ctx.lineWidth=2;
  _ctx.beginPath(); _ctx.ellipse(0,s*0.08,s*0.52,s*0.44,0,0,Math.PI*2); _ctx.fill(); _ctx.stroke();
  // 鱗
  _ctx.strokeStyle='rgba(255,255,255,0.15)'; _ctx.lineWidth=1.5;
  for (var ri=0;ri<3;ri++) { _ctx.beginPath(); _ctx.arc(0,s*0.08,s*(0.2+ri*0.1),0,Math.PI*2); _ctx.stroke(); }
  // 頭（扁平）
  var hG3 = _ctx.createRadialGradient(-s*0.08,-s*0.32,s*0.02,0,-s*0.28,s*0.42);
  hG3.addColorStop(0,'rgba(255,255,255,0.2)'); hG3.addColorStop(1,cfg.col);
  _ctx.fillStyle=hG3; _ctx.lineWidth=2;
  _ctx.beginPath(); _ctx.ellipse(0,-s*0.28,s*0.44,s*0.30,0,0,Math.PI*2); _ctx.fill(); _ctx.stroke();
  // 縦長の瞳
  _ctx.fillStyle=cfg.eyeCol; _ctx.shadowColor=cfg.eyeCol; _ctx.shadowBlur=s*0.28;
  _ctx.beginPath(); _ctx.ellipse(-s*0.16,-s*0.3,s*0.1,s*0.13,0,0,Math.PI*2); _ctx.fill();
  _ctx.beginPath(); _ctx.ellipse( s*0.16,-s*0.3,s*0.1,s*0.13,0,0,Math.PI*2); _ctx.fill();
  _ctx.shadowBlur=0; _ctx.fillStyle='#000';
  _ctx.beginPath(); _ctx.ellipse(-s*0.16,-s*0.3,s*0.035,s*0.11,0,0,Math.PI*2); _ctx.fill();
  _ctx.beginPath(); _ctx.ellipse( s*0.16,-s*0.3,s*0.035,s*0.11,0,0,Math.PI*2); _ctx.fill();
  // 舌
  _ctx.strokeStyle='#FF3333'; _ctx.lineWidth=2.5; _ctx.lineCap='round';
  _ctx.beginPath(); _ctx.moveTo(0,-s*0.02); _ctx.lineTo(0,-s*0.14);
  _ctx.moveTo(0,-s*0.14); _ctx.lineTo(-s*0.06,-s*0.23);
  _ctx.moveTo(0,-s*0.14); _ctx.lineTo( s*0.06,-s*0.23);
  _ctx.stroke();

  _drawBossHpBar(e, s, cfg.name, cfg.eyeCol, cfg.col, cfg.col, '#1A3A10');
  _ctx.globalAlpha=1; _ctx.restore();
}

// mech アーキタイプ（s13〜s16: メカ戦士/サイボーグ/ロボット/戦闘機）
function drawBossArchMech(e, frame, cfg) {
  _ctx.save(); _ctx.translate(e.x, e.y);
  var s  = e.size;
  var al = (e.hitFlash>0 && e.hitFlash%2===0) ? 0.25 : 1.0;
  _ctx.globalAlpha = al;
  _drawBossAuraPhase(e, frame, cfg.aura);

  // メインボディ（四角形）
  _ctx.shadowColor=cfg.eyeCol; _ctx.shadowBlur=12;
  var mG = _ctx.createLinearGradient(-s*0.5,-s*0.5,s*0.5,s*0.5);
  mG.addColorStop(0,'rgba(255,255,255,0.3)'); mG.addColorStop(1,cfg.col);
  _ctx.fillStyle=mG; _ctx.strokeStyle=cfg.eyeCol; _ctx.lineWidth=2.5;
  rrect(-s*0.48,-s*0.42,s*0.96,s*0.88,s*0.08,mG,cfg.eyeCol,2.5);
  _ctx.shadowBlur=0;
  // 装甲リベット
  [[-.35,-.32],[.35,-.32],[-.35,.32],[.35,.32]].forEach(function(p) {
    _ctx.fillStyle='rgba(255,255,255,0.4)';
    _ctx.beginPath(); _ctx.arc(s*p[0],s*p[1],s*0.055,0,Math.PI*2); _ctx.fill();
  });
  // スキャンアイ
  var scanX = Math.sin(frame * 0.09) * s * 0.15;
  _ctx.fillStyle=cfg.eyeCol; _ctx.shadowColor=cfg.eyeCol; _ctx.shadowBlur=14;
  _ctx.fillRect(-s*0.35,-s*0.15+scanX-s*0.08,s*0.70,s*0.16);
  _ctx.shadowBlur=0;
  // バイザーライン
  _ctx.strokeStyle='rgba(255,255,255,0.3)'; _ctx.lineWidth=1;
  _ctx.beginPath(); _ctx.moveTo(-s*0.35,-s*0.05+scanX); _ctx.lineTo(s*0.35,-s*0.05+scanX); _ctx.stroke();
  // 排気口
  _ctx.fillStyle='rgba(0,0,0,0.55)';
  [-s*0.25,0,s*0.25].forEach(function(bx) {
    _ctx.fillRect(bx-s*0.04,s*0.38,s*0.08,s*0.14);
  });
  // 点滅ライト
  var blink = Math.floor(frame/8)%2===0;
  _ctx.fillStyle=blink?cfg.eyeCol:'rgba(255,255,255,0.15)';
  _ctx.shadowColor=cfg.eyeCol; _ctx.shadowBlur=blink?10:0;
  _ctx.beginPath(); _ctx.arc(-s*0.38,s*0.18,s*0.055,0,Math.PI*2); _ctx.fill();
  _ctx.shadowBlur=0;

  _drawBossHpBar(e, s, cfg.name, cfg.eyeCol, cfg.col, cfg.col, '#111133');
  _ctx.globalAlpha=1; _ctx.restore();
}

// final アーキタイプ（s17〜s20: 最終形態、宇宙存在）
function drawBossArchFinal(e, frame, cfg) {
  _ctx.save(); _ctx.translate(e.x, e.y);
  var s  = e.size;
  var al = (e.hitFlash>0 && e.hitFlash%2===0) ? 0.25 : 1.0;
  _ctx.globalAlpha = al;

  // 超強力オーラ（脈動）
  var phase = e.phase || 1;
  var pulseR = s * (1.4 + Math.sin(frame*0.07)*0.2) * (1+(phase-1)*0.25);
  var aG = _ctx.createRadialGradient(0,0,s*0.2,0,0,pulseR);
  aG.addColorStop(0,'rgba('+cfg.aura+','+(0.25+Math.sin(frame*0.05)*0.1)+')');
  aG.addColorStop(0.7,'rgba('+cfg.aura+',0.05)');
  aG.addColorStop(1,'rgba('+cfg.aura+',0)');
  _ctx.fillStyle=aG; _ctx.beginPath(); _ctx.arc(0,0,pulseR,0,Math.PI*2); _ctx.fill();
  // 回転リング
  for (var ri2=0;ri2<3;ri2++) {
    _ctx.save();
    _ctx.rotate(frame*(0.018+ri2*0.009)*(ri2%2===0?1:-1));
    _ctx.globalAlpha = al*(0.30+ri2*0.08);
    _ctx.strokeStyle=cfg.eyeCol; _ctx.lineWidth=ri2===2?3:2;
    _ctx.setLineDash(ri2===1?[s*0.18,s*0.12]:[]); _ctx.beginPath(); _ctx.arc(0,0,s*(0.72+ri2*0.28),0,Math.PI*2); _ctx.stroke();
    _ctx.setLineDash([]);
    _ctx.restore();
  }

  // コア（複合形状）
  _ctx.shadowColor=cfg.eyeCol; _ctx.shadowBlur=22;
  var cG = _ctx.createRadialGradient(-s*0.18,-s*0.18,s*0.05,0,0,s*0.6);
  cG.addColorStop(0,'rgba(255,255,255,0.65)'); cG.addColorStop(0.4,'rgba(255,255,255,0.22)'); cG.addColorStop(1,cfg.col);
  _ctx.fillStyle=cG; _ctx.strokeStyle=cfg.eyeCol; _ctx.lineWidth=3;
  // 六角形コア
  _ctx.beginPath();
  for (var hi2=0;hi2<6;hi2++) {
    var ha = (hi2/6)*Math.PI*2 - Math.PI/2 + Math.sin(frame*0.04)*0.12;
    var hx = Math.cos(ha)*s*0.52, hy = Math.sin(ha)*s*0.52;
    hi2===0 ? _ctx.moveTo(hx,hy) : _ctx.lineTo(hx,hy);
  }
  _ctx.closePath(); _ctx.fill(); _ctx.stroke();
  _ctx.shadowBlur=0;

  // 眼（中央に単眼）
  _ctx.shadowColor=cfg.eyeCol; _ctx.shadowBlur=18;
  _ctx.fillStyle=cfg.eyeCol;
  _ctx.beginPath(); _ctx.arc(0,0,s*0.22,0,Math.PI*2); _ctx.fill();
  _ctx.shadowBlur=0; _ctx.fillStyle='#000';
  _ctx.beginPath(); _ctx.arc(Math.sin(frame*0.04)*s*0.06,Math.cos(frame*0.03)*s*0.06,s*0.10,0,Math.PI*2); _ctx.fill();
  _ctx.fillStyle='rgba(255,255,255,0.8)';
  _ctx.beginPath(); _ctx.arc(s*0.06,s*-0.06,s*0.04,0,Math.PI*2); _ctx.fill();

  // フェーズ2以上：追加の触手
  if (phase >= 2) {
    for (var ti=0;ti<4;ti++) {
      var ta = (ti/4)*Math.PI*2 + frame*0.04;
      var tx2=Math.cos(ta)*s*0.55, ty2=Math.sin(ta)*s*0.55;
      _ctx.strokeStyle=cfg.eyeCol; _ctx.lineWidth=3; _ctx.globalAlpha=al*0.55;
      _ctx.beginPath(); _ctx.moveTo(tx2,ty2); _ctx.quadraticCurveTo(tx2*1.4+Math.sin(frame*0.08+ti)*s*0.25,ty2*1.4,Math.cos(ta+0.6)*s*0.95,Math.sin(ta+0.6)*s*0.95); _ctx.stroke();
      _ctx.globalAlpha=al;
    }
  }

  _drawBossHpBar(e, s, cfg.name, cfg.eyeCol, cfg.col, cfg.col, '#110022');
  _ctx.globalAlpha=1; _ctx.restore();
}
