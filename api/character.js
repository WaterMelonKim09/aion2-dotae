module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { characterId, serverId = '2001' } = req.query;
  if (!characterId) return res.status(400).json({ error: 'characterId가 필요해요' });

  // 이미 인코딩된 characterId를 디코딩 후 재인코딩 방지
  const rawId = decodeURIComponent(characterId);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/characters/index',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Origin': 'https://aion2.plaync.com',
    'Cookie': '',
  };

  try {
    const infoUrl  = `https://aion2.plaync.com/api/character/info?lang=ko&characterId=${encodeURIComponent(rawId)}&serverId=${serverId}`;
    const equipUrl = `https://aion2.plaync.com/api/character/equipment?lang=ko&characterId=${encodeURIComponent(rawId)}&serverId=${serverId}`;

    const [infoRes, equipRes] = await Promise.all([
      fetch(infoUrl,  { headers }),
      fetch(equipUrl, { headers }),
    ]);

    const infoText  = await infoRes.text();
    const equipText = await equipRes.text();

    if (!infoRes.ok) {
      return res.status(502).json({ 
        error: `NC 응답 오류: ${infoRes.status}`,
        preview: infoText.slice(0, 300),
      });
    }

    let infoData, equipData;
    try {
      infoData  = JSON.parse(infoText);
      equipData = JSON.parse(equipText);
    } catch(e) {
      return res.status(502).json({ 
        error: 'JSON 파싱 실패',
        preview: infoText.slice(0, 300),
      });
    }

    const info  = infoData?.characterInfo || infoData?.result || infoData || {};
    const equip = equipData?.equipment?.equipmentList 
               || equipData?.result?.equipmentList 
               || [];

    res.status(200).json({
      characterId: rawId,
      serverId,
      nickname:     info.name        || info.characterName || '',
      class:        info.className   || info.pcClassName   || '',
      level:        info.level       || 0,
      combat_power: info.combatPoint || info.power         || 0,
      item_level:   info.itemLevel   || info.avgItemLevel  || 0,
      equipment: equip.map(e => ({
        name: e.name, slot: e.slotPosName,
        enchant: e.enchantLevel, exceed: e.exceedLevel,
        grade: e.grade, icon: e.icon,
      })),
      raw: infoData,
    });
  } catch (err) {
    res.status(500).json({ error: '조회 실패', detail: err.message });
  }
}
