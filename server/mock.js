// API 키가 없거나 AI 호출이 실패할 때 쓰는 규칙 기반 데모 결과.
// 실제 AI 결과와 같은 JSON 형식을 돌려준다.

const tag = (s) => `#${String(s || '').replace(/[^\p{L}\p{N}]/gu, '')}`;

function findProduct(store, topic) {
  return (store.products || []).find((p) => p.name && topic.includes(p.name)) || null;
}

function mockPost(store, input) {
  const name = store.name || '저희 가게';
  const p = findProduct(store, input.topic);
  const price = p?.price || '[가격]';
  const town = (store.address || '').split(' ')[1] || '우리동네';
  const event = /이벤트|할인|행사/.test(`${input.tone} ${input.detail}`);
  const detail = input.detail ? `${input.detail}\n` : '';

  const instagram = [
    `안녕하세요, ${name}입니다 😊`,
    `${input.topic} 소개해 드릴게요!`,
    detail.trim(),
    p ? `💰 ${price}` : '',
    event ? '🎁 [혜택 내용] · 기간: [기간]' : '',
    `📍 ${store.address}`,
    '',
    [tag(town), tag(store.category), tag(name), tag(p?.name || input.topic.split(' ')[0]), '#동네가게', '#소상공인', `${tag(town)}${(store.category || '').replace(/\s/g, '')}`].join(' '),
  ].filter((l) => l !== undefined && l !== null).join('\n').replace(/\n{3,}/g, '\n\n');

  const facebook = [
    `[${name}] ${input.topic}`,
    '',
    detail.trim() || `${name}의 ${input.topic}을(를) 알려드립니다.`,
    p ? `- 가격: ${price}` : '',
    `- 위치: ${store.address}`,
    store.etc ? `- 안내: ${store.etc}` : '',
    '',
    '많은 관심 부탁드립니다.',
  ].filter(Boolean).join('\n');

  const threads = `${name}에서 ${input.topic} 준비했어요 ✨\n${input.detail || '근처 오시면 한번 들러 주세요!'}\n${tag(town + (store.category || ''))}`.slice(0, 450);

  return {
    headline: (p?.name || input.topic).slice(0, 14),
    subline: (event ? '이번 주 [혜택 내용]' : p?.price ? price : name).slice(0, 24),
    tag: `${store.category || '우리 동네'} 추천`.slice(0, 12),
    cardOptions: [
      { headline: (p?.name || input.topic).slice(0, 14), subline: (p?.price ? price : name).slice(0, 24), tag: '신상 소개' },
      { headline: '우리도 여기 갈래?', subline: `${input.topic}`.slice(0, 24), tag: `${town} 추천`.slice(0, 12) },
      { headline: '이건 꼭 봐야 해!', subline: (input.detail || `${name}의 ${input.topic}`).slice(0, 24), tag: '오늘의 추천' },
      { headline: event ? '이번 주만 이 혜택' : '요즘 제일 인기', subline: event ? '[혜택 내용]' : `${name}에서 만나요`.slice(0, 24), tag: event ? '이벤트' : '인기 메뉴' },
      { headline: '다 알려줄게!', subline: `${input.topic} 총정리`.slice(0, 24), tag: '꿀팁' },
    ],
    captions: { instagram, facebook, threads },
    checklist: ['[대괄호] 빈칸을 실제 내용으로 바꾸기', '가격·기간이 정확한지 확인하기'],
    imagePrompt: `A warm, inviting photo for a small local ${store.category} shop, featuring ${input.topic}, natural light, Korean neighborhood, no text`,
  };
}

function mockIdeas(store, pastPosts) {
  const used = new Set(pastPosts.map((p) => p.topic));
  const products = (store.products || []).filter((p) => p.name);
  const ideas = [];
  for (const p of products) {
    if (ideas.length >= 2) break;
    if ([...used].some((t) => t.includes(p.name))) continue;
    ideas.push({ topic: p.name, detail: p.price ? `가격 ${p.price}` : '', why: '등록하신 상품 중 아직 소개하지 않은 상품이에요.' });
  }
  ideas.push({ topic: '가게 분위기·내부 사진 소개', detail: store.etc || '', why: '처음 오는 손님이 가게를 미리 보고 올 수 있어요.' });
  if (ideas.length < 3) ideas.push({ topic: '방문 후기 부탁 이벤트', detail: '후기 남기면 [혜택 내용]', why: '후기가 쌓이면 검색했을 때 믿음이 생겨요.' });
  return { ideas: ideas.slice(0, 3) };
}

// AI 없이 만드는 피드백: 점수로 스타일 비교 + 낱말로 선플/악플 구분
const GOOD = /좋|맛있|최고|예쁘|이쁘|감사|추천|대박|편해|편하|또 ?갈|또 ?올|친절|깔끔|사랑|굿|👍|❤|😍|🥰|good|love|nice/i;
const BAD = /별로|비싸|불친절|실망|최악|맛없|더럽|불편|느려|늦|짜증|환불|싫|아쉽|그닥|👎|bad|worst/i;
function mockFeedback(store, data) {
  const negative = data.comments.filter((c) => BAD.test(c.text)).slice(0, 5)
    .map((c) => ({ text: c.text, why: '불만이나 아쉬움이 담긴 댓글이에요.', reply: '소중한 의견 감사합니다. 말씀해 주신 부분 꼭 개선할게요. 다음에 방문해 주시면 더 좋은 모습 보여 드릴게요!' }));
  const positive = data.comments.filter((c) => GOOD.test(c.text) && !BAD.test(c.text)).slice(0, 5)
    .map((c) => ({ text: c.text, why: '가게나 상품을 좋게 말해 준 댓글이에요.' }));
  const best = data.byStyle[0];
  const worst = data.byStyle.length > 1 ? data.byStyle[data.byStyle.length - 1] : null;
  const top = data.posts[0];
  const few = data.posts.length < 3 ? ' 아직 게시물이 적어서 단정하긴 일러요.' : '';
  return {
    summary: data.posts.length
      ? `게시물 ${data.posts.length}개, 댓글 ${data.comments.length}개를 살펴봤어요. 가장 반응이 좋았던 건 "${top.topic}"(점수 ${top.score})이에요.${few}`
      : '아직 SNS에 올라간 게시물이 없어요. 게시물을 올리고 반응이 쌓이면 다시 눌러 보세요.',
    styleInsights: [
      best ? `${best.name} 스타일의 평균 점수가 ${best.avg}로 가장 높았어요.` : '',
      worst && worst.avg < best.avg ? `${worst.name} 스타일은 평균 ${worst.avg}로 상대적으로 반응이 적었어요.` : '',
    ].filter(Boolean),
    positive,
    negative,
    suggestions: [
      best ? `다음 게시물도 ${best.name} 스타일로 만들어 보세요.` : '',
      top ? `"${top.topic}"처럼 반응이 좋았던 주제를 다른 각도로 한 번 더 소개해 보세요.` : '',
      negative.length ? '불만 댓글에는 하루 안에 정중하게 답글을 달아 주세요.' : '',
      '문구 끝에 "댓글로 알려 주세요"처럼 질문을 넣으면 댓글이 늘어나요.',
    ].filter(Boolean),
  };
}

// AI 없이 만드는 게시물 하나 피드백
function mockPostFeedback(store, data) {
  const p = data.post;
  const plats = Object.entries(p.byPlatform).sort((a, b) => (b[1].likes + b[1].comments * 2) - (a[1].likes + a[1].comments * 2));
  const negative = data.comments.filter((c) => BAD.test(c.text)).slice(0, 5)
    .map((c) => ({ text: c.text, why: '불만이나 아쉬움이 담긴 댓글이에요.', reply: '소중한 의견 감사합니다. 말씀해 주신 부분 꼭 개선할게요!' }));
  const positive = data.comments.filter((c) => GOOD.test(c.text) && !BAD.test(c.text)).slice(0, 5)
    .map((c) => ({ text: c.text, why: '가게나 상품을 좋게 말해 준 댓글이에요.' }));
  return {
    summary: `"${p.topic}" 게시물은 좋아요 ${p.total.likes}개, 답글 ${p.total.comments}개로 ${data.verdict === '첫 게시물' ? '아직 비교할 다른 게시물이 없어요' : data.verdict}${data.totalPosts > 1 ? ` (가게 게시물 ${data.totalPosts}개 중 ${data.rank}위)` : ''}.`,
    good: [plats[0] ? `${plats[0][0]}에서 반응이 가장 좋았어요 (좋아요 ${plats[0][1].likes}, 답글 ${plats[0][1].comments}).` : '', positive.length ? `칭찬 댓글이 ${positive.length}개 있어요.` : ''].filter(Boolean),
    improve: [p.total.comments === 0 ? '답글이 없었어요. 문구 끝에 질문을 넣어 대화를 유도해 보세요.' : '', negative.length ? `불만 댓글 ${negative.length}개에 답글을 달아 주세요.` : '', plats.length > 1 ? `${plats[plats.length - 1][0]} 반응이 상대적으로 적었어요.` : ''].filter(Boolean),
    positive,
    negative,
    nextTime: [`다음에도 ${p.style} 스타일을 쓰되 편집 효과를 바꿔 비교해 보세요.`, '올리는 시간대를 바꿔 반응을 비교해 보세요.'],
  };
}

module.exports = { mockPost, mockIdeas, mockFeedback, mockPostFeedback };
