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

  // 시도할 엔드포인트 목록 (순서대로 시도)
  const endpoints = [
    'https://aion2.plaync.com/ko-kr/api/board/aion2/notice/list?page=1&pageSize=20',
    'https://aion2.plaync.com/api/board/notice/list?page=1&pageSize=20&gameCode=aion2',
    'https://aion2.plaync.com/api/v2/aion2/board/notice/list?page=1&pageSize=20',
    'https://aion2.plaync.com/ko-kr/api/board/notice/list?page=1&pageSize=20',
    'https://aion2.plaync.com/ko-kr/api/board/aion2/notice?page=1&pageSize=20',
  ];

  // ?debug=1 : 각 엔드포인트 상태 상세 반환
  if (req.query.debug === '1') {
    const results = [];
    for (const url of endpoints) {
      try {
        const r = await fetch(url, { headers });
        const text = await r.text();
        let parsed = null;
        try { parsed = JSON.parse(text); } catch(e) {}
        results.push({ url, status: r.status, ok: r.ok, isJson: !!parsed, preview: text.slice(0, 300), keys: parsed ? Object.keys(parsed) : null });
      } catch(e) {
        results.push({ url, error: e.message });
      }
    }
    // HTML 페이지도 확인
    try {
      const hr = await fetch('https://aion2.plaync.com/ko-kr/board/notice/list', { headers: { ...headers, Accept: 'text/html' } });
      const htxt = await hr.text();
      const hasNoticeLink = /\/board\/notice\/view\/\d+/.test(htxt);
      results.push({ url: 'HTML_PAGE', status: hr.status, hasNoticeViewLinks: hasNoticeLink, htmlPreview: htxt.slice(0, 500) });
    } catch(e) {
      results.push({ url: 'HTML_PAGE', error: e.message });
    }
    return res.status(200).json({ debug: results });
  }

  for (const url of endpoints) {
    try {
      const r = await fetch(url, { headers });
      if (!r.ok) continue;

      const text = await r.text();
      // JSON 응답인지 확인
      let data;
      try { data = JSON.parse(text); } catch(e) { continue; }

      const rawList = data?.result?.boardList
        || data?.boardList
        || data?.result?.list
        || data?.list
        || data?.data?.list
        || data?.data
        || (Array.isArray(data) ? data : null)
        || [];

      if (!Array.isArray(rawList) || rawList.length === 0) continue;

      const notices = rawList.slice(0, 20).map(n => ({
        id:       String(n.boardNo || n.articleNo || n.id || ''),
        title:    n.subject || n.title || n.boardTitle || '',
        date:     (n.createDate || n.regDate || n.date || '').slice(0, 10).replace(/-/g, '.'),
        url:      buildUrl(n),
        category: n.categoryName || n.category || '',
      })).filter(n => n.title);

      if (notices.length > 0) {
        return res.status(200).json({ notices, _src: url });
      }
    } catch(e) { continue; }
  }

  // JSON API 모두 실패 → HTML 파싱
  return fetchViaHtml(res, headers);
};

function buildUrl(n) {
  const no = n.boardNo || n.articleNo || n.id || '';
  if (n.linkUrl) return n.linkUrl;
  if (n.url) return n.url.startsWith('http') ? n.url : 'https://aion2.plaync.com' + n.url;
  if (no) return `https://aion2.plaync.com/ko-kr/board/notice/view/${no}`;
  return 'https://aion2.plaync.com/ko-kr/board/notice/list';
}

async function fetchViaHtml(res, headers) {
  try {
    const htmlRes = await fetch('https://aion2.plaync.com/ko-kr/board/notice/list', { headers: { ...headers, Accept: 'text/html,application/xhtml+xml' } });
    if (!htmlRes.ok) return res.status(502).json({ notices: [], _err: `HTML ${htmlRes.status}` });

    const html = await htmlRes.text();
    const notices = [];

    // <a> 태그 중 /board/notice/view/ 패턴 추출
    const linkRegex = /<a[^>]+href="([^"]*\/board\/notice\/view\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    const seen = new Set();
    while ((m = linkRegex.exec(html)) !== null && notices.length < 20) {
      const path  = m[1];
      const no    = m[2];
      const raw   = m[3].replace(/<[^>]+>/g, '').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim();
      if (!raw || raw.length < 2 || raw.length > 200 || seen.has(no)) continue;
      seen.add(no);
      // 주변 텍스트에서 날짜 추출 시도
      const ctx    = html.slice(Math.max(0, m.index - 200), m.index + m[0].length + 200);
      const dMatch = ctx.match(/(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})/);
      notices.push({
        id:       no,
        title:    raw,
        date:     dMatch ? `${dMatch[1]}.${dMatch[2]}.${dMatch[3]}` : '',
        url:      path.startsWith('http') ? path : 'https://aion2.plaync.com' + path,
        category: '',
      });
    }

    return res.status(200).json({ notices, _src: 'html' });
  } catch(e) {
    return res.status(500).json({ notices: [], _err: e.message });
  }
}
