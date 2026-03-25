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

    const mapEquip = e => ({
      name:        e.name || '',
      slot:        e.slotPosName || '',
      enchant:     e.enchantLevel || 0,
      exceed:      e.exceedLevel || 0,
      grade:       e.grade || '',
      icon:        e.icon || '',
      itemLevel:   e.itemLevel || 0,
      setName:     e.setItemName || '',
      itemStats:   e.itemStat?.statList || e.statList || e.stats || [],
      itemOptions: e.itemOption?.optionList || e.optionList || e.options || [],
      itemSouls:   e.soulCrystal?.crystalList || e.crystalList || [],
      potential:   e.potential || null,
    });

    // 모든 슬롯 이름 수집 (디버그)
    const allSlotNames = equip.map(e => e.slotPosName);

    // 펫/날개 - 다양한 슬롯명 시도
    const petSlot  = equip.find(e =>
      ['Pet','pet','PET','펫'].includes(e.slotPosName) ||
      (e.slotType && ['Pet','pet'].includes(e.slotType))
    );
    const wingSlot = equip.find(e =>
      ['Wing','wing','WING','날개'].includes(e.slotPosName) ||
      (e.slotType && ['Wing','wing'].includes(e.slotType))
    );

    // 펫/날개가 equipment에 없으면 equipData 최상위에서 찾기
    const petData  = petSlot  ? mapEquip(petSlot)
                   : (equipData?.pet  ? { name: equipData.pet.name||'', icon: equipData.pet.icon||'', grade: equipData.pet.grade||'' } : null);
    const wingData = wingSlot ? mapEquip(wingSlot)
                   : (equipData?.wing ? { name: equipData.wing.name||'', icon: equipData.wing.icon||'', grade: equipData.wing.grade||'' } : null);

    res.status(200).json({
      characterId: rawId,
      serverId,
      nickname:     profile.characterName || '',
      class:        classMap[profile.className] || profile.className || '',
      level:        profile.characterLevel || 0,
      combat_power: profile.combatPower || 0,
      item_level:   (infoData && infoData.stat && infoData.stat.statList ? infoData.stat.statList : null)?.find(s => s.type === 'ItemLevel')?.value || 0) || 0,
      server_name:  profile.serverName || '',
      guild_name:   profile.regionName || '',
      race:         profile.raceName   || '',
      profile_img:  profile.profileImage || '',
      equipment:    equip.map(mapEquip),
      stats:        (infoData && infoData.stat && infoData.stat.statList ? infoData.stat.statList : null) || [],
      daevanion:    (infoData && infoData.daevanion && infoData.daevanion.boardList ? infoData.daevanion.boardList : null) || [],
      ranking:      (infoData && infoData.ranking && infoData.ranking.rankingList ? infoData.ranking.rankingList : null) || [],
      titles:       (infoData && infoData.title && infoData.title.titleList ? infoData.title.titleList : null) || [],
      stigma:       (infoData && infoData.stigma && infoData.stigma.stigmaList ? infoData.stigma.stigmaList : null) || (equipData && equipData.stigma && equipData.stigma.stigmaList ? equipData.stigma.stigmaList : null) || [],
      arcana:       (infoData && infoData.arcana && infoData.arcana.arcanaList ? infoData.arcana.arcanaList : null) || (equipData && equipData.arcana && equipData.arcana.arcanaList ? equipData.arcana.arcanaList : null) || [],
      pet:          petData,
      wing:         wingData,
      // 디버그
      _debug: {
        all_slot_names:  allSlotNames,
        equip_top_keys:  Object.keys(equipData || {}),
        info_top_keys:   Object.keys(infoData  || {}),
        stigma_raw:      (infoData && infoData.stigma ? infoData.stigma : null) || (equipData && equipData.stigma ? equipData.stigma : null) || 'NOT_FOUND',
        skill_raw:       (infoData && infoData.skill ? infoData.skill : null)  || (infoData && infoData.skill ? infoData.skill : null)s  || 'NOT_FOUND',
      }
    });
  } catch (err) {
    res.status(500).json({ error: '조회 실패', detail: err.message });
  }
}
