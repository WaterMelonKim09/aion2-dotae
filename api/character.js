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

    const classMap = {
      'Gladiator':'검성','Templar':'수호성',
      'Assassin':'살성','Ranger':'궁성',
      'Sorcerer':'마도성','Spiritmaster':'정령성',
      'Cleric':'치유성','Chanter':'호법성',
    };

    // 장비 아이템 전체 필드 포함
    const mapEquip = e => ({
      name:    e.name,
      slot:    e.slotPosName,
      enchant: e.enchantLevel,
      exceed:  e.exceedLevel,
      grade:   e.grade,
      icon:    e.icon,
      // 아이템 상세 스탯
      itemStats:   e.itemStat?.statList || e.statList || [],
      itemOptions: e.itemOption?.optionList || e.optionList || [],
      itemSouls:   e.soulCrystal?.crystalList || [],
      setName:     e.setItemName || '',
      itemLevel:   e.itemLevel || 0,
    });

    res.status(200).json({
      characterId: rawId,
      serverId,
      nickname:     profile.characterName || '',
      class:        classMap[profile.className] || profile.className || '',
      class_raw:    profile.className || '',
      level:        profile.characterLevel || 0,
      combat_power: profile.combatPower || 0,
      item_level:   infoData?.stat?.statList?.find(s => s.type === 'ItemLevel')?.value || 0,
      server_name:  profile.serverName || '',
      guild_name:   profile.regionName || '',
      race:         profile.raceName || '',
      profile_img:  profile.profileImage || '',
      // 장비 (전체 슬롯 - 펫/날개 포함)
      equipment: equip.map(mapEquip),
      // 스탯 (전체)
      stats:     infoData?.stat?.statList || [],
      // 데바니온
      daevanion: infoData?.daevanion?.boardList || [],
      // 랭킹
      ranking:   infoData?.ranking?.rankingList || [],
      // 칭호
      titles:    infoData?.title?.titleList || [],
      // 스티그마 (스킬)
      stigma:    infoData?.stigma?.stigmaList || equipData?.stigma?.stigmaList || [],
      // 아르카나
      arcana:    infoData?.arcana?.arcanaList || equipData?.arcana?.arcanaList || [],
      // 펫
      pet:       infoData?.pet || equipData?.pet || null,
      // 날개
      wing:      infoData?.wing || equipData?.wing || null,
      // raw 디버그용
      _raw_keys_info:  Object.keys(infoData || {}),
      _raw_keys_equip: Object.keys(equipData || {}),
    });
  } catch (err) {
    res.status(500).json({ error: '조회 실패', detail: err.message });
  }
}
