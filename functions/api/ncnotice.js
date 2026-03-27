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

  // 일반 공지 목록 (moreArticle) + 상단 고정 공지 (noticeArticle)
  const prevId = url.searchParams.get('prevId') || '0';
  const moreEndpoint = `https://api-community.plaync.com/aion2/board/notice_ko/article/search/moreArticle?isVote=true&moreSize=20&moreDirection=BEFORE&previousArticleId=${prevId}`;
  const pinnedEndpoint = 'https://api-community.plaync.com/aion2/board/notice_ko/noticeArticle';

  if (debug) {
    const results = [];
    for (const ep of [moreEndpoint, pinnedEndpoint]) {
      try {
        const r = await fetch(ep, { headers });
        const text = await r.text();
        let parsed = null;
        try { parsed = JSON.parse(text); } catch(e) {}
        results.push({ url: ep, status: r.status, ok: r.ok, isJson: !!parsed, keys: parsed ? Object.keys(parsed) : null, preview: text.slice(0, 600) });
      } catch(e) {
        results.push({ url: ep, error: e.message });
      }
    }
    return new Response(JSON.stringify({ notices: [], debug: results }), { status: 200, headers: corsHeaders });
  }

  try {
    const r = await fetch(moreEndpoint, { headers });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    // moreArticle 응답 구조 파악 (articleList, list, articles, items 등 시도)
    const rawList = data?.contentList || data?.articleList || data?.list || data?.articles || data?.items
      || (Array.isArray(data) ? data : null) || [];

    if (!Array.isArray(rawList) || rawList.length === 0) {
      throw new Error('빈 목록: ' + JSON.stringify(Object.keys(data || {})));
    }

    const notices = rawList.slice(0, 20).map(item => {
      const m = item?.articleMeta || item;
      const id = m.id || m.articleId || '';
      const snowId = m.snow?.contentId || item?.articleMeta?.snow?.contentId || 0;
      const title = m.title || m.subject || '';
      const date = (m.createDate || m.registDate || m.regDate || m.date || '').slice(0, 10).replace(/-/g, '.');
      const articleUrl = `https://aion2.plaync.com/ko-kr/board/notice/view?articleId=${id}`;
      const category = m.categoryName || m.category || '';
      return { id, title, date, url: articleUrl, category, snowId };
    }).filter(n => n.title);

    const hasMore = data?.hasMore ?? false;
    const lastSnowId = notices.length > 0 ? notices[notices.length - 1].snowId : 0;

    return new Response(JSON.stringify({ notices, hasMore, lastSnowId, _src: moreEndpoint }), { status: 200, headers: corsHeaders });
  } catch(e) {
    return new Response(JSON.stringify({ notices: [], _err: e.message }), { status: 200, headers: corsHeaders });
  }
}
