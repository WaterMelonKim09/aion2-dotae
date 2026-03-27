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

  try {
    // NC 공식 공지 목록 API (게시판 리스트)
    const listUrl = 'https://aion2.plaync.com/ko-kr/api/board/aion2/notice/list?page=1&pageSize=20';
    const listRes = await fetch(listUrl, { headers });
    if (!listRes.ok) {
      return res.status(502).json({ error: `NC 공지 API 오류: ${listRes.status}` });
    }

    const listData = await listRes.json();
    const rawList = listData?.result?.boardList
      || listData?.boardList
      || listData?.list
      || listData?.data
      || [];

    if (!Array.isArray(rawList) || rawList.length === 0) {
      // 리스트 API 포맷이 다를 경우 HTML 파싱 시도
      return fetchViaHtml(res, headers);
    }

    const notices = rawList.slice(0, 15).map(n => ({
      id:      String(n.boardNo || n.id || n.articleId || ''),
      title:   n.subject || n.title || '',
      date:    n.createDate || n.regDate || n.date || '',
      url:     n.boardNo ? `https://aion2.plaync.com/ko-kr/board/notice/view/${n.boardNo}` : '',
      category: n.categoryName || n.category || '',
    }));

    return res.status(200).json({ notices });

  } catch (err) {
    return res.status(500).json({ error: 'NC 공지 조회 실패', detail: err.message });
  }
};

async function fetchViaHtml(res, headers) {
  try {
    const htmlRes = await fetch('https://aion2.plaync.com/ko-kr/board/notice/list', { headers });
    if (!htmlRes.ok) return res.status(502).json({ error: `NC 공지 HTML 오류: ${htmlRes.status}` });

    const html = await htmlRes.text();
    const notices = [];

    // 게시글 목록 파싱
    const rowRegex = /<tr[^>]*class="[^"]*board[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(html)) !== null && notices.length < 15) {
      const rowHTML = rowMatch[1];
      const titleMatch = rowHTML.match(/<a[^>]+href="([^"]*\/view\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!titleMatch) continue;
      const path    = titleMatch[1];
      const boardNo = titleMatch[2];
      const rawTitle = titleMatch[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const dateMatch = rowHTML.match(/(\d{4}[.\-\/]\d{2}[.\-\/]\d{2})/);
      const date = dateMatch ? dateMatch[1] : '';
      if (rawTitle) {
        notices.push({
          id:    boardNo,
          title: rawTitle,
          date,
          url:   path.startsWith('http') ? path : 'https://aion2.plaync.com' + path,
          category: '',
        });
      }
    }

    // 대안: <li> 기반 파싱
    if (notices.length === 0) {
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch;
      while ((liMatch = liRegex.exec(html)) !== null && notices.length < 15) {
        const li = liMatch[1];
        const aMatch = li.match(/<a[^>]+href="([^"]*\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
        if (!aMatch) continue;
        const rawTitle = aMatch[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        const dateMatch = li.match(/(\d{4}[.\-\/]\d{2}[.\-\/]\d{2})/);
        if (rawTitle && rawTitle.length > 2 && rawTitle.length < 200) {
          notices.push({
            id:    aMatch[2],
            title: rawTitle,
            date:  dateMatch ? dateMatch[1] : '',
            url:   aMatch[1].startsWith('http') ? aMatch[1] : 'https://aion2.plaync.com' + aMatch[1],
            category: '',
          });
        }
      }
    }

    return res.status(200).json({ notices });
  } catch (err) {
    return res.status(500).json({ error: 'HTML 파싱 실패', detail: err.message });
  }
}
