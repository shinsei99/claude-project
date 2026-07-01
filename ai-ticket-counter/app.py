# -*- coding: utf-8 -*-
"""AI受付＆起票カウンター — Webhook サーバ + 対話型ブラウザUI（FastAPI）。

Slack Events API を受けて、①受付 → ②AI解析 → ③起票 → ④メール → ⑤返信 を実行。
さらに、Slack をつなぐ前でもブラウザで試せるように「/」に対話ヒアリング画面を用意。
要件を選ぶと AI（受付）が業務口調で症状を聞き出し、十分そろったら起票＋通知する。

起動:  uvicorn app:app --host 0.0.0.0 --port 8600  /  または  python app.py
ブラウザ:  http://localhost:8600
"""

import tempfile
import time

from fastapi import BackgroundTasks, FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse

import config
from core.models import Report, REQUEST_TYPES
from core.pipeline import finalize_conversation
from data.apps import APP_NAMES, REPORTERS
from services import intake, reply
from services.chat import get_adapter
from services.reply import acknowledge

app = FastAPI(title="AI受付＆起票カウンター", version="1.0.0")

_seen_events = set()  # Slack 重複配信よけ


def _run_pipeline(report):
    """Slack 用バックグラウンド実行：画像DL → 単発パイプライン。"""
    from core.pipeline import process_report
    adapter = get_adapter()
    with tempfile.TemporaryDirectory(prefix="aitc_dl_") as td:
        try:
            adapter.download_images(report, td)
        except Exception as e:
            print(f"[pipeline] 画像DL失敗: {e}")
        process_report(report, adapter=adapter)


# ── 対話型ブラウザUI ─────────────────────────────────────────────────
_PAGE = """<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI受付＆起票カウンター</title>
<style>
  body{font-family:-apple-system,'Hiragino Sans',sans-serif;background:#f4f6f8;margin:0;color:#222;}
  .wrap{max-width:640px;margin:0 auto;padding:24px 16px 60px;}
  h1{font-size:22px;margin:8px 0 4px;}
  .sub{color:#777;font-size:13px;margin-bottom:20px;}
  .card{background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:16px;}
  label{font-weight:bold;font-size:14px;display:block;margin:12px 0 4px;}
  select,input,textarea{width:100%;box-sizing:border-box;border:1px solid #ccc;border-radius:8px;padding:10px;font-size:15px;background:#fff;}
  button{margin-top:8px;background:#2e7d32;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-size:16px;cursor:pointer;}
  button:disabled{background:#9e9e9e;cursor:default;}
  .full{width:100%;}
  /* chat */
  #log{display:flex;flex-direction:column;gap:10px;margin-bottom:12px;max-height:52vh;overflow-y:auto;}
  .row{display:flex;}
  .row.user{justify-content:flex-end;}
  .bubble{max-width:80%;padding:9px 13px;border-radius:14px;font-size:14px;line-height:1.6;white-space:pre-wrap;}
  .row.ai .bubble{background:#eef3fb;border-bottom-left-radius:4px;}
  .row.user .bubble{background:#dcf5dc;border-bottom-right-radius:4px;}
  .who{font-size:11px;color:#999;margin:0 6px 2px;}
  .inputbar{display:flex;gap:8px;}
  .inputbar input{flex:1;}
  .inputbar button{margin-top:0;}
  .result{background:#f7faf7;border:1px solid #d7e8d7;border-radius:10px;padding:14px;margin-top:8px;font-size:13px;}
  .badge{display:inline-block;background:#e8eaf6;border-radius:6px;padding:2px 8px;margin:0 6px 4px 0;font-size:12px;}
  .typing{color:#999;font-size:13px;padding:4px 8px;}
</style>
</head>
<body>
<div class="wrap">
  <h1>🎫 AI受付＆起票カウンター</h1>
  <div class="sub">要件を選んで「相談を開始」すると、AI受付が内容をお伺いします。やり取りだけで起票・通知まで完了します。</div>

  <div class="card" id="setup">
    <label>報告者</label>
    <select id="reporter">%%REPORTER_OPTIONS%%</select>
    <label>要件</label>
    <select id="kind">%%KIND_OPTIONS%%</select>
    <label>対象アプリ（分かれば）</label>
    <select id="app">%%APP_OPTIONS%%</select>
    <button class="full" onclick="start()" style="margin-top:16px;">相談を開始 💬</button>
  </div>

  <div class="card" id="chat" style="display:none;">
    <div id="log"></div>
    <div class="inputbar">
      <input id="msg" placeholder="返信を入力…" onkeydown="if(event.key==='Enter')send()">
      <button id="sendbtn" onclick="send()">送信</button>
    </div>
    <button id="finishbtn" class="full" onclick="finalizeNow()" disabled
      style="margin-top:10px;background:#455a64;">ここまでの内容でメール送信 📨</button>
    <div style="font-size:11px;color:#999;margin-top:4px;">途中で終える場合はこちら。ここまでの対話から報告書を作成して送信します。</div>
    <div id="result"></div>
  </div>
</div>
<script>
let messages=[], meta={}, done=false;
function sel(id){return document.getElementById(id).value;}
function esc(s){s=(s==null?'':''+s);return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}

function start(){
  meta={reporter:sel('reporter'), kind:sel('kind'), app:sel('app')};
  document.getElementById('setup').style.display='none';
  document.getElementById('chat').style.display='block';
  post([]).then(d=>{ addMsg('assistant', d.question); focusInput(); });
}
function addMsg(role,text){ messages.push({role,text}); render();
  if(role==='user' && !done){ document.getElementById('finishbtn').disabled=false; } }
function render(){
  const log=document.getElementById('log');
  log.innerHTML=messages.map(m=>{
    const ai=(m.role==='assistant');
    return '<div><div class="who" style="text-align:'+(ai?'left':'right')+'">'+
      (ai?'AI受付':esc(meta.reporter||'あなた'))+'</div>'+
      '<div class="row '+(ai?'ai':'user')+'"><div class="bubble">'+esc(m.text)+'</div></div></div>';
  }).join('');
  log.scrollTop=log.scrollHeight;
}
function focusInput(){document.getElementById('msg').focus();}
function setTyping(on){
  const log=document.getElementById('log');
  let t=document.getElementById('typing');
  if(on){ if(!t){t=document.createElement('div');t.id='typing';t.className='typing';t.textContent='AI受付が入力中…';log.appendChild(t);log.scrollTop=log.scrollHeight;} }
  else if(t){ t.remove(); }
}
async function post(msgs, extra){
  const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(Object.assign({}, meta, {messages:msgs}, extra||{}))});
  return r.json();
}
async function send(){
  if(done) return;
  const inp=document.getElementById('msg');
  const t=inp.value.trim(); if(!t) return;
  inp.value='';
  addMsg('user', t);
  lock(true); setTyping(true);
  try{
    const d=await post(messages);
    setTyping(false);
    if(d.done){
      addMsg('assistant', d.reply);
      showResult(d); finish();
    }else{
      addMsg('assistant', d.question); lock(false); focusInput();
    }
  }catch(e){ setTyping(false); addMsg('assistant','通信エラーが発生しました: '+esc(''+e)); lock(false); }
}
async function finalizeNow(){
  if(done) return;
  if(!messages.some(m=>m.role==='user')){ alert('先に症状やご要望を一言入力してください'); return; }
  lock(true); document.getElementById('finishbtn').disabled=true; setTyping(true);
  try{
    const d=await post(messages, {force:true});
    setTyping(false);
    if(d.done){ addMsg('assistant', d.reply); showResult(d); finish(); }
    else{ addMsg('assistant', d.question); lock(false); document.getElementById('finishbtn').disabled=false; }
  }catch(e){ setTyping(false); addMsg('assistant','通信エラーが発生しました: '+esc(''+e)); lock(false); document.getElementById('finishbtn').disabled=false; }
}
function lock(on){ document.getElementById('sendbtn').disabled=on; document.getElementById('msg').disabled=on; }
function finish(){ done=true; document.getElementById('msg').placeholder='受付は完了しました'; document.getElementById('msg').disabled=true; document.getElementById('sendbtn').disabled=true; document.getElementById('finishbtn').disabled=true; document.getElementById('finishbtn').style.display='none'; }
function showResult(d){
  const a=d.analysis||{};
  document.getElementById('result').innerHTML=
    '<div class="result"><b>起票内容</b><br><br>'+
    '<span class="badge">アプリ: '+esc(a.target_app)+'</span>'+
    '<span class="badge">種類: '+esc(a.kind)+'</span>'+
    '<span class="badge">優先度: '+esc(a.priority)+'</span><br>'+
    '<b>件名:</b> '+esc(a.title)+'<br>'+
    '<b>チケット:</b> '+esc(d.ticket||'(なし)')+'</div>';
}
</script>
</body>
</html>"""


@app.get("/", response_class=HTMLResponse)
def home():
    reporter_opts = "".join(f'<option value="{n}">{n}</option>' for n in REPORTERS)
    app_opts = '<option value="">🤖 分からない（AIにお任せ）</option>' + \
        "".join(f'<option value="{n}">{n}</option>' for n in APP_NAMES)
    kind_opts = '<option value="">🤖 AIにお任せ</option>' + \
        "".join(f'<option value="{n}">{n}</option>' for n in REQUEST_TYPES)
    return _PAGE.replace("%%REPORTER_OPTIONS%%", reporter_opts) \
                .replace("%%APP_OPTIONS%%", app_opts) \
                .replace("%%KIND_OPTIONS%%", kind_opts)


@app.get("/health")
def health():
    return {"ok": True, "app": "AI受付＆起票カウンター",
            "chat": config.CHAT_BACKEND, "ticket": config.TICKET_BACKEND}


@app.post("/chat")
async def chat(request: Request):
    """対話ヒアリング。空 messages なら第一声、以降は次の質問 or 確定＋起票を返す。"""
    body = await request.json()
    reporter = body.get("reporter") or "不明"
    forced_app = body.get("app", "")
    forced_kind = body.get("kind", "")
    messages = body.get("messages", []) or []
    force = bool(body.get("force"))
    has_user = any(m.get("role") == "user" for m in messages)

    # 会話の開始（第一声）— AI呼び出し不要
    if not messages:
        return JSONResponse({"done": False, "question": intake.opening(forced_kind, forced_app)})

    if force:
        # 途中終了：まだ何も話していなければ確定できない
        if not has_user:
            return JSONResponse({"done": False,
                                 "question": "送信する前に、症状やご要望を一言お聞かせください。"})
        analysis = intake.finalize(messages, reporter, forced_app, forced_kind)
    else:
        turn = intake.next_turn(messages, reporter, forced_app, forced_kind)
        if not turn["done"]:
            return JSONResponse({"done": False, "question": turn["question"]})
        analysis = turn["analysis"]

    # 確定 → ③起票 ④メール（対話履歴同封）
    user_text = "\n".join(m.get("text", "") for m in messages if m.get("role") == "user")
    report = Report(
        text=user_text,
        reporter=reporter,
        forced_app=forced_app,
        forced_kind=forced_kind,
        created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
        source="manual",
    )
    result = finalize_conversation(report, analysis, messages, adapter=None)
    return JSONResponse({
        "done": True,
        "reply": reply.result_message(result),
        "analysis": {
            "target_app": analysis.target_app,
            "kind": analysis.kind,
            "priority": analysis.priority,
            "title": analysis.title,
        },
        "ticket": result.ticket.url if result.ticket else "",
        "errors": result.errors,
    })


# ── Slack Webhook ────────────────────────────────────────────────────
@app.post("/slack/events")
async def slack_events(request: Request, background: BackgroundTasks):
    raw = await request.body()
    adapter = get_adapter()

    headers = {k.lower(): v for k, v in request.headers.items()}
    if not adapter.verify(headers, raw):
        return PlainTextResponse("invalid signature", status_code=401)

    payload = await request.json()
    if payload.get("type") == "url_verification":
        return PlainTextResponse(payload.get("challenge", ""))

    event_id = payload.get("event_id")
    if event_id:
        if event_id in _seen_events:
            return JSONResponse({"ok": True, "dup": True})
        _seen_events.add(event_id)
        if len(_seen_events) > 5000:
            _seen_events.clear()

    report, should = adapter.parse_event(payload)
    if not should:
        return JSONResponse({"ok": True, "skip": True})

    try:
        adapter.reply(report, acknowledge(report.reporter))
    except Exception as e:
        print(f"[slack] ack失敗: {e}")
    background.add_task(_run_pipeline, report)
    return JSONResponse({"ok": True})


if __name__ == "__main__":
    import uvicorn
    print(f"起動: http://{config.HOST}:{config.PORT}  "
          f"(chat={config.CHAT_BACKEND}, ticket={config.TICKET_BACKEND})")
    uvicorn.run("app:app", host=config.HOST, port=config.PORT, reload=False)
