"""지역·시즌 맥락. 해커톤에서는 시연용 예시 데이터를 쓰고, 출처와 기준일을 항상 함께 보여준다.

실서비스에서는 공공데이터(상권 정보, 지역 축제·행사 일정 등)를 연결한다.
"""
import datetime as dt

DEMO = "시연용 예시 데이터"


def context(profile, today=None):
    today = today or dt.date.today()
    base = today.isoformat()
    region = profile.get("region", "")
    items = []
    if "경산" in region or "대학" in region or "대구" in region:
        items.append({"title": "인근 대학 기말고사 기간", "detail": "12월 둘째~셋째 주로 가정. 늦은 시간 공부·휴식 수요가 늘 수 있어요.",
                      "source": DEMO, "date": base, "tags": ["카페", "PC방", "음식점", "치킨·주점"]})
    if today.month in (11, 12):
        items.append({"title": "연말 모임 시즌", "detail": "12월 송년회·선물 수요가 늘어나는 시기예요.",
                      "source": "일반적인 시즌 정보", "date": base, "tags": ["음식점", "치킨·주점", "꽃집", "미용실", "카페"]})
    items.append({"title": "이번 주말 기온 하락", "detail": "따뜻한 메뉴와 실내 활동을 찾는 손님이 늘 수 있다고 가정했어요.",
                  "source": DEMO, "date": base, "tags": ["카페", "음식점", "PC방", "기타"]})
    kind = profile.get("kind", "기타")
    return [i for i in items if kind in i["tags"] or "기타" in i["tags"]] or items[:1]
