export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const categoryId = url.searchParams.get('categoryId') || '';
  const className = url.searchParams.get('class') || '';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // 클래스명 → guidebook categoryId 매핑
  const CLASS_CATEGORY = {
    '검성': '4253', 'Gladiator': '4253',
    '수호성': '4254', 'Templar': '4254',
    '살성': '4255', 'Assassin': '4255',
    '궁성': '4256', 'Ranger': '4256',
    '마도성': '4257', 'Sorcerer': '4257',
    '정령성': '4258', 'Spiritmaster': '4258',
    '치유성': '4259', 'Cleric': '4259',
    '호법성': '4260', 'Chanter': '4260',
  };

  const catId = categoryId || CLASS_CATEGORY[className] || '';
  if (!catId) {
    return new Response(JSON.stringify({ error: 'categoryId 또는 class 파라미터가 필요합니다' }), { status: 400, headers: corsHeaders });
  }

  const ncHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/guidebook/list',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://aion2.plaync.com',
  };

  try {
    // 1) 해당 카테고리의 가이드북 목록 조회
    const listRes = await fetch(
      `https://aion2.plaync.com/ko-kr/api/guidebook/list?categoryId=${catId}&page=1&size=10`,
      { headers: ncHeaders }
    );
    if (!listRes.ok) {
      return new Response(JSON.stringify({ error: `가이드북 목록 오류: ${listRes.status}` }), { status: 502, headers: corsHeaders });
    }
    const listData = await listRes.json();

    // 첫 번째 엔트리에서 paragraphList 또는 id 추출
    const entries = listData.list || listData.items || listData.data || (Array.isArray(listData) ? listData : []);
    if (!entries.length) {
      return new Response(JSON.stringify({ skills: {} }), { headers: corsHeaders });
    }
    const entry = entries[0];

    let paragraphList = entry.paragraphList || null;

    // 2) 목록에 내용이 없으면 개별 엔트리 조회
    if (!paragraphList && entry.id) {
      const viewRes = await fetch(
        `https://aion2.plaync.com/ko-kr/api/guidebook/view?id=${entry.id}`,
        { headers: ncHeaders }
      );
      if (viewRes.ok) {
        const viewData = await viewRes.json();
        paragraphList = viewData.paragraphList || viewData.result?.paragraphList || null;
      }
    }

    if (!paragraphList) {
      return new Response(JSON.stringify({ skills: {} }), { headers: corsHeaders });
    }

    // 3) 모든 단락의 HTML 합치기
    let allHTML = '';
    const keys = Object.keys(paragraphList).sort((a, b) => Number(a) - Number(b));
    for (const k of keys) {
      const p = paragraphList[k];
      if (p && p.content) allHTML += p.content;
    }

    // 4) HTML 테이블에서 스킬명 → 설명 추출
    const skills = parseSkillTable(allHTML);

    return new Response(JSON.stringify({ skills }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: '스킬 가이드 조회 실패', detail: err.message }), { status: 500, headers: corsHeaders });
  }
}

/**
 * HTML 테이블에서 스킬명 → 설명 맵 파싱
 * 테이블 구조: <td>아이콘</td> <td>스킬명</td> <td>설명</td> <td>비고</td>
 */
function parseSkillTable(html) {
  const skills = {};

  // <tr> 블록 추출
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHTML = rowMatch[1];
    const cells = [];

    // <td> 또는 <th> 셀 추출 (colspan 있어도 처리)
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
      // 태그 제거, 공백 정리
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

    // 첫 번째 셀이 비어있거나 숫자인 경우(icon 셀) → cells[0]=icon, [1]=name, [2]=desc
    // 또는 cells[0]=name, [1]=desc 형태일 수도 있음
    let name = '', desc = '';

    if (cells.length >= 3) {
      // cells[0]이 짧고 의미없는 경우 (아이콘 텍스트 또는 빈 칸): skip
      const firstMeaningful = cells[0].length < 2 || /^\d+$/.test(cells[0]);
      name = firstMeaningful ? cells[1] : cells[0];
      desc = firstMeaningful ? cells[2] : cells[1];
    } else if (cells.length === 2) {
      name = cells[0];
      desc = cells[1];
    }

    if (!name || !desc || name.length > 60) continue;
    // 헤더 행 제외 (이름 셀이 "스킬명", "이름" 등인 경우)
    if (['스킬명', '이름', '명칭', 'Skill', '스킬', '아이콘', '효과', '설명'].includes(name)) continue;

    // 스킬 체인 "A - B - C" 형태 처리 → 각각 매핑
    const parts = name.split(/\s*[-–—]\s*/);
    for (const part of parts) {
      const n = part.trim();
      if (n) skills[n] = desc;
    }
  }

  return skills;
}
