// LLM 프롬프트 모음. AI 결과 형식(JSON)을 여기서 정의한다.

function storeToText(store) {
  const products = (store.products || [])
    .filter((p) => p && p.name)
    .map((p) => `- ${p.name}${p.price ? ` (${p.price})` : ''}`)
    .join('\n') || '- (입력 없음)';
  return [
    `가게 이름: ${store.name || '(입력 없음)'}`,
    `업종: ${store.category}`,
    `주소: ${store.address}`,
    `상품·서비스 (참고용):\n${products}`,
    `가게 홍보 목표: ${store.goal || '(입력 없음)'}`,
    `기타 정보: ${store.etc || '(입력 없음)'}`,
  ].join('\n');
}

function pastPostsText(posts) {
  const list = posts.filter((p) => p.topic).slice(0, 5);
  if (!list.length) return '(아직 없음)';
  return list
    .map((p) => {
      const done = Object.entries(p.publications || {}).filter(([, v]) => v.status === 'published').map(([k]) => k);
      return `- ${p.createdAt.slice(0, 10)} "${p.topic}"${done.length ? ` → 게시: ${done.join(', ')}` : ' (임시저장)'}`;
    })
    .join('\n');
}

const POST_SYSTEM = `너는 마케팅 담당자가 없는 소상공인 사장님 대신 SNS 게시물을 만드는 도우미다.
사장님이 홍보하고 싶은 것과 참고 사진을 주면, 인스타그램·페이스북·스레드에 바로 올릴 문구와 홍보 카드 이미지용 짧은 문구를 만든다.

규칙:
1. 가게 정보, 사장님 요청, 참고 사진에 실제로 있는 내용만 쓴다. 정해지지 않은 가격·기간·혜택·수치는 지어내지 말고 [가격], [기간], [혜택 내용]처럼 대괄호 빈칸으로 남긴다.
2. 참고 사진이 있으면 사진에 보이는 것(메뉴, 분위기, 색감, 공간)을 자연스럽게 문구에 녹인다. 사진에 없는 것을 있다고 쓰지 않는다.
3. 사장님 말투로 1인칭("저희 가게")을 쓴다. 과장 광고 표현(최고, 1등, 무조건 등)을 쓰지 않는다.
4. 플랫폼별:
   - instagram: 3~7줄, 이모지 조금, 끝에 줄바꿈 두 번 뒤 해시태그 6~10개 (지역명·업종·상품명 포함)
   - facebook: 4~8줄, 정보 위주, 위치·영업 정보 포함, 해시태그 0~3개
   - threads: 2~4줄, 대화하듯 짧게, 전체 450자 이내, 해시태그는 최대 1개
5. headline은 홍보 카드 이미지에 크게 들어갈 제목(공백 포함 14자 이내), subline은 그 아래 작은 글(24자 이내).
6. tag는 카드 위쪽 작은 카테고리 태그(공백 포함 10자 이내, 예: "맛집 추천", "신메뉴 소개").
7. [카드 스타일]과 [편집 효과]에 맞춰 headline·subline의 말투와 내용을 정한다.
   cardOptions에는 서로 확실히 다른 카드 문구 후보 5개를 넣는다 (각도·말투·강조점을 다르게: 질문형, 감탄형, 혜택 강조, 상황 묘사, 짧은 한마디 등). 첫 번째 후보는 headline·subline·tag와 같게.
8. imagePrompt는 AI 이미지 생성 모델에 줄 영어 프롬프트. 글자(텍스트)가 들어가지 않는 사진풍 장면으로 묘사한다.

반드시 아래 JSON 형식으로만 답한다.
{
  "headline": "카드 큰 제목",
  "subline": "카드 작은 글",
  "tag": "카테고리 태그",
  "cardOptions": [ { "headline": "...", "subline": "...", "tag": "..." } ],
  "captions": {
    "instagram": "인스타그램 문구 전체 (해시태그 포함, 줄바꿈은 \\n)",
    "facebook": "페이스북 문구 전체",
    "threads": "스레드 문구 전체"
  },
  "checklist": ["올리기 전에 사장님이 확인할 것"],
  "imagePrompt": "English prompt for an image model"
}`;

// 홍보 카드 스타일(글자 배치)별 문구 요령 (참고: 인스타 '피드 사꾸' 스타일)
const STYLE_GUIDE = {
  magazine: '매거진 표지형: 위에 작은 카테고리 태그, 굵은 흰 글씨 2줄. headline은 친구에게 말 걸듯 짧은 구어체(예: "우리도 여기 갈래?", "다 알려주겠어!"). 클릭하고 싶게.',
  caption: '캡션 박스형: 검은 박스 안 제목 + 아래 설명. headline은 짧은 소제목, subline은 무엇을 보면 되는지 한 줄 설명.',
  bottom: '사진 + 아래 글: headline은 상품·혜택을 바로 알 수 있게, subline은 가격·기간 등 정보.',
  frame: '포스터형: 사진 아래 큰 제목. headline은 포스터 문구처럼 또렷하게, subline은 정보 한 줄.',
  slide: '옆으로 넘기는 슬라이드 피드: headline은 이어지는 이야기의 시작, subline은 다음 장이 궁금하게("넘겨 보세요" 느낌).',
};
// 편집 효과별 문구 분위기
const EFFECT_GUIDE = {
  none: '효과 없음: 깔끔하게.',
  shapes: '문구·도형(핑크·민트 별): 발랄하고 톡톡 튀게.',
  doodle: '손그림 드로잉: 귀엽고 가벼운 구어체.',
  sparkle: '반짝 하이라이트: 사진 속 상품을 콕 집어 자랑하듯.',
  sticker: '스티커 콜라주: 감탄사나 의성어를 섞어 신나게(예: "이거 진짜 맛있어!").',
};

function buildPostPrompt(store, input, refCount, pastPosts) {
  return {
    system: POST_SYSTEM,
    user: [
      `[가게 정보]\n${storeToText(store)}`,
      `[이번에 홍보할 것]\n${input.topic}`,
      `[강조하고 싶은 내용]\n${input.detail || '(없음)'}`,
      `[원하는 분위기]\n${input.tone || '친근하게'}`,
      `[카드 스타일]\n${STYLE_GUIDE[input.layout] || STYLE_GUIDE.magazine}`,
      `[편집 효과]\n${EFFECT_GUIDE[input.effect] || EFFECT_GUIDE.none}`,
      `[참고 사진]\n${refCount ? `${refCount}장 첨부 (아래 이미지)` : '없음'}`,
      `[최근 게시물]\n${pastPostsText(pastPosts)}`,
      '위 내용으로 게시물을 만들어 주세요. 최근 게시물과 문구가 너무 비슷하지 않게 해 주세요.',
    ].join('\n\n'),
  };
}

const IDEA_SYSTEM = `너는 소상공인 사장님에게 오늘 올릴 SNS 게시물 아이디어를 주는 도우미다.
가게 정보와 최근 게시물을 보고, 지금 올리기 좋은 아이디어 3개를 준다.
- 가게 정보에 있는 상품·서비스를 활용하고, 입력에 없는 행사·가격을 지어내지 않는다.
- 최근에 올린 주제는 피한다.
- 쉬운 말로 짧게.
반드시 아래 JSON 형식으로만 답한다.
{ "ideas": [ { "topic": "홍보할 것 (한 줄)", "detail": "강조할 내용 (한 줄)", "why": "추천 이유 (한 줄)" } ] }`;

function buildIdeasPrompt(store, pastPosts) {
  return {
    system: IDEA_SYSTEM,
    user: `[가게 정보]\n${storeToText(store)}\n\n[최근 게시물]\n${pastPostsText(pastPosts)}\n\n오늘 올릴 게시물 아이디어 3개를 주세요.`,
  };
}

// ---------- AI 피드백: 올린 게시물의 반응을 보고 다음 게시물 조언 ----------
const FEEDBACK_SYSTEM = `너는 소상공인 사장님의 SNS 담당 코치다. 사장님이 올린 게시물들의 반응(좋아요·답글)과 댓글 내용을 보고, 쉬운 말로 피드백을 준다.

규칙:
1. 숫자는 주어진 데이터에 있는 것만 쓴다. 지어내지 않는다. 게시물이 적으면(3개 미만) "아직 게시물이 적어 단정하긴 이르다"고 말한다.
2. styleInsights: 어떤 카드 스타일·편집 효과·분위기·주제가 반응이 좋았고 나빴는지, 점수를 근거로 2~4개.
3. positive(선플)와 negative(악플·불만·아쉬운 점)는 반드시 [댓글]에 있는 문장을 text에 그대로 옮긴다. 없으면 빈 배열. 질문·단순 태그는 넣지 않는다.
   negative에는 사장님이 달 수 있는 정중한 답글 예시(reply)를 함께 쓴다.
4. suggestions: 다음 게시물에 반영할 구체적인 행동 3~5개 (어떤 스타일·효과로, 어떤 주제를, 어떤 문구로, 언제 등).
5. 사장님을 탓하지 않고 다정하게. 과장하지 않는다.

반드시 아래 JSON 형식으로만 답한다.
{
  "summary": "전체 요약 2~3문장",
  "styleInsights": ["스타일·작업물 분석"],
  "positive": [ { "text": "댓글 원문", "why": "왜 좋은 반응인지 한 줄" } ],
  "negative": [ { "text": "댓글 원문", "why": "무엇이 불만인지 한 줄", "reply": "답글 예시" } ],
  "suggestions": ["다음 게시물에 반영할 것"]
}`;

function buildFeedbackPrompt(store, data) {
  const posts = data.posts.map((p, i) => `${i + 1}. "${p.topic}" (${p.at.slice(0, 10)}) 스타일: ${p.style} / 효과: ${p.effect} / 분위기: ${p.tone || '-'} / 올린 곳: ${p.platforms.join(', ')}
   좋아요 ${p.total.likes}, 답글 ${p.total.comments} → 반응 점수 ${p.score}`).join('\n');
  const styles = data.byStyle.map((s) => `- ${s.name}: 게시물 ${s.count}개, 평균 점수 ${s.avg}`).join('\n');
  const comments = data.comments.map((c) => `- [${c.platformName}] "${c.topic}"에 단 댓글${c.likes ? ` (좋아요 ${c.likes})` : ''}: ${c.text}`).join('\n') || '(댓글 없음)';
  return {
    system: FEEDBACK_SYSTEM,
    user: [
      `[가게 정보]\n${storeToText(store)}`,
      `[게시물별 반응] (반응 점수 = 좋아요 + 답글×2)\n${posts}`,
      `[스타일별 평균]\n${styles}`,
      `[댓글]\n${comments}`,
      '위 데이터로 피드백을 주세요.',
    ].join('\n\n'),
  };
}

module.exports = { storeToText, buildPostPrompt, buildIdeasPrompt, buildFeedbackPrompt };
