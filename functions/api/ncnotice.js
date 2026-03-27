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

  const endpoints = [
    'https://api-community.plaync.com/aion2/board/notice_ko/noticeArticle',
    'https://api-community.plaync.com/aion2/board/notice_ko',
  ];

  if (debug) {
    const results = [];
    for (const endpoint of endpoints) {
      try {
        const r = await fetch(endpoint, { headers });
        const text = await r.text();
        let parsed = null;
        try { parsed = JSON.parse(text); } catch(e) {}
        results.push({ url: endpoint, status: r.status, ok: r.ok, isJson: !!parsed, keys: parsed ? Object.keys(parsed) : null, preview: text.slice(0, 600) });
      } catch(e) {
        results.push({ url: endpoint, error: e.message });
      }
    }
    return new Response(JSON.stringify({ notices: [], debug: results }), { status: 200, headers: corsHeaders });
  }

  for (const endpoint of endpoints) {
    try {
      const r = await fetch(endpoint, { headers });
      if (!r.ok) continue;
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch(e) { continue; }

      // api-community.plaync.com 응답 구조 우선, 기존 구조 폴백
      const rawList = data?.list || data?.articles || data?.data?.list || data?.data?.articles
        || data?.result?.articles || data?.result?.list || data?.result?.boardList
        || data?.boardList || data?.noticeList || data?.items
        || (Array.isArray(data) ? data : null) || [];

      if (!Array.isArray(rawList) || rawList.length === 0) continue;

      const notices = rawList.slice(0, 20).map(n => ({
        id:       String(n.articleId || n.noticeArticleId || n.boardNo || n.id || ''),
        title:    n.title || n.subject || n.boardTitle || '',
        date:     (n.createDate || n.registDate || n.regDate || n.date || '').slice(0, 10).replace(/-/g, '.'),
        url:      buildUrl(n),
        category: n.categoryName || n.category || n.noticeType || '',
      })).filter(n => n.title);

      if (notices.length > 0) {
        return new Response(JSON.stringify({ notices, _src: endpoint }), { status: 200, headers: corsHeaders });
      }
    } catch(e) { continue; }
  }

  return new Response(JSON.stringify({ notices: [], _err: 'NC 공지 API 엔드포인트를 찾지 못했습니다' }), { status: 200, headers: corsHeaders });
}

function buildUrl(n) {
  const articleId = n.articleId || n.noticeArticleId || '';
  const boardNo   = n.boardNo || n.id || '';
  if (n.linkUrl) return n.linkUrl;
  if (n.url) return n.url.startsWith('http') ? n.url : 'https://aion2.plaync.com' + n.url;
  if (articleId) return `https://aion2.plaync.com/ko-kr/board/notice/view?articleId=${articleId}`;
  if (boardNo)   return `https://aion2.plaync.com/ko-kr/board/notice/view/${boardNo}`;
  return 'https://aion2.plaync.com/ko-kr/board/notice/list';
}
