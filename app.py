"""같이가게 MVP 서버 (Flask) — 우리 가게를 이해하는 마케팅 AI

실행:  python app.py   →  브라우저에서 http://127.0.0.1:5000
방문자마다 브라우저 쿠키로 가게 하나가 따로 저장된다(로그인 없음).
"""
import copy as _copy
import datetime as dt
import os
import secrets
import socket
import uuid

from flask import Flask, abort, jsonify, request, send_from_directory, session

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import ai
import db
import ig
import region

BASE = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder="static", static_url_path="/static")
app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024  # 사진 1장 최대 12MB

# 플랜 (가격·한도는 팀 논의의 예시이며 확정 전)
PLANS = {
    "lite": {"name": "라이트", "price": 4900, "copies": 10, "features": ["월 4회 홍보 추천", "홍보 문구 월 10회", "실행 기록"]},
    "basic": {"name": "기본", "price": 9900, "copies": 30, "features": ["매주 홍보 추천과 알림", "홍보 문구 월 30회", "실행 기록 분석"]},
    "plus": {"name": "플러스", "price": 29000, "copies": 100, "features": ["기본 플랜의 모든 기능", "홍보 문구 월 100회", "리뷰·인사이트 캡처 분석(예정)", "여러 매장 관리(예정)"]},
}
MANAGERS = ("duri", "moa", "tori", "tantan")  # 함께할 매니저 캐릭터
GOALS = {"new": "신메뉴·새 상품 알리기", "quiet": "손님 적은 시간대 채우기", "regular": "단골 손님 늘리기",
         "open": "오픈·리뉴얼 알리기", "event": "행사·할인 알리기"}


def _secret_key():
    if os.getenv("SECRET_KEY"):
        return os.getenv("SECRET_KEY")
    path = os.path.join(BASE, "data", "secret.key")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        with open(path, "w") as f:
            f.write(secrets.token_hex(32))
    with open(path) as f:
        return f.read().strip()


app.secret_key = _secret_key()
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax",
                  PERMANENT_SESSION_LIFETIME=dt.timedelta(days=60))


def _sid():
    if "sid" not in session:
        session["sid"] = uuid.uuid4().hex
        session.permanent = True
    return session["sid"]


def _store_or_404():
    s = db.get(_sid())
    if not s:
        abort(404, "먼저 가게를 등록해 주세요.")
    return s


def _week_date(s, week):
    return dt.date.fromisoformat(s["start"]) + dt.timedelta(days=7 * (week - 1))


def _week_label(d):
    first = d.replace(day=1)
    n = (d.day + first.weekday() - 1) // 7 + 1
    return f"{d.month}월 {n}주차"


def _txt(v, n):
    return str(v or "").strip()[:n]


def _clean_profile(d):
    prods = [{"name": _txt(x.get("name"), 30), "price": _txt(x.get("price"), 20)}
             for x in (d.get("products") or []) if _txt(x.get("name"), 30)][:5]
    p = {
        "name": _txt(d.get("name"), 30), "kind": _txt(d.get("kind"), 15) or "기타",
        "kind_etc": _txt(d.get("kind_etc"), 20), "region": _txt(d.get("region"), 60),
        "hours": _txt(d.get("hours"), 40), "closed": [_txt(x, 5) for x in (d.get("closed") or [])][:7],
        "products": prods, "strengths": [_txt(x, 30) for x in (d.get("strengths") or []) if _txt(x, 30)][:5],
        "goals": [g for g in (d.get("goals") or []) if g in GOALS][:3], "goal_text": _txt(d.get("goal_text"), 80),
        "notify": _txt(d.get("notify"), 20) or "매주 월요일 오전",
        "manager": d.get("manager") if d.get("manager") in MANAGERS else "duri",
    }
    if not p["name"]:
        abort(400, "가게 이름을 다시 확인해 주세요.")
    return p


def _profile_for_ai(p):
    q = dict(p)
    if p["kind"] == "기타" and p.get("kind_etc"):
        q["kind_detail"] = p["kind_etc"]
    q["goals"] = [GOALS[g] for g in p.get("goals", [])]
    q["goal_keys"] = p.get("goals", [])
    return q


def _make_week(s, week):
    d = _week_date(s, week)
    ctx = region.context(s["profile"], d)
    p = _profile_for_ai(s["profile"])
    p["goals"] = p.pop("goal_keys")  # 규칙 기반은 키, AI 프롬프트는 아래에서 설명을 함께 본다
    p["goal_names"] = [GOALS[g] for g in p["goals"]]
    data, live = ai.recommend(p, ctx, s["weeks"], week)
    recs = []
    for i, x in enumerate(data["items"]):
        x = dict(x)
        x["id"] = f"w{week}r{i}"
        x["log"] = None
        recs.append(x)
    return {"week": week, "label": _week_label(d), "date": d.isoformat(), "headline": data.get("headline", ""),
            "adjust": data.get("adjust", ""), "live": live, "ctx": ctx, "recs": recs, "copies": {}}


def _new_store(p, demo=False):
    s = {"profile": p, "start": dt.date.today().isoformat(), "plan": "basic", "usage": {"copies": 0}, "weeks": [], "demo": demo}
    s["weeks"].append(_make_week(s, 1))
    return db.save(_sid(), s)


def _public(s):
    s = _copy.deepcopy(s)
    s["planInfo"] = {"key": s["plan"], **PLANS[s["plan"]], "used": s["usage"]["copies"]}
    return s


@app.after_request
def no_cache(resp):
    """화면 파일을 브라우저가 오래 저장하지 않게 해서, 코드를 바꾸면 바로 새 화면이 보이게 한다."""
    if request.path == "/" or request.path.startswith("/static/") or request.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-cache, must-revalidate"
    return resp


# ---------- 화면 ----------
@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


# ---------- API ----------
@app.get("/api/state")
def state():
    s = db.get(_sid())
    removed = _sync_posts(s) if s else []
    return jsonify(store=_public(s) if s else None, aiLive=ai.enabled(), plans=PLANS, goals=GOALS, ig=ig.status(), removed=removed)


@app.post("/api/onboard")
def onboard():
    return jsonify(store=_public(_new_store(_clean_profile(request.get_json(force=True)))))


SAMPLES = {
    "PC방": {"name": "레벨업 PC방", "kind": "PC방", "region": "경산시 대학로 (영남대 정문 인근)", "hours": "24시간",
            "products": [{"name": "새 게이밍 좌석", "price": "시간당 1,500원"}, {"name": "야간 정액권", "price": "8,000원"}],
            "strengths": ["새로 바꾼 좌석", "넓은 단체석"], "goals": ["new", "quiet"], "goal_text": "새로 바꾼 좌석을 알리고 싶어요", "manager": "duri"},
    "카페": {"name": "카페 온담", "kind": "카페", "region": "경산시 대학로 (영남대 정문 인근)", "hours": "10:00 ~ 22:00", "closed": ["월"],
           "products": [{"name": "딸기 라떼", "price": "5,500원"}, {"name": "아메리카노", "price": "3,000원"}],
           "strengths": ["창가 자리 햇살", "직접 만든 디저트"], "goals": ["new", "regular"], "goal_text": "겨울 신메뉴를 알리고 싶어요",
           "notify": "매주 금요일 오후", "manager": "tantan"},
    "미용실": {"name": "헤어 살롱 결", "kind": "미용실", "region": "경산시 사동", "hours": "10:00 ~ 20:00", "closed": ["화"],
            "products": [{"name": "남성 커트", "price": "15,000원"}, {"name": "뿌리 염색", "price": "40,000원"}],
            "strengths": ["1:1 예약제", "꼼꼼한 상담"], "goals": ["quiet", "regular"], "goal_text": "평일 오후 예약이 비어요", "manager": "moa"},
}


@app.post("/api/demo")
def demo():
    """예시 가게로 바로 둘러보기 (발표 시연용)."""
    kind = request.get_json(force=True).get("kind", "PC방")
    return jsonify(store=_public(_new_store(_clean_profile(SAMPLES.get(kind, SAMPLES["PC방"])), demo=True)))


@app.put("/api/profile")
def update_profile():
    s = _store_or_404()
    s["profile"] = _clean_profile(request.get_json(force=True))
    db.save(_sid(), s)
    return jsonify(store=_public(s))


@app.post("/api/refresh")
def refresh():
    """가게 정보를 바꾼 뒤 이번 주 추천을 다시 받는다 (아직 기록이 없을 때만)."""
    s = _store_or_404()
    cur = s["weeks"][-1]
    if any(r.get("log") for r in cur["recs"]):
        abort(400, "이미 기록을 남긴 주차라 추천을 바꿀 수 없어요. 바뀐 정보는 다음 주 추천에 반영돼요.")
    s["weeks"][-1] = _make_week({**s, "weeks": s["weeks"][:-1]}, cur["week"])
    db.save(_sid(), s)
    return jsonify(store=_public(s))


def _find_rec(s, rid):
    for w in s["weeks"]:
        for r in w["recs"]:
            if r["id"] == rid:
                return w, r
    abort(404, "추천을 찾을 수 없어요.")


@app.post("/api/copy")
def make_copy():
    s = _store_or_404()
    d = request.get_json(force=True)
    w, r = _find_rec(s, d.get("rec"))
    plan = PLANS[s["plan"]]
    if s["usage"]["copies"] >= plan["copies"]:
        abort(403, f"이번 달 문구 만들기 {plan['copies']}회를 모두 썼어요. 플랜에서 한도를 늘릴 수 있어요.")
    fields = {k: _txt((d.get("fields") or {}).get(k), 60) for k in ("name", "product", "price", "period", "condition")}
    data, live = ai.copy(_profile_for_ai(s["profile"]), r, fields)
    s["usage"]["copies"] += 1
    w["copies"][r["id"]] = {"fields": fields, **data, "live": live}
    db.save(_sid(), s)
    return jsonify(store=_public(s), copy=w["copies"][r["id"]])


# ---------- 인스타그램 바로 올리기 ----------
@app.get("/media/<path:name>")
def media(name):
    # Meta 서버가 이 주소로 사진을 가져간다 (공개 필요)
    return send_from_directory(ig.MEDIA_DIR, name)


@app.post("/api/photo")
def upload_photo():
    s = _store_or_404()
    w, r = _find_rec(s, request.args.get("rec"))
    raw = request.get_data()
    if not raw:
        abort(400, "사진이 비어 있어요.")
    try:
        name = ig.save_photo(raw)
    except ig.IGError as e:
        abort(400, str(e))
    w.setdefault("photos", {})[r["id"]] = name
    db.save(_sid(), s)
    return jsonify(store=_public(s))


@app.post("/api/instagram/publish")
def ig_publish():
    s = _store_or_404()
    d = request.get_json(force=True)
    w, r = _find_rec(s, d.get("rec"))
    if not ig.check_pin(d.get("pin")):
        abort(403, "게시 PIN이 맞지 않아요.")
    if (w.get("posts") or {}).get(r["id"]):
        abort(400, "이미 올린 홍보예요. 인스타그램에서 확인해 주세요.")
    text = _txt(d.get("text"), 2200)
    if not text:
        abort(400, "올릴 문구가 비어 있어요.")
    try:
        res = ig.publish((w.get("photos") or {}).get(r["id"]), text)
    except ig.IGError as e:
        abort(400, str(e))
    w.setdefault("posts", {})[r["id"]] = {**res, "at": dt.datetime.now().isoformat(timespec="minutes")}
    if not r.get("log"):  # 올렸으면 '했어요'로 기록
        r["log"] = {"done": True, "reason": None, "at": dt.datetime.now().isoformat(timespec="minutes"), "reaction": {}}
    db.save(_sid(), s)
    return jsonify(store=_public(s), post=w["posts"][r["id"]])


SYNC_EVERY = 30  # 같은 게시물은 30초에 한 번만 인스타그램에 확인


def _mark_deleted(w, rid, by):
    post = w["posts"].pop(rid)
    w.setdefault("deleted", []).append({**post, "rec": rid, "by": by, "deletedAt": dt.datetime.now().isoformat(timespec="minutes")})


def _sync_posts(s, rid=None, force=False):
    """인스타그램 앱에서 직접 지운 게시물을 찾아 '올렸어요' 상태에서 뺀다. 뺀 홍보 제목 목록을 돌려준다."""
    if not ig.enabled():
        return []
    now, removed, changed = dt.datetime.now().timestamp(), [], False
    for w in s.get("weeks", []):
        for r_id, post in list((w.get("posts") or {}).items()):
            if rid and r_id != rid:
                continue
            if not force and now - post.get("checkedAt", 0) < SYNC_EVERY:
                continue
            ok = ig.exists(post.get("id"))
            if ok is False:
                _mark_deleted(w, r_id, "instagram")
                removed.append(next((r["title"] for r in w["recs"] if r["id"] == r_id), "홍보"))
            elif ok is True:
                post["checkedAt"] = now
            changed = True
    if changed:
        db.save(_sid(), s)
    return removed


@app.post("/api/instagram/sync")
def ig_sync():
    s = _store_or_404()
    d = request.get_json(silent=True) or {}
    removed = _sync_posts(s, d.get("rec"), force=bool(d.get("force")))
    return jsonify(store=_public(s), removed=removed)


@app.post("/api/instagram/delete")
def ig_delete():
    s = _store_or_404()
    d = request.get_json(force=True)
    w, r = _find_rec(s, d.get("rec"))
    if not ig.check_pin(d.get("pin")):
        abort(403, "게시 PIN이 맞지 않아요.")
    post = (w.get("posts") or {}).get(r["id"])
    if not post:
        abort(400, "이 홍보로 올린 인스타그램 게시물이 없어요.")
    by = "app"
    try:
        ig.delete(post["id"])
    except ig.IGError as e:
        if not (ig.gone(e) or ig.exists(post["id"]) is False):
            abort(400, str(e))
        by = "instagram"  # 이미 인스타그램에서 지워져 있었음
    _mark_deleted(w, r["id"], by)  # 다시 올릴 수 있게
    db.save(_sid(), s)
    return jsonify(store=_public(s))


@app.post("/api/log")
def log():
    s = _store_or_404()
    d = request.get_json(force=True)
    w, r = _find_rec(s, d.get("rec"))
    done = bool(d.get("done"))
    reason = None if done else d.get("reason")
    if not done and reason not in ai.REASONS:
        abort(400, "못 한 이유를 골라 주세요.")
    react = d.get("reaction") or {}
    r["log"] = {"done": done, "reason": reason, "at": dt.datetime.now().isoformat(timespec="minutes"),
                "reaction": {k: _txt(react.get(k), 12) for k in ("inquiries", "likes", "sales") if _txt(react.get(k), 12)}}
    db.save(_sid(), s)
    return jsonify(store=_public(s))


@app.post("/api/next-week")
def next_week():
    """시연용: 일주일이 지난 것으로 보고, 기록을 반영한 다음 주 추천을 만든다."""
    s = _store_or_404()
    cur = s["weeks"][-1]
    if not any(r.get("log") for r in cur["recs"]):
        abort(400, "이번 주 추천 중 하나 이상 기록을 남겨 주세요. 기록이 다음 추천에 반영돼요.")
    s["weeks"].append(_make_week(s, cur["week"] + 1))
    db.save(_sid(), s)
    return jsonify(store=_public(s))


@app.post("/api/plan")
def set_plan():
    s = _store_or_404()
    plan = request.get_json(force=True).get("plan")
    if plan not in PLANS:
        abort(400, "플랜을 다시 골라 주세요.")
    s["plan"] = plan
    db.save(_sid(), s)
    return jsonify(store=_public(s))


@app.post("/api/reset")
def reset():
    db.delete(_sid())
    return jsonify(store=None)


@app.errorhandler(400)
@app.errorhandler(413)
@app.errorhandler(403)
@app.errorhandler(404)
def err(e):
    if getattr(e, "code", 0) == 413:
        return jsonify(error="사진이 너무 커요. 12MB 이하로 올려 주세요."), 413
    return jsonify(error=getattr(e, "description", "") or "요청을 처리하지 못했어요."), getattr(e, "code", 400)


def _lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return None


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    ip = _lan_ip()
    print("\n  같이가게 MVP 실행 중")
    print(f"  - 내 컴퓨터:        http://127.0.0.1:{port}")
    if ip:
        print(f"  - 같은 와이파이:    http://{ip}:{port}")
    print(f"  - AI: {'Claude 연결됨' if ai.enabled() else '규칙 기반 예시 (.env에 ANTHROPIC_API_KEY를 넣으면 실제 AI)'}")
    print("  끄려면 Ctrl + C\n")
    app.run(host="0.0.0.0", port=port, debug=False)
