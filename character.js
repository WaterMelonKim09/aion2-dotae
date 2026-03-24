// api/character.js
// 캐릭터 상세 정보 + 장비 API 프록시
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { characterId, serverId = '2001' } = req.query;
  if (!characterId) return res.status(400).json({ error: 'characterId가 필요해요' });

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': `https://aion2.plaync.com/ko-kr/characters/${serverId}/${characterId}`,
  };

  try {
    // 캐릭터 정보 + 장비 동시 요청
    const [infoRes, equipRes] = await Promise.all([
      fetch(`https://aion2.plaync.com/api/character/info?lang=ko&characterId=${encodeURIComponent(characterId)}&serverId=${serverId}`, { headers }),
      fetch(`https://aion2.plaync.com/api/character/equipment?lang=ko&characterId=${encodeURIComponent(characterId)}&serverId=${serverId}`, { headers }),
    ]);

    const infoData  = await infoRes.json();
    const equipData = await equipRes.json();

    // 필요한 데이터만 정리해서 반환
    const info = infoData?.characterInfo || infoData || {};
    const equip = equipData?.equipment?.equipmentList || [];

    res.status(200).json({
      characterId,
      serverId,
      nickname:     info.name        || info.characterName || '',
      class:        info.className   || info.pcClassName   || '',
      level:        info.level       || 0,
      combat_power: info.combatPoint || info.power         || 0,
      item_level:   info.itemLevel   || info.avgItemLevel  || 0,
      equipment: equip.map(e => ({
        name:         e.name,
        slot:         e.slotPosName,
        enchant:      e.enchantLevel,
        exceed:       e.exceedLevel,
        grade:        e.grade,
        icon:         e.icon,
      })),
      raw_info:  infoData,   // 디버그용 전체 데이터
      raw_equip: equipData,  // 디버그용 전체 데이터
    });
  } catch (err) {
    res.status(500).json({ error: '캐릭터 정보 조회 실패', detail: err.message });
  }
}
