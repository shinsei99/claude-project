'use strict';
const SaveManager = {
  _k: { hs:'piyo_hs', bs:'piyo_bs', bgm:'piyo_bgm', se:'piyo_se' },
  getHigh()  { return { score: +localStorage.getItem(this._k.hs)||0, stage: +localStorage.getItem(this._k.bs)||0 }; },
  getBgm()   { const v=localStorage.getItem(this._k.bgm); return v===null?true:v==='true'; },
  getSe()    { const v=localStorage.getItem(this._k.se);  return v===null?true:v==='true'; },
  setBgm(v)  { localStorage.setItem(this._k.bgm, String(v)); },
  setSe(v)   { localStorage.setItem(this._k.se,  String(v)); },
  save(score, stage) {
    const h   = this.getHigh();
    const isHS = score > h.score;
    if (isHS)          localStorage.setItem(this._k.hs, score);
    if (stage > h.stage) localStorage.setItem(this._k.bs, stage);
    return isHS;
  }
};
