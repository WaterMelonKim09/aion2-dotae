module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, enchantLevel, characterId, serverId = '2001', slotPos, lang = 'ko' } = req.query;
  if (!id) return res.status(400).json({ error: 'id가 필요해요' });

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/characters/index',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://aion2.plaync.com',
  };

  try {
    const params = new URLSearchParams({ id, lang });
    if (enchantLevel) params.append('enchantLevel', enchantLevel);
    if (characterId) params.append('characterId', characterId);
    if (serverId) params.append('serverId', serverId);
    if (slotPos !== undefined) params.append('slotPos', slotPos);

    const url = `https://aion2.plaync.com/api/character/equipment/item?${params.toString()}`;
    const itemRes = await fetch(url, { headers });
    if (!itemRes.ok) return res.status(502).json({ error: `NC 응답 오류: ${itemRes.status}` });

    const data = await itemRes.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: '조회 실패', detail: err.message });
  }
}
