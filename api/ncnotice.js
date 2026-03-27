module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();

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

  const moreEndpoint = 'https://api-community.plaync.com/aion2/board/notice_ko/article/search/moreArticle?isVote=true&moreSize=20&moreDirection=BEFORE&previousArticleId=0';
  const pinnedEndpoint = 'https://api-community.plaync.com/aion2/board/notice_ko/noticeArticle';

  if (req.query.debug === '1') {
    const results = [];
    for (const ep of [moreEndpoint, pinnedEndpoint]) {
      try {
        const r = await fetch(ep, { headers });
        const text = await r.text();
        let parsed = null; try { parsed = JSON.parse(text); } catch(e) {}
        results.push({ url: ep, status: r.status, ok: r.ok, isJson: !!parsed, keys: parsed ? Object.keys(parsed) : null, preview: text.slice(0, 600) });
      } catch(e) { results.push({ url: ep, error: e.message }); }
    }
    return res.status(200).json({ notices: [], debug: results });
  }

  try {
    const r = await fetch(moreEndpoint, { headers });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    const rawList = data?.contentList || data?.articleList || data?.list || data?.articles || data?.items
      || (Array.isArray(data) ? data : null) || [];

    if (!Array.isArray(rawList) || rawList.length === 0) {
      throw new Error('빈 목록: ' + JSON.stringify(Object.keys(data || {})));
    }

    const notices = rawList.slice(0, 20).map(item => {
      const m = item?.articleMeta || item;
      const id = m.id || m.articleId || '';
      const title = m.title || m.subject || '';
      const date = (m.createDate || m.registDate || m.regDate || m.date || '').slice(0, 10).replace(/-/g, '.');
      const articleUrl = `https://aion2.plaync.com/ko-kr/board/notice/view?articleId=${id}`;
      const category = m.categoryName || m.category || '';
      return { id, title, date, url: articleUrl, category };
    }).filter(n => n.title);

    return res.status(200).json({ notices, _src: moreEndpoint });
  } catch(e) {
    return res.status(200).json({ notices: [], _err: e.message });
  }
};
