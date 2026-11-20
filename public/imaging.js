// 사진 처리 (브라우저에서 바로, 무료): 인스타 규격 변환, 자동 보정, 홍보 카드 만들기
(function () {
  const MAX = 1440;

  async function toBitmap(src) {
    if (src instanceof HTMLCanvasElement || src instanceof ImageBitmap) return src;
    if (typeof src === 'string') src = await (await fetch(src)).blob();
    return createImageBitmap(src);
  }

  // 세로 4:5 ~ 가로 1.91:1 범위로 가운데 자르고 긴 변 1440px로
  async function fitInsta(src) {
    const img = await toBitmap(src);
    let sw = img.width, sh = img.height, sx = 0, sy = 0;
    const r = sw / sh;
    if (r < 0.8) { const nh = sw / 0.8; sy = (sh - nh) / 2; sh = nh; }
    else if (r > 1.91) { const nw = sh * 1.91; sx = (sw - nw) / 2; sw = nw; }
    const scale = Math.min(1, MAX / Math.max(sw, sh));
    const c = document.createElement('canvas');
    c.width = Math.round(sw * scale);
    c.height = Math.round(sh * scale);
    c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c;
  }

  const PRESETS = {
    auto: { label: '자동 보정', gamma: 1, sat: 1.12, warm: 0, sharpen: 0.25 },
    bright: { label: '밝게', gamma: 0.82, sat: 1.08, warm: 0, sharpen: 0.15 },
    warm: { label: '따뜻하게', gamma: 0.92, sat: 1.18, warm: 0.06, sharpen: 0.2 },
    vivid: { label: '선명하게', gamma: 0.96, sat: 1.25, warm: 0, sharpen: 0.6 },
  };

  // 밝기 범위 자동 맞춤(레벨) + 감마 + 채도 + 색온도 + 선명도
  async function enhance(src, presetKey = 'auto') {
    const p = PRESETS[presetKey] || PRESETS.auto;
    const c = await fitInsta(src);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const im = ctx.getImageData(0, 0, c.width, c.height);
    const d = im.data;
    const n = d.length / 4;

    const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) hist[(d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8]++;
    let lo = 0, hi = 255, acc = 0;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > n * 0.005) { lo = v; break; } }
    acc = 0;
    for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > n * 0.005) { hi = v; break; } }
    if (hi - lo < 40) { lo = Math.max(0, lo - 20); hi = Math.min(255, hi + 20); }

    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) {
      const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
      lut[v] = Math.round(Math.pow(t, p.gamma) * 255);
    }
    for (let i = 0; i < d.length; i += 4) {
      let r = lut[d[i]], g = lut[d[i + 1]], b = lut[d[i + 2]];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      r = l + (r - l) * p.sat;
      g = l + (g - l) * p.sat;
      b = l + (b - l) * p.sat;
      if (p.warm) { r *= 1 + p.warm; b *= 1 - p.warm; }
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }

    if (p.sharpen > 0) {
      const w = c.width, h = c.height;
      const src2 = new Uint8ClampedArray(d);
      const a = p.sharpen;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = (y * w + x) * 4;
          for (let k = 0; k < 3; k++) {
            const v = 5 * src2[i + k] - src2[i - 4 + k] - src2[i + 4 + k] - src2[i - w * 4 + k] - src2[i + w * 4 + k];
            d[i + k] = src2[i + k] + (v - src2[i + k]) * a;
          }
        }
      }
    }
    ctx.putImageData(im, 0, 0);
    return c;
  }

  // ---------- 홍보 카드 ----------
  const FONT = "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";
  const TEMPLATES = {
    bottom: '사진 + 아래 글',
    frame: '포스터형',
    text: '글자만',
    magazine: '매거진 표지',
    shapes: '문구·도형',
    doodle: '드로잉',
    sparkle: '반짝 하이라이트',
    sticker: '스티커 콜라주',
  };
  // 새 게시물에서 고르는 스타일 (slide는 2장짜리라 카드 만들기 창에는 없음)
  const STYLES = [
    { id: 'magazine', icon: '📰', name: '매거진 표지', desc: '카테고리 태그 + 굵은 2줄 제목, 하단 그라데이션·로고' },
    { id: 'shapes', icon: '⭐', name: '문구·도형', desc: '굵은 문구와 포인트 컬러 별 도형' },
    { id: 'doodle', icon: '✏️', name: '드로잉', desc: '손으로 그린 듯한 선과 낙서' },
    { id: 'sparkle', icon: '✨', name: '반짝 하이라이트', desc: '사진 속 밝은 곳에 반짝이 효과' },
    { id: 'sticker', icon: '🧸', name: '스티커 콜라주', desc: '이모지 스티커와 말풍선을 겹쳐 배치' },
    { id: 'slide', icon: '🎞', name: '슬라이드 피드', desc: '옆으로 넘기면 이어지는 2장짜리 피드' },
    { id: 'bottom', icon: '🖼', name: '기본', desc: '사진 아래에 제목과 가게 이름' },
  ];

  function wrapText(ctx, text, maxW) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width <= maxW) { line = t; continue; }
      if (line) lines.push(line);
      // 한 단어가 너무 길면 글자 단위로 자르기
      if (ctx.measureText(w).width > maxW) {
        let part = '';
        for (const ch of w) {
          if (ctx.measureText(part + ch).width > maxW) { lines.push(part); part = ch; } else part += ch;
        }
        line = part;
      } else line = w;
    }
    if (line) lines.push(line);
    return lines;
  }

  function cover(ctx, img, x, y, w, h) {
    const r = Math.max(w / img.width, h / img.height);
    const sw = w / r, sh = h / r;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- 스타일 편집 효과 (참고: 인스타 '피드 사꾸' 스타일) ----------
  // 같은 문구면 같은 배치가 나오도록 고정 난수
  function seeded(text) {
    let h = 2166136261;
    for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  function bottomShade(ctx, W, H, from = 0.45, alpha = 0.75) {
    const g = ctx.createLinearGradient(0, H * from, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, H * from, W, H * (1 - from));
  }

  // 검은 박스 제목 + 흰 설명 (예: "❶ 문구, 도형 넣기")
  function blackLabel(ctx, W, H, title, sub, { dark = false } = {}) {
    const x = 64;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `600 40px ${FONT}`;
    const sl = sub ? wrapText(ctx, sub, W - 140).slice(0, 2) : [];
    let y = H - 70 - (sl.length - 1) * 56;
    ctx.font = `800 64px ${FONT}`;
    const tl = wrapText(ctx, title, W - 180).slice(0, 2);
    const boxH = 92 + (tl.length - 1) * 76;
    const boxW = Math.max(...tl.map((l) => ctx.measureText(l).width)) + 56;
    const boxY = y - (sl.length ? 70 : 0) - boxH;
    ctx.fillStyle = '#111';
    ctx.fillRect(x, boxY, boxW, boxH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 6, boxY + 6, boxW - 12, boxH - 12);
    ctx.fillStyle = '#fff';
    tl.forEach((l, i) => ctx.fillText(l, x + 28, boxY + 68 + i * 76));
    ctx.font = `600 40px ${FONT}`;
    ctx.fillStyle = dark ? '#222' : '#fff';
    if (!dark) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10; }
    sl.forEach((l, i) => ctx.fillText(l, x, y + i * 56));
    ctx.shadowBlur = 0;
  }

  function star(ctx, x, y, r, points = 5, inner = 0.45) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const rad = i % 2 ? r * inner : r;
      const a = (Math.PI * i) / points - Math.PI / 2;
      ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath();
  }

  // 사진에서 가장 밝은 지점들 (반짝이 위치)
  function brightSpots(img, W, H, n) {
    const gw = 27, gh = 34;
    const c = document.createElement('canvas');
    c.width = gw; c.height = gh;
    const g = c.getContext('2d');
    cover(g, img, 0, 0, gw, gh);
    const d = g.getImageData(0, 0, gw, gh).data;
    const cells = [];
    const lum = (x, y) => { const i = (y * gw + x) * 4; return d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; };
    // 주변보다 밝은 곳(물건의 하이라이트)을 고름. 하얀 배경처럼 고르게 밝은 곳은 제외
    for (let y = 2; y < gh - 6; y++) for (let x = 1; x < gw - 1; x++) {
      const around = (lum(x - 1, y) + lum(x + 1, y) + lum(x, y - 1) + lum(x, y + 1)) / 4;
      cells.push({ x, y, l: (lum(x, y) - around) * 2 + lum(x, y) * 0.2 });
    }
    cells.sort((a, b) => b.l - a.l);
    const out = [];
    for (const p of cells) {
      if (out.length >= n) break;
      if (out.some((q) => Math.abs(q.x - p.x) < 4 && Math.abs(q.y - p.y) < 4)) continue;
      out.push(p);
    }
    return out.map((p) => ({ x: (p.x + 0.5) * (W / gw), y: (p.y + 0.5) * (H / gh) }));
  }

  function glint(ctx, x, y, r) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.4);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(120,170,255,0.9)'; ctx.shadowBlur = 14; // 밝은 배경에서도 보이게
    star(ctx, x, y, r, 4, 0.12); ctx.fill();
    star(ctx, x, y, r * 0.5, 4, 0.15);
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.translate(-x, -y); ctx.fill(); ctx.restore();
    ctx.shadowBlur = 0;
  }

  const STICKERS = [
    [/카페|커피|디저트/, ['☕', '🍰', '🥐', '💛']],
    [/베이커리|빵/, ['🥐', '🍞', '🥖', '🧈']],
    [/치킨|음식|식당|분식|고기|맛집/, ['🍗', '😋', '🍜', '🔥']],
    [/PC|게임/i, ['🎮', '🕹️', '⚡', '🏆']],
    [/미용|헤어/, ['💇', '✂️', '💖', '✨']],
    [/네일/, ['💅', '💖', '✨', '🎀']],
    [/꽃/, ['💐', '🌷', '🌸', '🦋']],
  ];
  const stickersFor = (cat) => (STICKERS.find(([re]) => re.test(cat || '')) || [0, ['✨', '💛', '📍', '👍']])[1];

  const STYLE_DRAW = {
    // 매거진 표지: 카테고리 태그 + 굵은 흰 2줄 제목 + 하단 그라데이션 + 우측 하단 로고
    magazine({ ctx, W, H, img, headline, subline, storeName, tag }) {
      cover(ctx, img, 0, 0, W, H);
      bottomShade(ctx, W, H, 0.42, 0.8);
      ctx.textAlign = 'left';
      ctx.font = `800 92px ${FONT}`;
      const hl = wrapText(ctx, headline, W - 150).slice(0, 2);
      let y = H - 150 - (hl.length - 1) * 112;
      const t = tag || subline;
      if (t) {
        ctx.font = `700 40px ${FONT}`;
        const tw = ctx.measureText(t).width;
        ctx.fillStyle = '#fff';
        ctx.fillRect(64, y - 160, tw + 36, 62);
        ctx.fillStyle = '#111';
        ctx.fillText(t, 82, y - 115);
      }
      ctx.font = `800 92px ${FONT}`;
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 12;
      for (const l of hl) { ctx.fillText(l, 64, y); y += 112; }
      ctx.shadowBlur = 0;
      ctx.textAlign = 'right';
      ctx.font = `800 38px ${FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillText(storeName, W - 64, H - 64);
    },
    // 문구·도형: 포인트 컬러(핑크·민트) 별과 굵은 문구
    shapes({ ctx, W, H, img, headline, subline, storeName }) {
      cover(ctx, img, 0, 0, W, H);
      const rnd = seeded(headline + storeName);
      const PINK = '#ff3d7f', MINT = '#20c997';
      const label = (text, x, y, color, size, shape) => {
        ctx.font = `800 ${size}px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.strokeText(text, x + size * 0.9, y);
        ctx.fillStyle = color;
        ctx.fillText(text, x + size * 0.9, y);
        if (shape === 'dot') { ctx.beginPath(); ctx.arc(x + size * 0.35, y - size * 0.33, size * 0.32, 0, Math.PI * 2); ctx.fill(); }
        else { star(ctx, x + size * 0.38, y - size * 0.36, size * 0.48); ctx.fill(); }
      };
      label(`@${storeName.replace(/\s+/g, '').toLowerCase()}`, W * 0.08, H * 0.16, PINK, 54);
      ctx.font = `800 80px ${FONT}`;
      const hl = wrapText(ctx, headline, W * 0.7).slice(0, 2);
      hl.forEach((l, i) => label(l, W * 0.06, H * 0.72 + i * 96, i ? MINT : PINK, 80, i ? 'dot' : 'star'));
      if (subline) label(subline, W * 0.38, H * 0.9, MINT, 46, 'dot');
      for (let i = 0; i < 5; i++) {
        const x = W * (0.12 + rnd() * 0.76), y = H * (0.25 + rnd() * 0.38), r = 30 + rnd() * 34;
        ctx.fillStyle = i % 2 ? MINT : PINK;
        star(ctx, x, y, r); ctx.fill();
        if (i % 2 === 0) { ctx.fillStyle = MINT; star(ctx, x, y, r * 0.5); ctx.fill(); }
      }
    },
    // 드로잉: 노란 손그림 선 (반짝 선, 회오리, 구불구불한 선, 하트)
    doodle({ ctx, W, H, img, headline, subline }) {
      cover(ctx, img, 0, 0, W, H);
      bottomShade(ctx, W, H, 0.6, 0.6);
      const rnd = seeded(headline);
      ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const burst = (cx, cy, r) => {
        for (let i = 0; i < 4; i++) {
          const a = -Math.PI * 0.85 + i * 0.45;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          ctx.lineTo(cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 1.6);
          ctx.stroke();
        }
      };
      burst(W * 0.78, H * 0.12, 50);
      burst(W * 0.2, H * 0.2, 40);
      // 회오리
      ctx.beginPath();
      for (let t = 0; t < Math.PI * 5; t += 0.2) {
        const r = 6 + t * 7;
        ctx.lineTo(W * 0.14 + Math.cos(t) * r, H * 0.42 + Math.sin(t) * r * 0.8);
      }
      ctx.stroke();
      // 구불구불한 선
      ctx.beginPath();
      ctx.moveTo(W * 0.62, H * 0.08);
      for (let i = 1; i <= 6; i++) {
        ctx.quadraticCurveTo(W * (0.55 + rnd() * 0.3), H * (0.08 + i * 0.07 - 0.03), W * (0.6 + rnd() * 0.2), H * (0.08 + i * 0.07));
      }
      ctx.stroke();
      // 하트
      const hx = W * 0.84, hy = H * 0.5, s = 46;
      ctx.beginPath();
      ctx.moveTo(hx, hy + s * 0.9);
      ctx.bezierCurveTo(hx - s * 1.6, hy - s * 0.2, hx - s * 0.6, hy - s * 1.2, hx, hy - s * 0.3);
      ctx.bezierCurveTo(hx + s * 0.6, hy - s * 1.2, hx + s * 1.6, hy - s * 0.2, hx, hy + s * 0.9);
      ctx.stroke();
      blackLabel(ctx, W, H, headline, subline);
    },
    // 반짝 하이라이트: 사진 속 밝은 곳에 반짝이
    sparkle({ ctx, W, H, img, headline, subline }) {
      ctx.filter = 'brightness(1.05) contrast(1.06) saturate(1.1)';
      cover(ctx, img, 0, 0, W, H);
      ctx.filter = 'none';
      bottomShade(ctx, W, H, 0.6, 0.6);
      const rnd = seeded(headline);
      brightSpots(img, W, H, 7).forEach((p, i) => glint(ctx, p.x, p.y, 34 + (i % 3) * 14 + rnd() * 10));
      blackLabel(ctx, W, H, headline, subline);
    },
    // 스티커 콜라주: 업종에 맞는 이모지 스티커 + 말풍선
    sticker({ ctx, W, H, img, headline, subline, category }) {
      cover(ctx, img, 0, 0, W, H);
      bottomShade(ctx, W, H, 0.6, 0.6);
      const rnd = seeded(headline + category);
      const spots = [[0.14, 0.14], [0.84, 0.2], [0.1, 0.55], [0.86, 0.6], [0.5, 0.08]];
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      stickersFor(category).concat('✨').forEach((e, i) => {
        const [sx, sy] = spots[i % spots.length];
        const size = 130 + rnd() * 70;
        ctx.save();
        ctx.translate(W * sx, H * sy);
        ctx.rotate((rnd() - 0.5) * 0.6);
        ctx.font = `${size}px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
        ctx.fillText(e, 0, 0);
        ctx.restore();
      });
      if (subline) {
        ctx.font = `800 46px ${FONT}`;
        const tw = Math.min(ctx.measureText(subline).width, W * 0.6);
        const bx = W * 0.5 - tw / 2 - 34, by = H * 0.3;
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 16;
        roundRect(ctx, bx, by, tw + 68, 96, 48); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx + 60, by + 90); ctx.lineTo(bx + 40, by + 140); ctx.lineTo(bx + 110, by + 92); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#111';
        ctx.fillText(subline, W * 0.5, by + 50, W * 0.6);
      }
      ctx.textBaseline = 'alphabetic';
      blackLabel(ctx, W, H, headline, '');
    },
  };

  // 슬라이드 피드: 2160x1350 한 장에 사진을 걸쳐 배치하고 반으로 잘라 2장으로
  async function makeSlides({ photos, headline, subline }) {
    const imgs = await Promise.all(photos.slice(0, 3).map(toBitmap));
    const W = 2160, H = 1350;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    // 사진이 1~2장이면 첫 사진의 일부를 확대해서 채움
    const crop = (img, zx, zy, z) => {
      const k = document.createElement('canvas');
      k.width = img.width / z; k.height = img.height / z;
      k.getContext('2d').drawImage(img, img.width * zx, img.height * zy, k.width, k.height, 0, 0, k.width, k.height);
      return k;
    };
    const p = [imgs[0], imgs[1] || crop(imgs[0], 0.3, 0.25, 2.2), imgs[2] || crop(imgs[0], 0.15, 0.45, 1.8)];
    const boxes = [[120, 250, 780, 1000], [700, 110, 640, 460], [1300, 420, 700, 830]];
    boxes.forEach(([x, y, w, h], i) => {
      ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
      ctx.fillRect(x, y, w, h);
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      cover(ctx, p[i], x, y, w, h);
    });
    const left = document.createElement('canvas');
    left.width = 1080; left.height = H;
    const lctx = left.getContext('2d');
    lctx.drawImage(c, 0, 0, 1080, H, 0, 0, 1080, H);
    blackLabel(lctx, 1080, H, headline, subline, { dark: true });
    const right = document.createElement('canvas');
    right.width = 1080; right.height = H;
    right.getContext('2d').drawImage(c, 1080, 0, 1080, H, 0, 0, 1080, H);
    return [left, right];
  }

  async function makeCard({ photo, headline, subline, storeName, template = 'bottom', color = '#e8590c', tag = '', category = '' }) {
    const W = 1080, H = 1350;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const img = photo ? await toBitmap(photo) : null;
    if (!img) template = 'text';

    const drawTexts = (x, yBottom, maxW, align, colorMain, colorSub) => {
      ctx.textAlign = align;
      ctx.textBaseline = 'alphabetic';
      ctx.font = `800 96px ${FONT}`;
      const hl = wrapText(ctx, headline, maxW).slice(0, 3);
      ctx.font = `600 46px ${FONT}`;
      const sl = subline ? wrapText(ctx, subline, maxW).slice(0, 2) : [];
      let y = yBottom - sl.length * 62 - (sl.length ? 20 : 0) - (hl.length - 1) * 112;
      ctx.fillStyle = colorMain;
      ctx.font = `800 96px ${FONT}`;
      for (const l of hl) { ctx.fillText(l, x, y); y += 112; }
      y += sl.length ? 6 : 0;
      ctx.fillStyle = colorSub;
      ctx.font = `600 46px ${FONT}`;
      for (const l of sl) { ctx.fillText(l, x, y); y += 62; }
    };

    if (template === 'bottom') {
      cover(ctx, img, 0, 0, W, H);
      const g = ctx.createLinearGradient(0, H * 0.45, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.78)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      drawTexts(72, H - 150, W - 144, 'left', '#ffffff', 'rgba(255,255,255,0.9)');
      ctx.fillStyle = color;
      ctx.font = `700 36px ${FONT}`;
      const tw = ctx.measureText(storeName).width;
      roundRect(ctx, 72, H - 112, tw + 56, 64, 32);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(storeName, 100, H - 68);
    } else if (template === 'frame') {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      roundRect(ctx, 60, 60, W - 120, 860, 36);
      ctx.clip();
      cover(ctx, img, 60, 60, W - 120, 860);
      ctx.restore();
      drawTexts(W / 2, H - 150, W - 160, 'center', '#ffffff', 'rgba(255,255,255,0.92)');
      ctx.font = `700 36px ${FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'center';
      ctx.fillText(storeName, W / 2, H - 70);
    } else if (STYLE_DRAW[template]) {
      STYLE_DRAW[template]({ ctx, W, H, img, headline, subline, storeName, tag, category });
    } else {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#fff4e6');
      g.addColorStop(1, '#ffd8a8');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, W, 24);
      drawTexts(W / 2, H / 2 + 120, W - 180, 'center', '#1d1d1b', '#5c5a55');
      ctx.font = `800 40px ${FONT}`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(storeName, W / 2, H - 110);
    }
    return c;
  }

  const toJpeg = (canvas, q = 0.9) => new Promise((res) => canvas.toBlob(res, 'image/jpeg', q));

  window.Imaging = { fitInsta, enhance, makeCard, makeSlides, toJpeg, PRESETS, TEMPLATES, STYLES };
})();
