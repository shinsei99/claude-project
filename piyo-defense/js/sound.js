'use strict';
const SoundManager = {
  _ctx: null,
  _bgmActive: null,
  _bgmTimers: [],
  bgmOn: true,
  seOn: true,

  init() {
    try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
    this.bgmOn = SaveManager.getBgm();
    this.seOn  = SaveManager.getSe();
  },

  resume() { if (this._ctx && this._ctx.state === 'suspended') this._ctx.resume(); },

  _play(freq, type, dur, vol, delay) {
    vol   = vol   === undefined ? 0.2 : vol;
    delay = delay === undefined ? 0   : delay;
    if (!this._ctx || !this.seOn) return;
    const t = this._ctx.currentTime + delay;
    const o = this._ctx.createOscillator();
    const g = this._ctx.createGain();
    o.connect(g); g.connect(this._ctx.destination);
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t); o.stop(t + dur + 0.01);
  },

  _noise(dur, vol, cutoff) {
    vol    = vol    === undefined ? 0.3 : vol;
    cutoff = cutoff === undefined ? 800 : cutoff;
    if (!this._ctx || !this.seOn) return;
    const rate = this._ctx.sampleRate;
    const buf  = this._ctx.createBuffer(1, Math.ceil(rate * dur), rate);
    const d    = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * (1 - i/d.length);
    const src  = this._ctx.createBufferSource();
    const filt = this._ctx.createBiquadFilter();
    const g    = this._ctx.createGain();
    src.buffer = buf; filt.type = 'lowpass'; filt.frequency.value = cutoff;
    src.connect(filt); filt.connect(g); g.connect(this._ctx.destination);
    g.gain.setValueAtTime(vol, this._ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + dur);
    src.start();
  },

  shoot()      { this._play(660,'square',0.06,0.1); this._play(440,'square',0.05,0.07,0.03); },
  hit()        { this._play(180,'sawtooth',0.05,0.1); },
  kill()       { this._noise(0.2,0.28,700); this._play(140,'sine',0.15,0.15); },
  killBig()    { this._noise(0.4,0.45,400); this._play(80,'sine',0.3,0.22); },
  levelUp()    { [523,659,784,1047].forEach((f,i) => this._play(f,'sine',0.2,0.28,i*0.1)); },
  bossAppear() { [160,120,100,80].forEach((f,i)   => this._play(f,'sawtooth',0.35,0.45,i*0.11)); },
  gameOver()   { [440,330,220,110].forEach((f,i)  => this._play(f,'sine',0.5,0.32,i*0.22)); },
  stageClear() { [392,523,659,784,1047].forEach((f,i) => this._play(f,'sine',0.3,0.4,i*0.1)); },
  bossWarn()   { [100,80,100,80].forEach((f,i) => this._play(f,'sawtooth',0.2,0.4,i*0.15)); },

  startBgm(type) {
    if (this._bgmActive === type) return;
    this.stopBgm(); this._bgmActive = type;
    if (this.bgmOn && this._ctx) this._runBgm(type);
  },

  stopBgm() {
    this._bgmActive = null;
    this._bgmTimers.forEach(clearTimeout);
    this._bgmTimers = [];
  },

  toggleBgm() {
    this.bgmOn = !this.bgmOn; SaveManager.setBgm(this.bgmOn);
    if (this.bgmOn) { const t=this._bgmActive; this._bgmActive=null; this.startBgm(t); }
    else { this._bgmTimers.forEach(clearTimeout); this._bgmTimers=[]; }
  },

  toggleSe() { this.seOn = !this.seOn; SaveManager.setSe(this.seOn); },

  _patterns: {
    title:  { n:[262,330,392,330,392,523,494,392], bpm:80,  vol:0.05, w:'sine'     },
    battle: { n:[330,392,440,392,330,294,330,392], bpm:145, vol:0.07, w:'square'   },
    boss:   { n:[110,131,110,98, 110,123,110,87],  bpm:125, vol:0.09, w:'sawtooth' },
  },

  _runBgm(type) {
    const p = this._patterns[type];
    if (!p || !this._ctx) return;
    const beat = 60 / p.bpm;
    const run = (t0) => {
      if (this._bgmActive !== type || !this.bgmOn) return;
      p.n.forEach((freq, i) => {
        const t = t0 + i * beat;
        if (t < this._ctx.currentTime - 0.01) return;
        const o = this._ctx.createOscillator();
        const g = this._ctx.createGain();
        o.connect(g); g.connect(this._ctx.destination);
        o.type = p.w; o.frequency.value = freq;
        g.gain.setValueAtTime(p.vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.7);
        o.start(t); o.stop(t + beat * 0.7 + 0.01);
      });
      const next  = t0 + beat * p.n.length;
      const delay = Math.max(0, (next - this._ctx.currentTime) * 1000 - 150);
      this._bgmTimers.push(setTimeout(() => run(next), delay));
    };
    run(this._ctx.currentTime + 0.1);
  }
};
