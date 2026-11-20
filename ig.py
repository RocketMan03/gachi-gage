"""인스타그램 바로 올리기 (Meta 공식 API: Instagram API with Instagram Login)

필요한 환경변수 (Render → Environment)
  INSTAGRAM_TOKEN        액세스 토큰 (없으면 이 기능은 꺼지고 복사 방식으로 작동)
                         - 'IG'로 시작: 인스타그램 로그인 방식 → graph.instagram.com
                         - 'EAA'로 시작: 페이스북 로그인 방식 → graph.facebook.com
                           (인스타 계정이 페이스북 페이지에 연결돼 있어야 함)
  INSTAGRAM_USER_ID      (선택) 인스타 비즈니스 계정 ID. 'EAA' 토큰에서 자동으로 못 찾을 때 직접 넣는다.
  INSTAGRAM_PUBLISH_PIN  (권장) 올리기 전에 입력할 숫자. 공개 사이트에서 아무나 우리 계정에 올리지 못하게 막는다.
  PUBLIC_BASE_URL        (선택) 사진을 Meta가 가져갈 공개 주소. Render는 RENDER_EXTERNAL_URL을 자동으로 쓴다.

인스타그램은 사진을 '주소로 가져가는' 방식이라 내 컴퓨터(127.0.0.1)에서는 올릴 수 없고,
Render 같은 공개 주소에서만 작동한다.
"""
import io
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

BASE = os.path.dirname(os.path.abspath(__file__))
MEDIA_DIR = os.path.join(BASE, "data", "media")
_me_cache = {"at": 0, "data": None}


def fb_login():
    """'EAA'로 시작하면 페이스북 로그인 방식 토큰."""
    return token().startswith("EAA")


def _host():
    if fb_login():
        return os.getenv("FB_GRAPH_HOST", "https://graph.facebook.com")
    return os.getenv("IG_GRAPH_HOST", "https://graph.instagram.com")


def _ver():
    return os.getenv("IG_GRAPH_VERSION", "v25.0")


def token():
    return (os.getenv("INSTAGRAM_TOKEN") or "").strip()


def enabled():
    return bool(token())


def pin_required():
    return bool((os.getenv("INSTAGRAM_PUBLISH_PIN") or "").strip())


def check_pin(pin):
    want = (os.getenv("INSTAGRAM_PUBLISH_PIN") or "").strip()
    return not want or str(pin or "").strip() == want


def public_base():
    url = (os.getenv("PUBLIC_BASE_URL") or os.getenv("RENDER_EXTERNAL_URL") or "").strip().rstrip("/")
    return url


class IGError(Exception):
    pass


def _call(method, path, params):
    params = dict(params, access_token=token())
    url = f"{_host()}/{_ver()}/{path}"
    data = None
    if method == "GET":
        url += "?" + urllib.parse.urlencode(params)
    else:
        data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(url, data=data, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            err = json.loads(e.read().decode()).get("error", {})
        except Exception:
            err = {}
        code, msg = err.get("code"), err.get("error_user_msg") or err.get("message") or f"HTTP {e.code}"
        if code == 190:
            raise IGError("인스타그램 토큰이 만료됐거나 올바르지 않아요. Meta 개발자 화면에서 토큰을 다시 만들어 넣어 주세요.")
        if code in (10, 200):
            raise IGError(f"게시 권한이 없어요. 토큰을 만들 때 instagram_business_content_publish 권한을 허용했는지 확인해 주세요. ({msg})")
        raise IGError(f"인스타그램이 요청을 거절했어요: {msg}")
    except urllib.error.URLError as e:
        raise IGError(f"인스타그램 서버에 연결하지 못했어요: {e.reason}")


def me():
    """연결된 계정 정보 (10분 캐시)."""
    if not enabled():
        return None
    if _me_cache["data"] and time.time() - _me_cache["at"] < 600:
        return _me_cache["data"]
    if fb_login():
        data = _fb_ig_account()
    else:
        d = _call("GET", "me", {"fields": "user_id,username"})
        data = {"id": d.get("user_id") or d.get("id"), "username": d.get("username", "")}
    _me_cache.update(at=time.time(), data=data)
    return data


def _fb_ig_account():
    """페이스북 로그인 토큰: 페이지에 연결된 인스타 비즈니스 계정을 찾는다."""
    uid = (os.getenv("INSTAGRAM_USER_ID") or "").strip()
    if uid:
        d = _call("GET", uid, {"fields": "username"})
        return {"id": uid, "username": d.get("username", "")}
    pages = _call("GET", "me/accounts", {"fields": "name,instagram_business_account{id,username}"}).get("data", [])
    for pg in pages:
        acc = pg.get("instagram_business_account")
        if acc and acc.get("id"):
            return {"id": acc["id"], "username": acc.get("username", "")}
    raise IGError("이 토큰으로는 인스타 계정을 찾지 못했어요. 인스타 계정을 페이스북 페이지에 연결하고, 토큰을 만들 때 그 페이지와 instagram_basic, "
                  "instagram_content_publish, pages_show_list 권한을 허용해 주세요. (또는 INSTAGRAM_USER_ID를 직접 넣어 주세요)")


def status():
    if not enabled():
        return {"enabled": False}
    try:
        m = me()
        return {"enabled": True, "username": m["username"], "pin": pin_required(), "publicOk": bool(public_base())}
    except IGError as e:
        return {"enabled": True, "error": str(e), "pin": pin_required(), "publicOk": bool(public_base())}


def save_photo(raw):
    """올린 사진을 인스타 규격(JPEG, 4:5~1.91:1, 긴 변 1440px)으로 바꿔 저장하고 파일 이름을 돌려준다."""
    from PIL import Image, ImageOps
    try:
        im = Image.open(io.BytesIO(raw))
        im = ImageOps.exif_transpose(im).convert("RGB")
    except Exception:
        raise IGError("사진 파일을 읽지 못했어요. JPG나 PNG 사진을 올려 주세요.")
    w, h = im.size
    r = w / h
    if r < 0.8:      # 너무 세로로 긴 사진 → 4:5로 가운데 자르기
        nh = int(w / 0.8)
        top = (h - nh) // 2
        im = im.crop((0, top, w, top + nh))
    elif r > 1.91:   # 너무 가로로 긴 사진
        nw = int(h * 1.91)
        left = (w - nw) // 2
        im = im.crop((left, 0, left + nw, h))
    im.thumbnail((1440, 1440))
    os.makedirs(MEDIA_DIR, exist_ok=True)
    name = uuid.uuid4().hex + ".jpg"
    im.save(os.path.join(MEDIA_DIR, name), "JPEG", quality=88)
    return name


def publish(photo_file, caption):
    """사진 1장 + 문구를 인스타그램에 올리고 {id, url}을 돌려준다."""
    if not enabled():
        raise IGError("인스타그램이 연결되지 않았어요.")
    base = public_base()
    if not base or "127.0.0.1" in base or "localhost" in base:
        raise IGError("인스타그램은 사진을 공개 주소로 가져가요. Render에 올린 사이트에서 다시 시도해 주세요.")
    if not photo_file:
        raise IGError("인스타그램은 사진이 꼭 있어야 올릴 수 있어요. 사진을 먼저 넣어 주세요.")
    if len(caption) > 2200:
        raise IGError("인스타그램 문구는 2,200자까지예요.")
    uid = me()["id"]
    image_url = f"{base}/media/{photo_file}"
    cid = _call("POST", f"{uid}/media", {"image_url": image_url, "caption": caption}).get("id")
    if not cid:
        raise IGError("인스타그램이 게시물을 준비하지 못했어요.")
    for i in range(20):  # 사진 처리 대기
        st = _call("GET", cid, {"fields": "status_code"}).get("status_code")
        if st in (None, "FINISHED", "PUBLISHED"):
            break
        if st in ("ERROR", "EXPIRED"):
            raise IGError("인스타그램이 사진을 처리하지 못했어요. 다른 사진으로 다시 시도해 주세요.")
        time.sleep(1 if i < 3 else 2)
    mid = _call("POST", f"{uid}/media_publish", {"creation_id": cid}).get("id")
    url = ""
    try:
        url = _call("GET", mid, {"fields": "permalink"}).get("permalink", "")
    except IGError:
        pass
    return {"id": mid, "url": url}
