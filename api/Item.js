module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, enchantLevel, characterId, serverId = '2001', slotPos, lang = 'ko' } = req.query;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/characters/index',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://aion2.plaync.com',
  };

  try {
    const params = new URLSearchParams({ lang });
    if (id) params.append('id', id);
    if (enchantLevel !== undefined) params.append('enchantLevel', enchantLevel);
    if (characterId) params.append('characterId', characterId);
    if (serverId) params.append('serverId', serverId);
    if (slotPos !== undefined) params.append('slotPos', slotPos);

    const url = `https://aion2.plaync.com/api/character/equipment/item?${params.toString()}`;
    const itemRes = await fetch(url, { headers });

    if (!itemRes.ok) {
      return res.status(200).json({ error: `NC API ${itemRes.status}`, url });
    }

    const text = await itemRes.text();
    if (!text || text.trim() === '') {
      return res.status(200).json({ error: '빈 응답', url });
    }

    try {
      const data = JSON.parse(text);
      return res.status(200).json(data);
    } catch(e) {
      return res.status(200).json({ error: 'JSON 파싱 실패', raw: text.substring(0, 200) });
    }
  } catch (err) {
    res.status(200).json({ error: '조회 실패', detail: err.message });
  }
}
