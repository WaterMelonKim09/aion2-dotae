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

  async function tryFetch(url) {
    try {
      const r = await fetch(url, { headers });
      if (!r.ok) return null;
      const text = await r.text();
      if (!text || !text.trim()) return null;
      const data = JSON.parse(text);
      // 유효한 아이템 데이터인지 확인 (name 또는 mainStats가 있어야 함)
      if (data && (data.name || data.mainStats || data.id)) return data;
      return null;
    } catch(_) { return null; }
  }

  // 1) characterId + slotPos 있으면 아이템 상세 엔드포인트 (서브스탯 포함)
  if (characterId && slotPos !== undefined && id) {
    const params = new URLSearchParams({ lang, id, enchantLevel: enchantLevel||0, characterId, serverId, slotPos });
    const data = await tryFetch(`https://aion2.plaync.com/api/character/equipment/item?${params}`);
    if (data) return res.status(200).json(data);
  }

  // 2) characterId만 있으면 slotPos 없이 시도
  if (characterId && id) {
    const params = new URLSearchParams({ lang, id, enchantLevel: enchantLevel||0, characterId, serverId });
    const data = await tryFetch(`https://aion2.plaync.com/api/character/equipment/item?${params}`);
    if (data) return res.status(200).json(data);
  }

  // 3) id만 있어도 기본 아이템 정보 조회 (characterId 없이)
  if (id) {
    const params = new URLSearchParams({ lang, id, enchantLevel: enchantLevel||0 });
    if (serverId) params.append('serverId', serverId);
    const data = await tryFetch(`https://aion2.plaync.com/api/character/equipment/item?${params}`);
    if (data) return res.status(200).json(data);
  }

  // 4) 폴백: 캐릭터 장비 목록에서 해당 슬롯 아이템 조회
  if (characterId) {
    try {
      const equipUrl = `https://aion2.plaync.com/api/character/equipment?lang=${lang}&characterId=${encodeURIComponent(characterId)}&serverId=${serverId}`;
      const equipRes = await fetch(equipUrl, { headers });
      if (equipRes.ok) {
        const equipData = await equipRes.json();
        const equipList = (equipData && equipData.equipment && equipData.equipment.equipmentList) || [];
        let found = null;
        if (slotPos !== undefined) found = equipList.find(e => String(e.slotPos) === String(slotPos));
        if (!found && id) found = equipList.find(e => String(e.itemId || e.id) === String(id));
        if (found) return res.status(200).json(found);
      }
    } catch(err) {
      return res.status(200).json({ error: '장비 목록 조회 실패', detail: err.message });
    }
  }

  res.status(200).json({ error: 'itemId가 필요합니다' });
}
