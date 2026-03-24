module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { characterId, serverId = '2001' } = req.query;
  if (!characterId) return res.status(400).json({ error: 'characterId가 필요해요' });

  const rawId = decodeURIComponent(characterId);
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/characters/index',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://aion2.plaync.com',
  };

  try {
    const [infoRes, equipRes] = await Promise.all([
      fetch(`https://aion2.plaync.com/api/character/info?lang=ko&characterId=${encodeURIComponent(rawId)}&serverId=${serverId}`, { headers }),
      fetch(`https://aion2.plaync.com/api/character/equipment?lang=ko&characterId=${encodeURIComponent(rawId)}&serverId=${serverId}`, { headers }),
    ]);

    if (!infoRes.ok) return res.status(502).json({ error: `NC 응답 오류: ${infoRes.status}` });

    const infoData  = await infoRes.json();
    const equipData = await equipRes.json();

    const profile = infoData?.profile || {};
    const equip   = equipData?.equipment?.equipmentList || [];

    // 직업명 한국어 매핑
    const classMap = {
      'Gladiator':'전사', 'Templar':'성전사',
      'Sorcerer':'마법사', 'Spiritmaster':'정령사',
      'Ranger':'레인저', 'Gunslinger':'건슬링거',
      'Cleric':'사제', 'Chanter':'음유시인',
      'Assassin':'어쌔신', 'Aethertech':'에테르테크',
    };

    res.status(200).json({
      characterId:  rawId,
      serverId,
      nickname:     profile.characterName || '',
      class:        classMap[profile.className] || profile.className || '',
      class_raw:    profile.className || '',
      level:        profile.characterLevel || 0,
      combat_power: profile.combatPower || 0,
      item_level:   Math.round((infoData?.stat?.statList?.find(s => s.type === 'ItemLevel')?.value || 0) / 10),
      server_name:  profile.serverName || '',
      guild_name:   profile.regionName || '',
      race:         profile.raceName || '',
      profile_img:  profile.profileImage || '',
      equipment: equip.map(e => ({
        name: e.name, slot: e.slotPosName,
        enchant: e.enchantLevel, exceed: e.exceedLevel,
        grade: e.grade, icon: e.icon,
      })),
      stats:      infoData?.stat?.statList || [],
      daevanion:  infoData?.daevanion?.boardList || [],
      ranking:    infoData?.ranking?.rankingList || [],
      titles:     infoData?.title?.titleList || [],
    });
  } catch (err) {
    res.status(500).json({ error: '조회 실패', detail: err.message });
  }
}
