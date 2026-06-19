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

// ── Background (stage-aware) ─────────────────────────────────────────────────
var _SBG = [
  { t:'#04091E', m:'#08142E', b:'#04080E' },  // 1 midnight blue
  { t:'#060820', m:'#0A1230', b:'#040610' },  // 2
  { t:'#0C0822', m:'#140C32', b:'#08061A' },  // 3 purple
  { t:'#160622', m:'#1E082C', b:'#0C0414' },  // 4
  { t:'#220408', m:'#300606', b:'#180204' },  // 5 red
  { t:'#1C0604', m:'#280804', b:'#140402' },  // 6 orange
  { t:'#100A1E', m:'#160C28', b:'#080612' },  // 7 dark indigo
  { t:'#1C0408', m:'#240406', b:'#0E0204' },  // 8 crimson
  { t:'#160010', m:'#1E0018', b:'#0C0008' },  // 9 void purple
  { t:'#09000C', m:'#110012', b:'#050006' },  // 10 deep void
];

function drawBg(frame, stage) {
  var si = Math.max(0, Math.min(9, (stage || 1) - 1));
  var bg = _SBG[si];
  var g  = _ctx.createLinearGradient(0, 0, 0, _H);
  g.addColorStop(0,   bg.t);
  g.addColorStop(0.6, bg.m);
  g.addColorStop(1,   bg.b);
  _ctx.fillStyle = g; _ctx.fillRect(0, 0, _W, _H);

  // Stars
  var cnt = 58 + si * 4;
  for (var i = 0; i < cnt; i++) {
    var sx = (i * 141 + 47) % _W;
    var sy = (i * 233 + 31) % (_H * 0.73);
    _ctx.globalAlpha = (Math.sin(frame * 0.04 + i) * 0.22 + 0.62) * 0.82;
    _ctx.fillStyle = si >= 7 ? '#FFCCCC' : si >= 4 ? '#FFE8CC' : '#FFFFFF';
    _ctx.beginPath(); _ctx.arc(sx, sy, 0.55 + (i % 4) * 0.36, 0, Math.PI * 2); _ctx.fill();
  }

  // Nebula at higher stages
  if (si >= 3) {
    var na = (si - 3) / 7 * 0.13;
    var nc = si >= 7 ? '200,30,30' : si >= 4 ? '110,30,175' : '55,25,135';
    var ng = _ctx.createRadialGradient(_W * 0.65, _H * 0.25, 0, _W * 0.65, _H * 0.25, _W * 0.72);
    ng.addColorStop(0, 'rgba(' + nc + ',' + na + ')');
    ng.addColorStop(1, 'rgba(' + nc + ',0)');
    _ctx.globalAlpha = 1; _ctx.fillStyle = ng; _ctx.fillRect(0, 0, _W, _H);
  }
  _ctx.globalAlpha = 1;
}

function drawGround(stage) {
  var t   = Math.max(0, Math.min(1, ((stage || 1) - 1) / 9));
  var r1  = Math.round(40 + t * 52),  g1 = Math.round(138 - t * 112), b1 = Math.round(70 - t * 62);
  var r2  = Math.round(30 + t * 42),  g2 = Math.round(106 - t * 92),  b2 = Math.round(54 - t * 50);
  var grd = _ctx.createLinearGradient(0, _H - 128, 0, _H);
  grd.addColorStop(0, 'rgb(' + r1 + ',' + g1 + ',' + b1 + ')');
  grd.addColorStop(1, 'rgb(' + r2 + ',' + g2 + ',' + b2 + ')');
  _ctx.fillStyle = grd;
  _ctx.beginPath();
  _ctx.moveTo(0, _H - 108);
  _ctx.quadraticCurveTo(_W * 0.25, _H - 125, _W * 0.5, _H - 112);
  _ctx.quadraticCurveTo(_W * 0.75, _H - 100, _W,       _H - 118);
  _ctx.lineTo(_W, _H); _ctx.lineTo(0, _H); _ctx.closePath(); _ctx.fill();
  // Edge highlight
  _ctx.strokeStyle = 'rgba(255,255,255,0.12)'; _ctx.lineWidth = 2;
  _ctx.beginPath();
  _ctx.moveTo(0, _H - 108);
  _ctx.quadraticCurveTo(_W * 0.25, _H - 125, _W * 0.5, _H - 112);
  _ctx.quadraticCurveTo(_W * 0.75, _H - 100, _W,       _H - 118);
  _ctx.stroke();
}

// ── Chick ────────────────────────────────────────────────────────────────────
function drawChick(x, y, sz, evolved, acc) {
  sz      = sz      === undefined ? 40    : sz;
  evolved = evolved === undefined ? false : evolved;
  acc     = acc     === undefined ? null  : acc;
  _ctx.save(); _ctx.translate(x, y);

  // Drop shadow
  _ctx.shadowColor    = 'rgba(0,0,0,0.5)';
  _ctx.shadowBlur     = sz * 0.45;
  _ctx.shadowOffsetX  = sz * 0.05;
  _ctx.shadowOffsetY  = sz * 0.09;

  if (evolved) {
    _ctx.fillStyle = '#E74C3C'; _ctx.strokeStyle = '#922B21'; _ctx.lineWidth = 2;
    _ctx.beginPath();
    _ctx.moveTo(-7, -sz * 0.72);
    _ctx.quadraticCurveTo(-13, -sz * 1.0, -4, -sz * 0.88);
    _ctx.quadraticCurveTo(0, -sz * 1.12, 4, -sz * 0.88);
    _ctx.quadraticCurveTo(13, -sz * 1.0, 7, -sz * 0.72);
    _ctx.closePath(); _ctx.fill(); _ctx.stroke();
  }

  // Body gradient
  var bg = _ctx.createRadialGradient(-sz * 0.12, sz * 0.0, sz * 0.04, 0, sz * 0.1, sz * 0.56);
  bg.addColorStop(0,    '#FFF9C4');
  bg.addColorStop(0.45, '#FFE135');
  bg.addColorStop(1,    '#CC8800');
  _ctx.fillStyle = bg; _ctx.strokeStyle = '#B8860B'; _ctx.lineWidth = 2;
  _ctx.beginPath(); _ctx.ellipse(0, sz * 0.1, sz * 0.52, sz * 0.48, 0, 0, Math.PI * 2);
  _ctx.fill(); _ctx.stroke();

  // Head gradient
  var hg = _ctx.createRadialGradient(-sz * 0.08, -sz * 0.38, sz * 0.02, 0, -sz * 0.3, sz * 0.38);
  hg.addColorStop(0,   '#FFFDE7');
  hg.addColorStop(0.4, '#FFE135');
  hg.addColorStop(1,   '#C08000');
  _ctx.fillStyle = hg;
  _ctx.beginPath(); _ctx.arc(0, -sz * 0.3, sz * 0.36, 0, Math.PI * 2);
  _ctx.fill(); _ctx.stroke();

  _ctx.shadowBlur = 0; _ctx.shadowOffsetX = 0; _ctx.shadowOffsetY = 0;

  // Wings
  _ctx.fillStyle = '#F0BF00'; _ctx.strokeStyle = '#B8860B'; _ctx.lineWidth = 1.5;
  _ctx.beginPath(); _ctx.ellipse(-sz * 0.52, sz * 0.08, sz * 0.18, sz * 0.26, -0.4, 0, Math.PI * 2);
  _ctx.fill(); _ctx.stroke();
  _ctx.beginPath(); _ctx.ellipse( sz * 0.52, sz * 0.08, sz * 0.18, sz * 0.26,  0.4, 0, Math.PI * 2);
  _ctx.fill(); _ctx.stroke();

  if (evolved) {
    _ctx.fillStyle = '#E74C3C'; _ctx.strokeStyle = '#922B21'; _ctx.lineWidth = 1.5;
    _ctx.beginPath(); _ctx.arc(sz * 0.12, -sz * 0.1, sz * 0.1, 0, Math.PI * 2);
    _ctx.fill(); _ctx.stroke();
  }

  // Eyes
  _ctx.fillStyle = '#222';
  _ctx.beginPath(); _ctx.arc(-sz * 0.12, -sz * 0.33, sz * 0.078, 0, Math.PI * 2); _ctx.fill();
  _ctx.beginPath(); _ctx.arc( sz * 0.12, -sz * 0.33, sz * 0.078, 0, Math.PI * 2); _ctx.fill();
  _ctx.fillStyle = '#fff';
  _ctx.beginPath(); _ctx.arc(-sz * 0.09, -sz * 0.355, sz * 0.034, 0, Math.PI * 2); _ctx.fill();
  _ctx.beginPath(); _ctx.arc( sz * 0.15, -sz * 0.355, sz * 0.034, 0, Math.PI * 2); _ctx.fill();
  // Bright highlight
  _ctx.fillStyle = 'rgba(255,255,255,0.9)';
  _ctx.beginPath(); _ctx.arc(-sz * 0.07, -sz * 0.375, sz * 0.019, 0, Math.PI * 2); _ctx.fill();
  _ctx.beginPath(); _ctx.arc( sz * 0.17, -sz * 0.375, sz * 0.019, 0, Math.PI * 2); _ctx.fill();

  // Beak
  _ctx.fillStyle = '#FF8C00'; _ctx.strokeStyle = '#CC5500'; _ctx.lineWidth = 1.5;
  _ctx.beginPath();
  _ctx.moveTo(-sz * 0.1, -sz * 0.22); _ctx.lineTo(sz * 0.1, -sz * 0.22);
  _ctx.lineTo(0, -sz * 0.1); _ctx.closePath(); _ctx.fill(); _ctx.stroke();

  // Feet
  _ctx.strokeStyle = '#FF8C00'; _ctx.lineWidth = 2.5; _ctx.lineCap = 'round';
  [[-sz * 0.18, sz * 0.55], [sz * 0.18, sz * 0.55]].forEach(function(ft) {
    _ctx.beginPath(); _ctx.moveTo(ft[0], ft[1]); _ctx.lineTo(ft[0] - sz * 0.12, ft[1] + sz * 0.12); _ctx.stroke();
    _ctx.beginPath(); _ctx.moveTo(ft[0], ft[1]); _ctx.lineTo(ft[0] + sz * 0.12, ft[1] + sz * 0.12); _ctx.stroke();
    _ctx.beginPath(); _ctx.moveTo(ft[0], ft[1]); _ctx.lineTo(ft[0],              ft[1] + sz * 0.16); _ctx.stroke();
  });

  if (acc === 'glasses') {
    _ctx.strokeStyle = '#555'; _ctx.lineWidth = 2;
    _ctx.beginPath(); _ctx.arc(-sz * 0.12, -sz * 0.33, sz * 0.14, 0, Math.PI * 2); _ctx.stroke();
    _ctx.beginPath(); _ctx.arc( sz * 0.12, -sz * 0.33, sz * 0.14, 0, Math.PI * 2); _ctx.stroke();
    _ctx.beginPath(); _ctx.moveTo(-sz * 0.02, -sz * 0.33); _ctx.lineTo(sz * 0.02, -sz * 0.33); _ctx.stroke();
  } else if (acc === 'nurse') {
    rrect(-sz * 0.3, -sz * 0.72, sz * 0.6, sz * 0.28, 3, '#fff', '#ddd', 1.5);
    _ctx.fillStyle = '#FF6B6B';
    _ctx.fillRect(-sz * 0.05, -sz * 0.7,  sz * 0.1,  sz * 0.22);
    _ctx.fillRect(-sz * 0.15, -sz * 0.56, sz * 0.3,  sz * 0.08);
  } else if (acc === 'helmet') {
    _ctx.fillStyle = '#4ECDC4'; _ctx.strokeStyle = '#2E9E96'; _ctx.lineWidth = 2;
    _ctx.beginPath(); _ctx.arc(0, -sz * 0.3, sz * 0.4, Math.PI, 0); _ctx.fill(); _ctx.stroke();
    _ctx.fillStyle = '#2E9E96'; _ctx.fillRect(-sz * 0.4, -sz * 0.36, sz * 0.8, sz * 0.09);
  }
  _ctx.restore();
}

// ── Crow ─────────────────────────────────────────────────────────────────────
var CROW_COLORS = {
  normal: { wing:'#141414', body:'#282828', hi:'#424242', eye:'#FF1A1A', glow:'rgba(255,20,20,0.55)'  },
  fast:   { wing:'#001166', body:'#163388', hi:'#2850BB', eye:'#00EEFF', glow:'rgba(0,220,255,0.55)'  },
  tank:   { wing:'#3A0000', body:'#7A0000', hi:'#BB1818', eye:'#FF5500', glow:'rgba(255,80,0,0.55)'   },
};

function drawCrow(e) {
  _ctx.save();
  _ctx.translate(e.x, e.y + Math.sin(e.wobble) * 4);
  var s = e.size;
  var c = CROW_COLORS[e.type] || CROW_COLORS.normal;
  var al = (e.hitFlash > 0 && e.hitFlash % 2 === 0) ? 0.25 : 1.0;
  _ctx.globalAlpha = al;

  // Ground shadow
  _ctx.globalAlpha = al * 0.38;
  _ctx.fillStyle = 'rgba(0,0,0,0.55)';
  _ctx.beginPath(); _ctx.ellipse(0, s * 0.9, s * 0.46, s * 0.1, 0, 0, Math.PI * 2); _ctx.fill();
  _ctx.globalAlpha = al;

  // Wings
  _ctx.fillStyle = c.wing; _ctx.strokeStyle = 'rgba(0,0,0,0.6)'; _ctx.lineWidth = 1.5;
  _ctx.beginPath();
  _ctx.moveTo(-s * 0.1, -s * 0.05);
  _ctx.quadraticCurveTo(-s * 0.85, -s * 0.45, -s * 0.65, s * 0.25);
  _ctx.quadraticCurveTo(-s * 0.35,  s * 0.1,  -s * 0.1,  s * 0.05);
  _ctx.closePath(); _ctx.fill(); _ctx.stroke();
  _ctx.beginPath();
  _ctx.moveTo(s * 0.1, -s * 0.05);
  _ctx.quadraticCurveTo(s * 0.85, -s * 0.45, s * 0.65, s * 0.25);
  _ctx.quadraticCurveTo(s * 0.35,  s * 0.1,  s * 0.1,  s * 0.05);
  _ctx.closePath(); _ctx.fill(); _ctx.stroke();

  // Body gradient
  var bG = _ctx.createRadialGradient(-s * 0.14, -s * 0.08, s * 0.04, 0, 0, s * 0.5);
  bG.addColorStop(0, c.hi); bG.addColorStop(1, c.body);
  _ctx.fillStyle = bG; _ctx.strokeStyle = 'rgba(0,0,0,0.7)'; _ctx.lineWidth = 1.5;
  _ctx.beginPath(); _ctx.ellipse(0, 0, s * 0.45, s * 0.4, 0, 0, Math.PI * 2); _ctx.fill(); _ctx.stroke();

  // Head gradient
  var hG = _ctx.createRadialGradient(s * 0.14, -s * 0.35, s * 0.04, s * 0.28, -s * 0.28, s * 0.3);
  hG.addColorStop(0, c.hi); hG.addColorStop(1, c.body);
  _ctx.fillStyle = hG;
  _ctx.beginPath(); _ctx.arc(s * 0.28, -s * 0.28, s * 0.28, 0, Math.PI * 2); _ctx.fill(); _ctx.stroke();

  // Beak
  _ctx.fillStyle = '#555';
  _ctx.beginPath(); _ctx.moveTo(s*0.5,-s*0.22); _ctx.lineTo(s*0.82,-s*0.16); _ctx.lineTo(s*0.5,-s*0.08); _ctx.closePath(); _ctx.fill();

  // Eye with glow
  _ctx.shadowColor = c.glow; _ctx.shadowBlur = s * 0.45;
  _ctx.fillStyle = c.eye;
  _ctx.beginPath(); _ctx.arc(s * 0.33, -s * 0.3, s * 0.09, 0, Math.PI * 2); _ctx.fill();
  _ctx.shadowBlur = 0;
  _ctx.fillStyle = '#000';
  _ctx.beginPath(); _ctx.arc(s * 0.35, -s * 0.3, s * 0.05, 0, Math.PI * 2); _ctx.fill();
  _ctx.fillStyle = 'rgba(255,255,255,0.85)';
  _ctx.beginPath(); _ctx.arc(s * 0.37, -s * 0.32, s * 0.025, 0, Math.PI * 2); _ctx.fill();

  // Tank HP bar
  if (e.type === 'tank' || e.maxHp > 12) {
    var bw = s * 1.6, bx = -bw / 2, by = s * 0.65;
    rrect(bx - 1, by - 1, bw + 2, 12, 4, 'rgba(0,0,0,0.75)', null);
    var ratio = e.hp / e.maxHp;
    var hc    = ratio > 0.5 ? '#2ECC71' : ratio > 0.25 ? '#F39C12' : '#E74C3C';
    rrect(bx, by, bw * ratio, 10, 3, hc, null);
    _ctx.fillStyle = 'rgba(255,255,255,0.22)';
    _ctx.beginPath();
    _ctx.moveTo(bx + 3, by + 1.5); _ctx.lineTo(bx + bw * ratio - 3, by + 1.5);
    _ctx.lineTo(bx + bw * ratio - 3, by + 4.5); _ctx.lineTo(bx + 3, by + 4.5);
    _ctx.closePath(); _ctx.fill();
  }
  _ctx.globalAlpha = 1; _ctx.restore();
}

// ── Boss ─────────────────────────────────────────────────────────────────────
function drawBoss(e, frame) {
  _ctx.save(); _ctx.translate(e.x, e.y);
  var s  = e.size;
  var al = (e.hitFlash > 0 && e.hitFlash % 2 === 0) ? 0.25 : 1.0;
  _ctx.globalAlpha = al;

  // Beam warning
  if (e.bossTimer > 95) {
    var wa = (e.bossTimer - 95) / 25;
    _ctx.globalAlpha = al * wa * 0.55;
    var bG2 = _ctx.createLinearGradient(0, s * 0.4, 0, _H - e.y);
    bG2.addColorStop(0,    'rgba(200,80,255,0.95)');
    bG2.addColorStop(0.25, 'rgba(155,89,182,0.65)');
    bG2.addColorStop(1,    'rgba(155,89,182,0)');
    _ctx.fillStyle = bG2;
    _ctx.beginPath();
    _ctx.moveTo(-32, s*0.4); _ctx.lineTo(32, s*0.4);
    _ctx.lineTo(100, _H-e.y); _ctx.lineTo(-100, _H-e.y);
    _ctx.closePath(); _ctx.fill();
    _ctx.globalAlpha = al;
  }

  // Aura pulse
  var pa  = (0.07 + Math.sin(frame * 0.05) * 0.03) * al;
  var aG  = _ctx.createRadialGradient(0, 0, s * 0.3, 0, 0, s * 1.4);
  aG.addColorStop(0, 'rgba(175,75,255,' + pa + ')');
  aG.addColorStop(1, 'rgba(175,75,255,0)');
  _ctx.fillStyle = aG; _ctx.beginPath(); _ctx.arc(0, 0, s * 1.4, 0, Math.PI * 2); _ctx.fill();

  // UFO dish
  _ctx.shadowColor = '#AA55FF'; _ctx.shadowBlur = 20;
  var dG = _ctx.createRadialGradient(0, s * 0.0, s * 0.1, 0, s * 0.1, s * 1.0);
  dG.addColorStop(0, '#8868C8'); dG.addColorStop(0.5, '#504070'); dG.addColorStop(1, '#281840');
  _ctx.fillStyle = dG; _ctx.strokeStyle = '#CC88FF'; _ctx.lineWidth = 2.5;
  _ctx.beginPath(); _ctx.ellipse(0, s*0.1, s*0.95, s*0.24, 0, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
  _ctx.shadowBlur = 0;
  _ctx.fillStyle = 'rgba(200,160,255,0.18)';
  _ctx.beginPath(); _ctx.ellipse(0, s*0.02, s*0.65, s*0.11, 0, 0, Math.PI*2); _ctx.fill();

  // Dome
  _ctx.shadowColor = '#DD88FF'; _ctx.shadowBlur = 18;
  var dmG = _ctx.createRadialGradient(-s*0.18, -s*0.28, s*0.04, 0, -s*0.1, s*0.55);
  dmG.addColorStop(0,   'rgba(230,170,255,0.82)');
  dmG.addColorStop(0.6, 'rgba(160,80,240,0.50)');
  dmG.addColorStop(1,   'rgba(100,40,180,0.22)');
  _ctx.fillStyle = dmG; _ctx.strokeStyle = '#EE99FF'; _ctx.lineWidth = 2;
  _ctx.beginPath(); _ctx.ellipse(0, -s*0.05, s*0.5, s*0.5, 0, Math.PI, 0); _ctx.fill(); _ctx.stroke();
  _ctx.shadowBlur = 0;

  // Rotating lights
  ['#FF3333','#33FF66','#CC44FF','#FFFF33','#FF33FF'].forEach(function(col, i) {
    var a = (frame * 0.06) + i * (Math.PI * 2 / 5);
    _ctx.shadowColor = col; _ctx.shadowBlur = 10;
    _ctx.fillStyle   = col;
    _ctx.beginPath(); _ctx.arc(Math.cos(a)*s*0.62, s*0.08+Math.sin(a)*s*0.12, 5.5, 0, Math.PI*2); _ctx.fill();
  });
  _ctx.shadowBlur = 0;

  // Crow on top
  _ctx.fillStyle = '#111'; _ctx.strokeStyle = '#000'; _ctx.lineWidth = 2;
  _ctx.beginPath(); _ctx.ellipse(0, -s*0.62, s*0.22, s*0.18, 0, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
  _ctx.beginPath(); _ctx.arc(s*0.15, -s*0.82, s*0.16, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
  _ctx.shadowColor = '#FF44FF'; _ctx.shadowBlur = 8;
  _ctx.fillStyle = '#FF00FF';
  _ctx.beginPath(); _ctx.arc(s*0.2, -s*0.83, 4.5, 0, Math.PI*2); _ctx.fill();
  _ctx.shadowBlur = 0;
  _ctx.fillStyle = '#000';
  _ctx.beginPath(); _ctx.arc(s*0.21, -s*0.83, 2.5, 0, Math.PI*2); _ctx.fill();
  _ctx.fillStyle = '#444';
  _ctx.beginPath(); _ctx.moveTo(s*0.28,-s*0.78); _ctx.lineTo(s*0.45,-s*0.75); _ctx.lineTo(s*0.28,-s*0.7); _ctx.closePath(); _ctx.fill();

  // HP bar
  var bw = s * 2.4, bx = -bw / 2, by = s * 0.50;
  rrect(bx-2, by-2, bw+4, 22, 6, 'rgba(0,0,0,0.85)', '#7733AA', 1.5);
  var ratio = e.hp / e.maxHp;
  var hpG   = _ctx.createLinearGradient(bx, by, bx, by + 18);
  hpG.addColorStop(0, '#E066FF'); hpG.addColorStop(1, '#7B00CC');
  rrectGrd(bx, by, bw * ratio, 18, 5, hpG, null);
  _ctx.fillStyle = 'rgba(255,255,255,0.26)';
  _ctx.beginPath();
  _ctx.moveTo(bx+4, by+2); _ctx.lineTo(bx+bw*ratio-4, by+2);
  _ctx.lineTo(bx+bw*ratio-4, by+7); _ctx.lineTo(bx+4, by+7); _ctx.closePath(); _ctx.fill();
  _ctx.fillStyle = '#fff'; _ctx.font = 'bold 11px "Kosugi Maru",sans-serif'; _ctx.textAlign = 'center';
  _ctx.fillText(e.hp + '/' + e.maxHp, 0, by + 14);

  _ctx.shadowColor = '#BB66FF'; _ctx.shadowBlur = 12;
  _ctx.fillStyle = '#EE99FF'; _ctx.font = 'bold 13px "Kosugi Maru",sans-serif';
  _ctx.fillText('★ 巨大カラスUFO ★', 0, -s * 1.08);
  _ctx.shadowBlur = 0;

  _ctx.globalAlpha = 1; _ctx.restore();
}

// ── Earth ────────────────────────────────────────────────────────────────────
function drawEarth(x, y, r) {
  _ctx.save(); _ctx.translate(x, y);
  // Glow
  var gG = _ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 1.7);
  gG.addColorStop(0, 'rgba(40,130,255,0.22)'); gG.addColorStop(1, 'rgba(40,130,255,0)');
  _ctx.fillStyle = gG; _ctx.beginPath(); _ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2); _ctx.fill();
  // Ocean
  var oG = _ctx.createRadialGradient(-r*0.3,-r*0.3,0, 0,0, r);
  oG.addColorStop(0, '#3498DB'); oG.addColorStop(1, '#1A5A8E');
  _ctx.fillStyle = oG; _ctx.beginPath(); _ctx.arc(0, 0, r, 0, Math.PI*2); _ctx.fill();
  // Continents
  _ctx.fillStyle = '#27AE60';
  [[-.18,-.08,.28,.38],[.22,.12,.32,.22],[-.1,.3,.18,.14]].forEach(function(v) {
    _ctx.beginPath(); _ctx.ellipse(r*v[0],r*v[1],r*v[2],r*v[3],0.6,0,Math.PI*2); _ctx.fill();
  });
  _ctx.strokeStyle = '#1A4A8A'; _ctx.lineWidth = 2;
  _ctx.beginPath(); _ctx.arc(0, 0, r, 0, Math.PI*2); _ctx.stroke();
  // Atmosphere rim
  _ctx.strokeStyle = 'rgba(100,180,255,0.3)'; _ctx.lineWidth = r * 0.13;
  _ctx.beginPath(); _ctx.arc(0, 0, r * 1.05, 0, Math.PI*2); _ctx.stroke();
  // Specular
  _ctx.fillStyle = 'rgba(255,255,255,0.38)';
  _ctx.beginPath(); _ctx.ellipse(-r*0.22,-r*0.22,r*0.2,r*0.13,-0.5,0,Math.PI*2); _ctx.fill();
  _ctx.restore();
}

// ── Egg ──────────────────────────────────────────────────────────────────────
function drawEgg(x, y) {
  _ctx.save(); _ctx.translate(x, y);
  _ctx.shadowColor = '#FFCC00'; _ctx.shadowBlur = 14;
  _ctx.fillStyle = '#FFFDE7'; _ctx.strokeStyle = '#FF8C00'; _ctx.lineWidth = 2.5;
  _ctx.beginPath(); _ctx.ellipse(0, 0, 10, 14, 0, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
  _ctx.shadowBlur = 0;
  _ctx.fillStyle = '#FF8C00'; _ctx.font = '12px sans-serif';
  _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle'; _ctx.fillText('✨', 0, 0);
  _ctx.restore();
}

// ── Particle ─────────────────────────────────────────────────────────────────
function drawParticle(p) {
  var a = p.life / p.maxLife;
  _ctx.save(); _ctx.globalAlpha = a;
  if (p.type === 'crit' || p.type === 'explosion' || p.type === 'levelup' ||
      p.type === 'stageclear' || p.type === 'boss_beam') {
    _ctx.shadowColor = p.color; _ctx.shadowBlur = 12;
  }
  _ctx.fillStyle = p.color;
  _ctx.beginPath();
  if (p.type === 'poof') _ctx.arc(p.x, p.y, p.size * (1.2 - a * 0.5), 0, Math.PI * 2);
  else                   _ctx.arc(p.x, p.y, Math.max(1, p.size * a),   0, Math.PI * 2);
  _ctx.fill();
  _ctx.shadowBlur = 0; _ctx.globalAlpha = 1; _ctx.restore();
}
