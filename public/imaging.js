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
  // 스타일(글자 배치)과 편집 효과. 슬라이드는 2장짜리라 카드 만들기 창에는 없음
  const LAYOUT_NAMES = { magazine: '매거진 표지', caption: '캡션 박스', bottom: '사진 + 아래 글', frame: '포스터형', slide: '슬라이드 피드' };
  const EFFECT_NAMES = { none: '효과 없음', shapes: '문구·도형', doodle: '드로잉', sparkle: '반짝 하이라이트', sticker: '스티커 콜라주' };
  const TEMPLATES = { magazine: '매거진 표지', caption: '캡션 박스', bottom: '사진 + 아래 글', frame: '포스터형', text: '글자만' };

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

  // ---------- 스타일(글자 배치) × 편집 효과 ----------
  // 글자 그리기 (기본·포스터형에서 사용)
  function drawTexts(ctx, headline, subline, x, yBottom, maxW, align, colorMain, colorSub) {
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
  }

  // 스타일: photo()는 사진을 그리고 사진 영역 [x, y, w, h]를 돌려줌, text()는 그 위에 글자
  const LAYOUTS = {
    // 매거진 표지: 카테고리 태그 + 굵은 흰 2줄 제목 + 하단 그라데이션 + 우측 하단 로고
    magazine: {
      photo({ ctx, W, H, img }) { cover(ctx, img, 0, 0, W, H); bottomShade(ctx, W, H, 0.42, 0.8); return [0, 0, W, H]; },
      text({ ctx, W, H, headline, subline, tag, storeName }) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = `800 92px ${FONT}`;
        const hl = wrapText(ctx, headline, W - 150).slice(0, 2);
        let y = H - 150 - (hl.length - 1) * 112;
        const t = tag || subline;
        if (t) {
          ctx.font = `700 40px ${FONT}`;
          ctx.fillStyle = '#fff';
          ctx.fillRect(64, y - 160, ctx.measureText(t).width + 36, 62);
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
    },
    // 캡션 박스: 검은 박스 제목 + 흰 설명 (예: "❶ 문구, 도형 넣기")
    caption: {
      photo({ ctx, W, H, img }) { cover(ctx, img, 0, 0, W, H); bottomShade(ctx, W, H, 0.6, 0.6); return [0, 0, W, H]; },
      text({ ctx, W, H, headline, subline }) { blackLabel(ctx, W, H, headline, subline); },
    },
    bottom: {
      photo({ ctx, W, H, img }) { cover(ctx, img, 0, 0, W, H); bottomShade(ctx, W, H, 0.45, 0.78); return [0, 0, W, H]; },
      text({ ctx, W, H, headline, subline, storeName, color }) {
        drawTexts(ctx, headline, subline, 72, H - 150, W - 144, 'left', '#ffffff', 'rgba(255,255,255,0.9)');
        ctx.fillStyle = color;
        ctx.font = `700 36px ${FONT}`;
        roundRect(ctx, 72, H - 112, ctx.measureText(storeName).width + 56, 64, 32);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText(storeName, 100, H - 68);
      },
    },
    frame: {
      photo({ ctx, W, img, color }) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, W, 1350);
        ctx.save();
        roundRect(ctx, 60, 60, W - 120, 860, 36);
        ctx.clip();
        cover(ctx, img, 60, 60, W - 120, 860);
        ctx.restore();
        return [60, 60, W - 120, 860];
      },
      text({ ctx, W, H, headline, subline, storeName }) {
        drawTexts(ctx, headline, subline, W / 2, H - 150, W - 160, 'center', '#ffffff', 'rgba(255,255,255,0.92)');
        ctx.font = `700 36px ${FONT}`;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.textAlign = 'center';
        ctx.fillText(storeName, W / 2, H - 70);
      },
    },
  };

  // 편집 효과: 사진 영역 [x, y, w, h] 위에 그림 (글자보다 먼저)
  const EFFECTS = {
    none() {},
    // 문구·도형: 포인트 컬러(핑크·민트) 별과 @가게이름
    shapes({ ctx, rect: [x0, y0, w, h], headline, storeName }) {
      const rnd = seeded(headline + storeName);
      const PINK = '#ff3d7f', MINT = '#20c997';
      ctx.font = `800 52px ${FONT}`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      const handle = `@${storeName.replace(/\s+/g, '').toLowerCase()}`;
      const hx = x0 + w * 0.08, hy = y0 + h * 0.12;
      ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.strokeText(handle, hx + 50, hy);
      ctx.fillStyle = PINK;
      ctx.fillText(handle, hx + 50, hy);
      star(ctx, hx + 18, hy - 18, 26); ctx.fill();
      for (let i = 0; i < 6; i++) {
        const x = x0 + w * (0.1 + rnd() * 0.8), y = y0 + h * (0.2 + rnd() * 0.4), r = (30 + rnd() * 34) * (w / 1080);
        ctx.fillStyle = i % 2 ? MINT : PINK;
        star(ctx, x, y, r); ctx.fill();
        if (i % 2 === 0) { ctx.fillStyle = MINT; star(ctx, x, y, r * 0.5); ctx.fill(); }
      }
    },
    // 드로잉: 노란 손그림 선 (반짝 선, 회오리, 구불구불한 선, 하트)
    doodle({ ctx, rect: [x0, y0, w, h], headline }) {
      const rnd = seeded(headline);
      const X = (f) => x0 + w * f, Y = (f) => y0 + h * f, k = w / 1080;
      ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 9 * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const burst = (cx, cy, r) => {
        for (let i = 0; i < 4; i++) {
          const a = -Math.PI * 0.85 + i * 0.45;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          ctx.lineTo(cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 1.6);
          ctx.stroke();
        }
      };
      burst(X(0.78), Y(0.14), 50 * k);
      burst(X(0.2), Y(0.2), 40 * k);
      ctx.beginPath();
      for (let t = 0; t < Math.PI * 5; t += 0.2) {
        const r = (6 + t * 7) * k;
        ctx.lineTo(X(0.14) + Math.cos(t) * r, Y(0.42) + Math.sin(t) * r * 0.8);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(X(0.62), Y(0.08));
      for (let i = 1; i <= 6; i++) ctx.quadraticCurveTo(X(0.55 + rnd() * 0.3), Y(0.05 + i * 0.07), X(0.6 + rnd() * 0.2), Y(0.08 + i * 0.07));
      ctx.stroke();
      const hx = X(0.84), hy = Y(0.5), s = 46 * k;
      ctx.beginPath();
      ctx.moveTo(hx, hy + s * 0.9);
      ctx.bezierCurveTo(hx - s * 1.6, hy - s * 0.2, hx - s * 0.6, hy - s * 1.2, hx, hy - s * 0.3);
      ctx.bezierCurveTo(hx + s * 0.6, hy - s * 1.2, hx + s * 1.6, hy - s * 0.2, hx, hy + s * 0.9);
      ctx.stroke();
    },
    // 반짝 하이라이트: 사진 속 밝은 곳에 반짝이
    sparkle({ ctx, rect: [x0, y0, w, h], img, headline }) {
      const rnd = seeded(headline);
      brightSpots(img, w, h, 7).forEach((p, i) => glint(ctx, x0 + p.x, y0 + p.y, (34 + (i % 3) * 14 + rnd() * 10) * (w / 1080)));
    },
    // 스티커 콜라주: 업종에 맞는 이모지 스티커
    sticker({ ctx, rect: [x0, y0, w, h], headline, category }) {
      const rnd = seeded(headline + category);
      const spots = [[0.14, 0.14], [0.84, 0.2], [0.1, 0.5], [0.86, 0.55], [0.5, 0.08]];
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      stickersFor(category).concat('✨').forEach((e, i) => {
        const [sx, sy] = spots[i % spots.length];
        ctx.save();
        ctx.translate(x0 + w * sx, y0 + h * sy);
        ctx.rotate((rnd() - 0.5) * 0.6);
        ctx.font = `${(130 + rnd() * 70) * (w / 1080)}px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
        ctx.fillText(e, 0, 0);
        ctx.restore();
      });
      ctx.textBaseline = 'alphabetic';
    },
  };

  // 슬라이드 피드: 2160x1350 한 장에 사진을 걸쳐 배치하고 반으로 잘라 2장으로
  async function makeSlides({ photos, headline, subline, effect = 'none', storeName = '', category = '' }) {
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
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
      ctx.fillRect(x, y, w, h);
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      cover(ctx, p[i], x, y, w, h);
    });
    // 반짝이는 첫 사진 위에, 나머지 효과는 두 장에 걸쳐
    (EFFECTS[effect] || EFFECTS.none)({ ctx, rect: effect === 'sparkle' ? boxes[0] : [0, 0, W, H], img: p[0], headline, storeName, category });
    const half = (sx) => {
      const k = document.createElement('canvas');
      k.width = 1080; k.height = H;
      k.getContext('2d').drawImage(c, sx, 0, 1080, H, 0, 0, 1080, H);
      return k;
    };
    const left = half(0);
    blackLabel(left.getContext('2d'), 1080, H, headline, subline, { dark: true });
    return [left, half(1080)];
  }

  async function makeCard({ photo, headline, subline, storeName, template = 'bottom', effect = 'none', color = '#1a3fa5', tag = '', category = '' }) {
    const W = 1080, H = 1350;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const img = photo ? await toBitmap(photo) : null;
    if (EFFECTS[template] && template !== 'none') { effect = template; template = 'caption'; } // 예전 이름 호환

    if (img && LAYOUTS[template]) {
      const a = { ctx, W, H, img, headline, subline, storeName, tag, category, color };
      a.rect = LAYOUTS[template].photo(a);
      (EFFECTS[effect] || EFFECTS.none)(a);
      LAYOUTS[template].text(a);
      return c;
    }
    // 글자만
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#eef2ff');
    g.addColorStop(1, '#c5d0f5');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, 24);
    drawTexts(ctx, headline, subline, W / 2, H / 2 + 120, W - 180, 'center', '#1d1d1b', '#5c5a55');
    ctx.font = `800 40px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(storeName, W / 2, H - 110);
    return c;
  }

  const toJpeg = (canvas, q = 0.9) => new Promise((res) => canvas.toBlob(res, 'image/jpeg', q));

  window.Imaging = { fitInsta, enhance, makeCard, makeSlides, toJpeg, PRESETS, TEMPLATES, LAYOUT_NAMES, EFFECT_NAMES };
})();
