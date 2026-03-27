export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const characterId = url.searchParams.get('characterId') || '';
  const serverId = url.searchParams.get('serverId') || '2001';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!characterId) {
    return new Response(JSON.stringify({ error: 'characterId가 필요해요' }), { status: 400, headers: corsHeaders });
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/characters/index',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://aion2.plaync.com',
  };

  const rawId = decodeURIComponent(characterId);

  // 여러 엔드포인트 시도
  const endpoints = [
    `https://aion2.plaync.com/api/character/legion/memberList?lang=ko&characterId=${encodeURIComponent(rawId)}&serverId=${serverId}`,
    `https://aion2.plaync.com/api/character/legion/members?lang=ko&characterId=${encodeURIComponent(rawId)}&serverId=${serverId}`,
    `https://aion2.plaync.com/api/character/legion/member?lang=ko&characterId=${encodeURIComponent(rawId)}&serverId=${serverId}`,
    `https://aion2.plaync.com/api/legion/memberList?lang=ko&characterId=${encodeURIComponent(rawId)}&serverId=${serverId}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const r = await fetch(endpoint, { headers });
      if (!r.ok) continue;
      const text = await r.text();
      if (!text || !text.trim()) continue;
      const data = JSON.parse(text);

      // 멤버 목록 추출 시도
      const memberList =
        data?.legion?.memberList ||
        data?.memberList ||
        data?.members ||
        data?.member?.memberList ||
        (Array.isArray(data) ? data : null);

      if (!memberList || !Array.isArray(memberList) || memberList.length === 0) {
        // debug 정보 포함해서 반환
        return new Response(JSON.stringify({
          members: [],
          _debug: { endpoint, status: r.status, keys: Object.keys(data || {}), preview: JSON.stringify(data).slice(0, 500) }
        }), { headers: corsHeaders });
      }

      const members = memberList.map(m => ({
        nickname: m.characterName || m.nickname || m.name || '',
        rank: m.rankName || m.rank || '',
        class: m.className || m.class || '',
        level: m.characterLevel || m.level || 0,
        characterId: m.characterId || m.id || '',
      })).filter(m => m.nickname);

      return new Response(JSON.stringify({ members, _src: endpoint }), { headers: corsHeaders });
    } catch (e) {
      continue;
    }
  }

  return new Response(JSON.stringify({ members: [], _err: '레기온 멤버 API를 찾을 수 없어요. NC 공홈 로그인이 필요할 수 있습니다.' }), { headers: corsHeaders });
}
