export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const keyword = url.searchParams.get('keyword') || '';
  const serverId = url.searchParams.get('serverId') || '2001';
  const race = url.searchParams.get('race') || '2';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!keyword) {
    return new Response(JSON.stringify({ error: '닉네임을 입력해주세요' }), { status: 400, headers: corsHeaders });
  }

  try {
    const apiUrl = `https://aion2.plaync.com/ko-kr/api/search/aion2/search/v2/character?keyword=${encodeURIComponent(keyword)}&race=${race}&serverId=${serverId}&page=1&size=10`;
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://aion2.plaync.com/ko-kr/characters/index',
      },
    });
    const data = await response.json();
    const list = (data.list || []).map(c => ({
      ...c,
      name: (c.name || '').replace(/<[^>]+>/g, ''),
    }));
    return new Response(JSON.stringify({ list }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: '검색 실패', detail: err.message }), { status: 500, headers: corsHeaders });
  }
}
