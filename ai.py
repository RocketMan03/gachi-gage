"""같이가게 AI 기능 2가지: 주간 홍보 추천, 홍보 문구 만들기.

ANTHROPIC_API_KEY 가 있으면 Claude를 부르고, 없거나 실패하면 규칙 기반 예시로 답한다.
앱이 가게 정보·지역 맥락·실행 기록을 모아 프롬프트를 만들기 때문에 사장님은 프롬프트를 쓸 필요가 없다.
"""
import json
import os
import re

MODEL = os.getenv("CLAUDE_MODEL", "claude-haiku-5-5")
_client = None

TARGETS = {"카페": "근처 대학생과 직장인", "PC방": "근처 대학생과 게임 모임", "미용실": "예약을 고민하는 동네 손님",
           "음식점": "점심·저녁 식사 손님", "치킨·주점": "저녁 모임 손님", "꽃집": "선물을 준비하는 손님", "기타": "동네 손님"}
REASONS = {"time": "시간이 부족했어요", "photo": "사진이 없었어요", "skip": "필요 없을 것 같았어요", "etc": "기타"}


def enabled():
    return bool(os.getenv("ANTHROPIC_API_KEY"))


def _ask_json(prompt, max_tokens=1500):
    global _client
    if not enabled():
        return None
    try:
        import anthropic
        if _client is None:
            _client = anthropic.Anthropic()
        msg = _client.messages.create(
            model=MODEL, max_tokens=max_tokens,
            system=("너는 마케팅 담당자가 없는 한국 소상공인을 돕는 마케팅 비서다. 쉬운 말로, 바로 실행할 수 있게 쓴다. "
                    "가게가 알려준 사실과 너의 제안을 구분하고, 없는 사실(가격, 기간, 수치)을 지어내지 않는다. 요청한 JSON만 출력한다."),
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
        m = re.search(r"\{.*\}", text, re.S)
        return json.loads(m.group(0)) if m else None
    except Exception as e:
        print("[AI] 호출 실패, 규칙 기반으로 대체:", e)
        return None


def _main_product(p):
    items = [x for x in p.get("products", []) if x.get("name")]
    return items[0] if items else {"name": "대표 상품", "price": ""}


def _history_summary(history):
    out = []
    for w in history[-3:]:
        for r in w.get("recs", []):
            log = r.get("log")
            out.append({"week": w["week"], "title": r["title"], "done": None if not log else log.get("done"),
                        "reason": None if not log else REASONS.get(log.get("reason"), log.get("reason")),
                        "reaction": None if not log else log.get("reaction")})
    return out


# ---------------------------------------------------------------- 1. 주간 추천
def _templates(p, ctx):
    prod = _main_product(p)
    pn = prod["name"]
    price = f"({prod['price']})" if prod.get("price") else ""
    strength = (p.get("strengths") or ["우리 가게만의 장점"])[0]
    target = TARGETS.get(p.get("kind"), TARGETS["기타"])
    goal = p.get("goal_text") or ""
    t = [
        {"key": "new", "title": f"{pn} 소개 게시물 올리기", "channel": "인스타그램", "effort": "30분", "needs_photo": True,
         "target": target, "what": f"{pn}{price}을(를) 사진 한 장과 함께 소개해요. '{strength}'를 한 줄 덧붙이면 좋아요.",
         "when": "이번 주 목요일 오후", "goals": ["new", "open"],
         "why": "새로운 것을 알릴 때는 사진 한 장과 가격이 있는 게시물이 가장 이해하기 쉬워요."},
        {"key": "quiet", "title": "손님 적은 시간대 혜택 알리기", "channel": "네이버 플레이스 소식", "effort": "10분", "needs_photo": False,
         "target": target, "what": "평일 오후처럼 한산한 시간에만 쓸 수 있는 작은 혜택을 글로 알려요.",
         "when": "이번 주 화요일 오전", "goals": ["quiet", "event"],
         "why": "사진 없이 글만으로 올릴 수 있고, 한산한 시간대를 채우는 데 집중할 수 있어요."},
        {"key": "regular", "title": "단골 손님께 안부 메시지 보내기", "channel": "카카오톡 채널·문자", "effort": "10분", "needs_photo": False,
         "target": "최근 한 달 안에 온 단골 손님", "what": f"요즘 소식과 함께 '{strength}'를 짧게 전해요. 다음 방문 때 쓸 작은 혜택을 붙이면 좋아요.",
         "when": "이번 주 금요일 오후", "goals": ["regular", "event"],
         "why": "새 손님을 모으는 것보다 이미 온 손님이 다시 오게 하는 게 부담이 적어요."},
        {"key": "sign", "title": "계산대 옆 안내문 붙이기", "channel": "매장 안내문", "effort": "15분", "needs_photo": False,
         "target": "매장에 온 손님", "what": f"{pn}이나 이번 혜택을 A4 한 장 안내문으로 만들어 계산대 옆에 붙여요.",
         "when": "이번 주 월요일", "goals": ["event", "open"],
         "why": "온라인 게시물이 부담스러울 때 바로 할 수 있고, 이미 온 손님에게 확실히 보여요."},
        {"key": "review", "title": "방문 손님께 리뷰 부탁하기", "channel": "매장 안내·영수증", "effort": "5분", "needs_photo": False,
         "target": "이번 주 방문 손님", "what": "계산할 때 '리뷰 남겨 주시면 큰 힘이 돼요' 한마디와 QR 안내를 해요.",
         "when": "이번 주 내내", "goals": ["regular", "open"],
         "why": "새 손님은 리뷰를 보고 가게를 고르는 경우가 많아요."},
    ]
    if ctx:
        c = ctx[0]
        t.append({"key": "season", "title": f"'{c['title']}'에 맞춘 안내 올리기", "channel": "인스타그램 스토리", "effort": "15분",
                  "needs_photo": False, "target": target, "what": f"{c['detail']} 이 시기에 맞춰 영업시간이나 {pn}을(를) 짧게 알려요.",
                  "when": "이번 주 수요일", "goals": ["quiet", "event"],
                  "why": "손님들의 생활 일정에 맞춘 소식은 지금 필요한 정보라서 눈에 잘 띄어요.", "ctx": c})
    if goal:
        for x in t:
            if x["key"] in ("new", "quiet"):
                x["what"] += f" 사장님이 말씀하신 '{goal}'를 그대로 살려요."
    return t


def _fb_recommend(p, ctx, history, week):
    temps = _templates(p, ctx)
    last = history[-1] if history else None
    last_logs = [r.get("log") for r in (last or {}).get("recs", []) if r.get("log")]
    reasons = {l.get("reason") for l in last_logs if not l.get("done")}
    done_titles = [r["title"] for r in (last or {}).get("recs", []) if (r.get("log") or {}).get("done")]
    last_keys = {r.get("key") for r in (last or {}).get("recs", [])}
    goal_list = list(p.get("goals") or [])
    goals = set(goal_list)
    for x in temps:
        s = len(goals & set(x["goals"])) + (3 if goal_list and goal_list[0] in x["goals"] else 0)
        if x["key"] in last_keys:
            s -= 4
        if "photo" in reasons and x["needs_photo"]:
            s -= 10
        if "time" in reasons:
            s += 3 if x["effort"] in ("5분", "10분") else -2
        x["_s"] = s
    temps.sort(key=lambda x: -x["_s"])
    items = temps[:3]
    adjust = ""
    if "photo" in reasons:
        adjust = "지난주에 '사진이 없었어요'라고 하셔서, 이번 주는 사진 없이 할 수 있는 홍보를 먼저 골랐어요."
    elif "time" in reasons:
        adjust = "지난주에 '시간이 부족했어요'라고 하셔서, 10분 안에 끝나는 홍보를 먼저 골랐어요."
    elif "skip" in reasons:
        adjust = "지난주 추천이 필요 없어 보였다고 하셔서, 다른 방식의 홍보로 바꿨어요."
    if done_titles:
        items.insert(1, {"key": "follow", "title": f"지난주 '{done_titles[0]}' 이어가기", "channel": "같은 채널", "effort": "15분",
                         "needs_photo": False, "target": "지난주 게시물을 본 손님",
                         "what": "지난주에 올린 내용의 후속 소식(반응, 남은 기간, 다음 혜택)을 짧게 올려요.",
                         "when": "이번 주 수요일", "why": "한 번으로 끝내지 않고 이어서 알리면 기억에 남기 쉬워요."})
        items = items[:3]
        adjust = adjust or "지난주에 추천을 실행하셔서, 이어서 알릴 수 있는 후속 홍보를 넣었어요."
    out = []
    for i, x in enumerate(items):
        basis = [{"type": "fact", "text": f"등록하신 업종: {p.get('kind', '기타')}"}]
        prod = _main_product(p)
        if prod.get("price"):
            basis.append({"type": "fact", "text": f"등록하신 대표 상품: {prod['name']} {prod['price']}"})
        if x.get("ctx"):
            c = x["ctx"]
            basis.append({"type": "context", "text": f"{c['title']} · 출처: {c['source']} · 기준일 {c['date']}"})
        basis.append({"type": "suggestion", "text": x["why"]})
        out.append({k: x[k] for k in ("key", "title", "target", "what", "when", "why", "channel", "effort", "needs_photo")} | {"basis": basis})
    headline = f"{p.get('name', '우리 가게')}, 이번 주는 '{out[0]['title']}'부터 해 보세요."
    return {"headline": headline, "adjust": adjust, "items": out}


def recommend(p, ctx, history, week):
    prompt = f"""가게 정보: {json.dumps(p, ensure_ascii=False)}
지역·시즌 맥락(출처와 기준일 포함): {json.dumps(ctx, ensure_ascii=False)}
최근 추천과 실행 기록: {json.dumps(_history_summary(history), ensure_ascii=False)}
이번은 {week}주차 추천이다.

이 가게가 이번 주에 실행할 홍보 3개를 우선순위 순서로 추천해.
- 실행 기록에서 못 한 이유가 '사진이 없었어요'면 사진이 필요 없는 홍보를 먼저, '시간이 부족했어요'면 10분 안에 끝나는 홍보를 먼저.
- 실행한 추천이 있으면 그 후속 홍보를 하나 넣어.
- 지난주와 같은 추천은 반복하지 마.
- basis에는 가게가 알려준 사실(type "fact"), 지역 맥락(type "context", 출처·기준일 포함), 너의 제안 근거(type "suggestion")를 구분해서 넣어.
JSON 형식:
{{"headline":"이번 주 한 줄 요약","adjust":"지난 기록 때문에 무엇을 바꿨는지 한 문장(없으면 빈 문자열)",
"items":[{{"key":"영문 짧은 id","title":"할 일 제목(20자 안팎)","target":"누구에게","what":"무엇을 어떻게(2문장 이내)","when":"언제",
"why":"추천 이유 한 문장","channel":"인스타그램/네이버 플레이스 소식/매장 안내문/카카오톡 채널 등","effort":"5분/10분/15분/30분",
"needs_photo":true/false,"basis":[{{"type":"fact|context|suggestion","text":"..."}}]}}]}}"""
    data = _ask_json(prompt, 1800)
    if data and isinstance(data.get("items"), list) and data["items"]:
        for x in data["items"]:
            x.setdefault("basis", [])
            x.setdefault("needs_photo", False)
            x.setdefault("key", "ai")
        data["items"] = data["items"][:3]
        data.setdefault("adjust", "")
        return data, True
    return _fb_recommend(p, ctx, history, week), False


# ---------------------------------------------------------------- 2. 홍보 문구
def _fb_copy(p, rec, f):
    lines = [f"[{f.get('name') or p.get('name', '')}] {rec['title'].replace(' 올리기', '').replace(' 붙이기', '').replace(' 보내기', '')}"]
    if f.get("product"):
        lines.append(f"{f['product']}{' ' + f['price'] if f.get('price') else ''}")
    if f.get("period"):
        lines.append(f"기간: {f['period']}")
    if f.get("condition"):
        lines.append(f"이용 조건: {f['condition']}")
    strength = (p.get("strengths") or [""])[0]
    if strength:
        lines.append(f"{strength}, 한번 들러 주세요.")
    info = " · ".join(x for x in [p.get("region"), p.get("hours")] if x)
    if info:
        lines.append(info)
    tags = [p.get("kind", ""), f.get("product", ""), (p.get("region") or "").split(" ")[0]]
    return {"text": "\n".join(lines), "hashtags": ["#" + re.sub(r"\s+", "", t) for t in tags if t],
            "short": f"{f.get('product') or rec['title']} {f.get('price', '')}".strip()}


def copy(p, rec, fields):
    prompt = f"""가게 정보: {json.dumps(p, ensure_ascii=False)}
이번 홍보: {json.dumps({k: rec.get(k) for k in ('title', 'target', 'what', 'channel')}, ensure_ascii=False)}
사장님이 확인한 내용(이 값만 사실로 사용, 없는 가격·기간·조건은 쓰지 마): {json.dumps(fields, ensure_ascii=False)}
'{rec.get('channel')}'에 바로 올릴 수 있는 홍보 문구를 써. 짧고 친근하게, 5줄 이내.
JSON 형식: {{"text":"본문","hashtags":["#..."],"short":"안내문이나 제목용 한 줄"}}"""
    data = _ask_json(prompt, 700)
    if data and data.get("text"):
        data.setdefault("hashtags", [])
        data.setdefault("short", "")
        return data, True
    return _fb_copy(p, rec, fields), False
