module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/board/notice/list',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://aion2.plaync.com',
  };

  // notice_ko / notice_ko_ko boardAlias 기반으로 시도
  const endpoints = [
    'https://aion2.plaync.com/api/board/notice_ko/articles?page=1&pageSize=20&serviceAlias=aion2',
    'https://aion2.plaync.com/api/board/notice_ko_ko/articles?page=1&pageSize=20&serviceAlias=aion2',
    'https://aion2.plaync.com/api/board/notice_ko/list/articles?page=1&pageSize=20&serviceAlias=aion2',
    'https://aion2.plaync.com/api/board/aion2/notice_ko/articles?page=1&pageSize=20',
    'https://aion2.plaync.com/ko-kr/api/board/notice_ko/articles?page=1&pageSize=20',
    'https://aion2.plaync.com/api/board/notice_ko/posts?page=1&pageSize=20&serviceAlias=aion2',
    'https://aion2.plaync.com/api/board/aion2/notice/articles?page=1&pageSize=20',
  ];

  if (req.query.debug === '1') {
    const results = [];
    for (const url of endpoints) {
      try {
        const r = await fetch(url, { headers });
        const text = await r.text();
        let parsed = null; try { parsed = JSON.parse(text); } catch(e) {}
        results.push({ url, status: r.status, ok: r.ok, isJson: !!parsed, keys: parsed ? Object.keys(parsed) : null, preview: text.slice(0, 400) });
      } catch(e) { results.push({ url, error: e.message }); }
    }
    return res.status(200).json({ notices: [], debug: results });
  }

  for (const url of endpoints) {
    try {
      const r = await fetch(url, { headers });
      if (!r.ok) continue;
      const text = await r.text();
      let data; try { data = JSON.parse(text); } catch(e) { continue; }

      const rawList = data?.result?.boardList || data?.result?.list || data?.result?.articles
        || data?.boardList || data?.list || data?.articles || data?.data?.list || data?.data
        || (Array.isArray(data) ? data : null) || [];

      if (!Array.isArray(rawList) || rawList.length === 0) continue;

      const notices = rawList.slice(0, 20).map(n => ({
        id:       String(n.boardNo || n.articleNo || n.id || ''),
        title:    n.subject || n.title || n.boardTitle || '',
        date:     (n.createDate || n.regDate || n.date || '').slice(0, 10).replace(/-/g, '.'),
        url:      buildUrl(n),
        category: n.categoryName || n.category || '',
      })).filter(n => n.title);

      if (notices.length > 0) return res.status(200).json({ notices, _src: url });
    } catch(e) { continue; }
  }

  return res.status(200).json({ notices: [], _err: 'NC 공지 API 엔드포인트를 찾지 못했습니다' });
};

function buildUrl(n) {
  const no = n.boardNo || n.articleNo || n.id || '';
  if (n.linkUrl) return n.linkUrl;
  if (n.url) return n.url.startsWith('http') ? n.url : 'https://aion2.plaync.com' + n.url;
  if (no) return `https://aion2.plaync.com/ko-kr/board/notice/view/${no}`;
  return 'https://aion2.plaync.com/ko-kr/board/notice/list';
}
