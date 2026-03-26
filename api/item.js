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

  // 아이템 상세 엔드포인트 시도
  if (characterId && slotPos !== undefined) {
    try {
      const params = new URLSearchParams({ lang });
      if (id) params.append('id', id);
      if (enchantLevel !== undefined) params.append('enchantLevel', enchantLevel);
      params.append('characterId', characterId);
      params.append('serverId', serverId);
      params.append('slotPos', slotPos);

      const url = `https://aion2.plaync.com/api/character/equipment/item?${params.toString()}`;
      const itemRes = await fetch(url, { headers });

      if (itemRes.ok) {
        const text = await itemRes.text();
        if (text && text.trim() !== '') {
          try {
            const data = JSON.parse(text);
            // 에러 응답이 아닌 경우만 반환
            if (!data.errorCode && !data.error && (data.name || data.itemStat || data.item || data.result)) {
              return res.status(200).json({ _source: 'item-endpoint', ...data });
            }
          } catch(_) {}
        }
      }
    } catch(_) {}
  }

  // 폴백: 캐릭터 장비 목록에서 해당 슬롯 아이템 조회
  if (characterId) {
    try {
      const equipUrl = `https://aion2.plaync.com/api/character/equipment?lang=${lang}&characterId=${encodeURIComponent(characterId)}&serverId=${serverId}`;
      const equipRes = await fetch(equipUrl, { headers });
      if (equipRes.ok) {
        const equipData = await equipRes.json();
        const equipList = (equipData && equipData.equipment && equipData.equipment.equipmentList) || [];

        // slotPos 또는 itemId로 해당 아이템 찾기
        let found = null;
        if (slotPos !== undefined) {
          found = equipList.find(e => String(e.slotPos) === String(slotPos));
        }
        if (!found && id) {
          found = equipList.find(e => String(e.itemId || e.id) === String(id));
        }

        if (found) {
          return res.status(200).json({ _source: 'equip-list', ...found });
        }

        // 못 찾으면 전체 장비 목록 반환 (프론트에서 처리)
        return res.status(200).json({ _source: 'equip-list-all', equipmentList: equipList });
      }
    } catch (err) {
      return res.status(200).json({ error: '장비 목록 조회 실패', detail: err.message });
    }
  }

  res.status(200).json({ error: 'characterId가 필요합니다' });
}
