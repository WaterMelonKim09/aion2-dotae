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

  // 클래스명 → { categoryId, guidebookId } 매핑
  // guidebookId: 가이드북 view API의 id 파라미터 (검성=6205 확인됨, 나머지 추정)
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
  if (!info) {
    return new Response(JSON.stringify({ error: 'categoryId 또는 class 파라미터가 필요합니다' }), { status: 400, headers: corsHeaders });
  }

  const ncHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/guidebook/list',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://aion2.plaync.com',
  };

  async function tryJson(fetchUrl) {
    try {
      const r = await fetch(fetchUrl, { headers: ncHeaders });
      const text = await r.text();
      return { status: r.status, text: text.slice(0, 200), data: (r.ok && text.trim().startsWith('{')) ? JSON.parse(text) : null };
    } catch(e) {
      return { status: 0, text: e.message, data: null };
    }
  }

  // 시도할 URL 목록 (직접 view 먼저, 그 다음 list 다양한 형태)
  const attempts = [];

  if (info.gbId) {
    attempts.push(`https://aion2.plaync.com/ko-kr/api/guidebook/view?id=${info.gbId}`);
    attempts.push(`https://aion2.plaync.com/api/guidebook/view?id=${info.gbId}`);
  }
  attempts.push(`https://aion2.plaync.com/ko-kr/api/guidebook/list?categoryId=${info.catId}`);
  attempts.push(`https://aion2.plaync.com/ko-kr/api/guidebook/list?categoryId=${info.catId}&page=1&size=10`);
  attempts.push(`https://aion2.plaync.com/api/guidebook/list?categoryId=${info.catId}`);

  try {
    const results = [];
    let paragraphList = null;

    for (const fetchUrl of attempts) {
      const res = await tryJson(fetchUrl);
      results.push({ url: fetchUrl, status: res.status, preview: res.text });

      if (!res.data) continue;

      // view 응답: 바로 paragraphList 있음
      if (res.data.paragraphList) {
        paragraphList = res.data.paragraphList;
        if (!debug) break;
      }

      // list 응답: 첫 번째 엔트리에서 paragraphList 또는 id 추출
      const entries = res.data.list || res.data.items || res.data.data || res.data.result?.list || (Array.isArray(res.data) ? res.data : []);
      if (entries.length) {
        const entry = entries[0];
        if (entry.paragraphList) {
          paragraphList = entry.paragraphList;
          if (!debug) break;
        }
        // 엔트리에 id만 있으면 view 조회
        if (!paragraphList && entry.id && !debug) {
          const viewRes = await tryJson(`https://aion2.plaync.com/ko-kr/api/guidebook/view?id=${entry.id}`);
          if (viewRes.data?.paragraphList) {
            paragraphList = viewRes.data.paragraphList;
            break;
          }
        }
      }
    }

    if (debug) {
      return new Response(JSON.stringify({ _debug: true, info, attempts: results, hasParagraphList: !!paragraphList }, null, 2), { headers: corsHeaders });
    }

    if (!paragraphList) {
      return new Response(JSON.stringify({ skills: {} }), { headers: corsHeaders });
    }

    let allHTML = '';
    const keys = Object.keys(paragraphList).sort((a, b) => Number(a) - Number(b));
    for (const k of keys) {
      const p = paragraphList[k];
      if (p && p.content) allHTML += p.content;
    }

    return new Response(JSON.stringify({ skills: parseSkillTable(allHTML) }), { headers: corsHeaders });
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
