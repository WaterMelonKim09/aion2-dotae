export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const categoryId = url.searchParams.get('categoryId') || '';
  const className = url.searchParams.get('class') || '';
  const debug = url.searchParams.get('debug') === '1';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // 클래스명 → guidebook HTML page id 매핑 (검성=6205 확인됨, 나머지 추정)
  const CLASS_MAP = {
    '검성':   { catId: '4253', gbId: '6205' }, 'Gladiator':    { catId: '4253', gbId: '6205' },
    '수호성': { catId: '4254', gbId: '6206' }, 'Templar':      { catId: '4254', gbId: '6206' },
    '살성':   { catId: '4255', gbId: '6207' }, 'Assassin':     { catId: '4255', gbId: '6207' },
    '궁성':   { catId: '4256', gbId: '6208' }, 'Ranger':       { catId: '4256', gbId: '6208' },
    '마도성': { catId: '4257', gbId: '6209' }, 'Sorcerer':     { catId: '4257', gbId: '6209' },
    '정령성': { catId: '4258', gbId: '6210' }, 'Spiritmaster': { catId: '4258', gbId: '6210' },
    '치유성': { catId: '4259', gbId: '6211' }, 'Cleric':       { catId: '4259', gbId: '6211' },
    '호법성': { catId: '4260', gbId: '6212' }, 'Chanter':      { catId: '4260', gbId: '6212' },
  };

  const info = CLASS_MAP[className] || (categoryId ? { catId: categoryId, gbId: null } : null);
  if (!info || !info.gbId) {
    return new Response(JSON.stringify({ error: 'class 파라미터가 필요합니다' }), { status: 400, headers: corsHeaders });
  }

  const ncHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/guidebook/list',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9',
  };

  try {
    const pageUrl = `https://aion2.plaync.com/ko-kr/guidebook/view?id=${info.gbId}`;
    const r = await fetch(pageUrl, { headers: ncHeaders });
    const html = await r.text();

    if (debug) {
      // HTML에서 스킬 테이블이 있는 부분만 추출해서 반환
      const tableMatch = html.match(/<table[\s\S]{0,50000}/i);
      return new Response(JSON.stringify({
        _debug: true,
        gbId: info.gbId,
        pageUrl,
        httpStatus: r.status,
        htmlLength: html.length,
        // 첫 번째 table 태그 주변 컨텍스트
        tablePreview: tableMatch ? tableMatch[0].slice(0, 1000) : null,
        // __INITIAL_STATE__ 또는 JSON 데이터 확인
        hasInitialState: html.includes('__INITIAL_STATE__'),
        hasNuxtData: html.includes('__NUXT__') || html.includes('useNuxtApp'),
        // 스크립트 태그에서 JSON 추출 시도
        scriptJsonPreview: extractScriptJson(html, 200),
      }, null, 2), { headers: corsHeaders });
    }

    // 1) __INITIAL_STATE__ / __NUXT__ / window.__DATA__ 형태의 서버 사이드 JSON 시도
    const pageData = extractPageData(html);
    if (pageData) {
      const paragraphList = pageData.paragraphList
        || pageData.detail?.paragraphList
        || pageData.guidebook?.paragraphList
        || pageData.data?.paragraphList
        || null;
      if (paragraphList) {
        const skills = parseSkillTable(buildHtmlFromParagraphList(paragraphList));
        if (Object.keys(skills).length > 0) {
          return new Response(JSON.stringify({ skills }), { headers: corsHeaders });
        }
      }
    }

    // 2) HTML 테이블 직접 파싱
    const skills = parseSkillTable(html);
    return new Response(JSON.stringify({ skills }), { headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: '스킬 가이드 조회 실패', detail: err.message }), { status: 500, headers: corsHeaders });
  }
}

function buildHtmlFromParagraphList(paragraphList) {
  let html = '';
  const keys = Object.keys(paragraphList).sort((a, b) => Number(a) - Number(b));
  for (const k of keys) {
    const p = paragraphList[k];
    if (p && p.content) html += p.content;
  }
  return html;
}

function extractPageData(html) {
  // Next.js / Nuxt.js 형태의 서버 사이드 데이터 추출
  const patterns = [
    /__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
    /__NUXT__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
    /window\.__DATA__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
    /window\.__PAGE_DATA__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) {
      try { return JSON.parse(m[1]); } catch(e) {}
    }
  }
  return null;
}

function extractScriptJson(html, previewLen) {
  const m = html.match(/<script[^>]*>\s*window\.[^=]+=\s*(\{[\s\S]{0,200})/);
  return m ? m[1].slice(0, previewLen) : null;
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
