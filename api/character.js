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

    // 장비 아이템 - 가능한 모든 필드 포함
    const mapEquip = e => ({
      name:        e.name || '',
      slot:        e.slotPosName || '',
      enchant:     e.enchantLevel || 0,
      exceed:      e.exceedLevel || 0,
      grade:       e.grade || '',
      icon:        e.icon || '',
      itemLevel:   e.itemLevel || 0,
      setName:     e.setItemName || '',
      // 아이템 스탯 - 여러 가능한 경로 시도
      itemStats:   e.itemStat?.statList || e.statList || e.stats || [],
      // 아이템 옵션
      itemOptions: e.itemOption?.optionList || e.optionList || e.options || [],
      // 소울 크리스탈
      itemSouls:   e.soulCrystal?.crystalList || e.crystalList || [],
      // 마석 각인
      souls:       e.soul || [],
      // 잠재력
      potential:   e.potential || null,
      // 아이템 레벨 강화 수치
      upgradeLevel: e.upgradeLevel || 0,
    });

    // 펫/날개 슬롯 (equipmentList 안에 포함될 수 있음)
    const petSlot  = equip.find(e => e.slotPosName === 'Pet'  || e.slotType === 'Pet');
    const wingSlot = equip.find(e => e.slotPosName === 'Wing' || e.slotType === 'Wing');

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
      race:         profile.raceName   || '',
      profile_img:  profile.profileImage || '',
      equipment:    equip.map(mapEquip),
      // 스탯 전체 (name, type, value, statSecondList 포함)
      stats:        infoData?.stat?.statList || [],
      daevanion:    infoData?.daevanion?.boardList || [],
      ranking:      infoData?.ranking?.rankingList || [],
      titles:       infoData?.title?.titleList || [],
      // 스티그마 (장비에 있는 경우 vs info에 있는 경우)
      stigma:       infoData?.stigma?.stigmaList
                 || equipData?.stigma?.stigmaList
                 || equipData?.equipment?.stigmaList
                 || [],
      // 아르카나
      arcana:       infoData?.arcana?.arcanaList
                 || equipData?.arcana?.arcanaList
                 || [],
      // 펫/날개
      pet:          petSlot ? mapEquip(petSlot) : (infoData?.pet || null),
      wing:         wingSlot ? mapEquip(wingSlot) : (infoData?.wing || null),
      // API 응답 최상위 키 (디버깅용)
      _debug: {
        info_keys:  Object.keys(infoData  || {}),
        equip_keys: Object.keys(equipData || {}),
        equip_slot_names: equip.map(e => e.slotPosName),
        stat_types: (infoData?.stat?.statList || []).map(s => s.type),
        first_equip_keys: equip[0] ? Object.keys(equip[0]) : [],
      }
    });
  } catch (err) {
    res.status(500).json({ error: '조회 실패', detail: err.message });
  }
}
