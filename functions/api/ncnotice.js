export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const debug = url.searchParams.get('debug') === '1';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://aion2.plaync.com',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
  };

  const endpoint = 'https://api-community.plaync.com/aion2/board/notice_ko/noticeArticle';

  if (debug) {
    try {
      const r = await fetch(endpoint, { headers });
      const text = await r.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch(e) {}
      return new Response(JSON.stringify({ notices: [], debug: [{ url: endpoint, status: r.status, ok: r.ok, isJson: !!parsed, keys: parsed ? Object.keys(parsed) : null, preview: text.slice(0, 800) }] }), { status: 200, headers: corsHeaders });
    } catch(e) {
      return new Response(JSON.stringify({ notices: [], debug: [{ url: endpoint, error: e.message }] }), { status: 200, headers: corsHeaders });
    }
  }

  try {
    const r = await fetch(endpoint, { headers });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    // 응답 구조: { noticesList: [ { articleMeta: { id, title, ... } } ] }
    const rawList = data?.noticesList || [];

    const notices = rawList.slice(0, 20).map(item => {
      const m = item?.articleMeta || item;
      const id = m.id || '';
      const title = m.title || '';
      const date = (m.createDate || m.registDate || m.regDate || m.date || '').slice(0, 10).replace(/-/g, '.');
      const articleUrl = `https://aion2.plaync.com/ko-kr/board/notice/view?articleId=${id}`;
      const category = m.categoryName || m.category || '';
      return { id, title, date, url: articleUrl, category };
    }).filter(n => n.title);

    return new Response(JSON.stringify({ notices, _src: endpoint }), { status: 200, headers: corsHeaders });
  } catch(e) {
    return new Response(JSON.stringify({ notices: [], _err: e.message }), { status: 200, headers: corsHeaders });
  }
}
