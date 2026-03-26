export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const className = url.searchParams.get('class') || '';
  const debug = url.searchParams.get('debug') === '1';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // 클래스명 → 가이드북 title 매핑
  const CLASS_TITLE = {
    '검성':   '검성 스킬',   'Gladiator':    '검성 스킬',
    '수호성': '수호성 스킬', 'Templar':      '수호성 스킬',
    '살성':   '살성 스킬',   'Assassin':     '살성 스킬',
    '궁성':   '궁성 스킬',   'Ranger':       '궁성 스킬',
    '마도성': '마도성 스킬', 'Sorcerer':     '마도성 스킬',
    '정령성': '정령성 스킬', 'Spiritmaster': '정령성 스킬',
    '치유성': '치유성 스킬', 'Cleric':       '치유성 스킬',
    '호법성': '호법성 스킬', 'Chanter':      '호법성 스킬',
  };

  const title = CLASS_TITLE[className];
  if (!title) {
    return new Response(JSON.stringify({ error: 'class 파라미터가 필요합니다' }), { status: 400, headers: corsHeaders });
  }

  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/guidebook/list',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  };

  const jsonHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/guidebook/list',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://aion2.plaync.com',
  };

  const encodedTitle = encodeURIComponent(title);

  async function tryFetch(fetchUrl, reqHeaders) {
    try {
      const r = await fetch(fetchUrl, { headers: reqHeaders });
      const text = await r.text();
      const isJson = text.trim().startsWith('{') || text.trim().startsWith('[');
      return { ok: r.ok, status: r.status, text, isJson, data: (r.ok && isJson) ? JSON.parse(text) : null };
    } catch(e) {
      return { ok: false, status: 0, text: String(e), isJson: false, data: null };
    }
  }

  try {
    const debugLog = [];
    let paragraphList = null;
    let htmlContent = null;

    // 1단계: JSON API 엔드포인트 시도 (character API와 동일한 /api/ 패턴)
    const jsonUrls = [
      `https://aion2.plaync.com/api/guidebook/view?lang=ko&title=${encodedTitle}`,
      `https://aion2.plaync.com/api/guidebook/detail?lang=ko&title=${encodedTitle}`,
      `https://aion2.plaync.com/api/guidebook/guide?lang=ko&title=${encodedTitle}`,
      `https://aion2.plaync.com/api/guidebook/list?lang=ko&title=${encodedTitle}`,
    ];

    for (const fetchUrl of jsonUrls) {
      const res = await tryFetch(fetchUrl, jsonHeaders);
      debugLog.push({ url: fetchUrl, status: res.status, preview: res.text.slice(0, 200) });
      if (!res.data) continue;

      const pl = res.data.paragraphList
        || res.data.result?.paragraphList
        || res.data.data?.paragraphList
        || (Array.isArray(res.data) ? null : null);
      if (pl) { paragraphList = pl; break; }

      const entries = res.data.list || res.data.items || (Array.isArray(res.data) ? res.data : []);
      if (entries.length && entries[0]?.paragraphList) { paragraphList = entries[0].paragraphList; break; }
    }

    // 2단계: HTML 페이지를 가져와 파싱 (JSON 실패 시 fallback)
    if (!paragraphList) {
      const htmlRes = await tryFetch(
        `https://aion2.plaync.com/ko-kr/guidebook/view?title=${encodedTitle}`,
        browserHeaders
      );
      debugLog.push({ url: `(html)`, status: htmlRes.status, preview: htmlRes.text.slice(0, 200) });

      if (htmlRes.ok && !htmlRes.isJson) {
        htmlContent = htmlRes.text;

        // 2a: HTML 내 embedded JSON 탐색 (Nuxt/SSR 등)
        const nuxtMatch = htmlRes.text.match(/window\.__nuxt\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/);
        const stateMatch = htmlRes.text.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/);
        const dataMatch = htmlRes.text.match(/"paragraphList"\s*:\s*(\{[^<]{50,}\})/);

        const raw = nuxtMatch?.[1] || stateMatch?.[1] || null;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            paragraphList = parsed?.paragraphList || parsed?.data?.paragraphList || null;
          } catch(_) {}
        }

        if (!paragraphList && dataMatch) {
          try {
            paragraphList = JSON.parse(dataMatch[1]);
          } catch(_) {}
        }
      }
    }

    if (debug) {
      return new Response(JSON.stringify({
        _debug: true, title,
        hasParagraphList: !!paragraphList,
        hasHtml: !!htmlContent,
        htmlPreview: htmlContent ? htmlContent.slice(0, 500) : null,
        log: debugLog,
      }, null, 2), { headers: corsHeaders });
    }

    // 3단계: paragraphList에서 HTML 추출 후 파싱
    if (paragraphList) {
      let allHTML = '';
      for (const k of Object.keys(paragraphList).sort((a, b) => Number(a) - Number(b))) {
        const p = paragraphList[k];
        if (p?.content) allHTML += p.content;
      }
      return new Response(JSON.stringify({ skills: parseSkillTable(allHTML) }), { headers: corsHeaders });
    }

    // 4단계: HTML 페이지 직접 파싱 (최후 수단)
    if (htmlContent) {
      const skills = parseSkillTable(htmlContent);
      if (Object.keys(skills).length > 0) {
        return new Response(JSON.stringify({ skills }), { headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ skills: {} }), { headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: '스킬 가이드 조회 실패', detail: err.message }), { status: 500, headers: corsHeaders });
  }
}

function parseSkillTable(html) {
  const skills = {};
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHTML = rowMatch[1];
    const cells = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
      const text = cellMatch[1]
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\s+/g, ' ')
        .trim();
      cells.push(text);
    }
    let name = '', desc = '';
    if (cells.length >= 3) {
      const skip = cells[0].length < 2 || /^\d+$/.test(cells[0]);
      name = skip ? cells[1] : cells[0];
      desc = skip ? cells[2] : cells[1];
    } else if (cells.length === 2) {
      name = cells[0]; desc = cells[1];
    }
    if (!name || !desc || name.length > 60) continue;
    if (['스킬명','이름','명칭','Skill','스킬','아이콘','효과','설명'].includes(name)) continue;
    for (const part of name.split(/\s*[-–—]\s*/)) {
      const n = part.trim();
      if (n) skills[n] = desc;
    }
  }
  return skills;
}
