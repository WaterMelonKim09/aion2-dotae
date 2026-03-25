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

    const profile = (infoData && infoData.profile) ? infoData.profile : {};
    const equip   = (equipData && equipData.equipment && equipData.equipment.equipmentList) ? equipData.equipment.equipmentList : [];

    const classMap = {
      'Gladiator':'검성','Templar':'수호성',
      'Assassin':'살성','Ranger':'궁성',
      'Sorcerer':'마도성','Spiritmaster':'정령성',
      'Cleric':'치유성','Chanter':'호법성',
    };

    const mapEquip = function(e) {
      return {
        name:        e.name || '',
        slot:        e.slotPosName || '',
        enchant:     e.enchantLevel || 0,
        exceed:      e.exceedLevel || 0,
        grade:       e.grade || '',
        icon:        e.icon || '',
        itemLevel:   e.itemLevel || 0,
        setName:     e.setItemName || '',
        itemStats:   (e.itemStat && e.itemStat.statList) ? e.itemStat.statList : [],
        itemOptions: (e.itemOption && e.itemOption.optionList) ? e.itemOption.optionList : [],
        itemSouls:   (e.soulCrystal && e.soulCrystal.crystalList) ? e.soulCrystal.crystalList : [],
        potential:   e.potential || null,
      };
    };

    const allSlotNames = equip.map(function(e) { return e.slotPosName; });

    const petSlot  = equip.find(function(e) {
      return ['Pet','pet','PET','펫'].indexOf(e.slotPosName) !== -1;
    });
    const wingSlot = equip.find(function(e) {
      return ['Wing','wing','WING','날개'].indexOf(e.slotPosName) !== -1;
    });

    const petData  = petSlot  ? mapEquip(petSlot)
                   : (equipData && equipData.pet  ? { name: equipData.pet.name||'', icon: equipData.pet.icon||'', grade: equipData.pet.grade||'' } : null);
    const wingData = wingSlot ? mapEquip(wingSlot)
                   : (equipData && equipData.wing ? { name: equipData.wing.name||'', icon: equipData.wing.icon||'', grade: equipData.wing.grade||'' } : null);

    var statList = (infoData && infoData.stat && infoData.stat.statList) ? infoData.stat.statList : [];
    var itemLevelStat = statList.find(function(s) { return s.type === 'ItemLevel'; });
    var itemLevel = itemLevelStat ? (itemLevelStat.value || 0) : 0;

    var stigmaList = (infoData && infoData.stigma && infoData.stigma.stigmaList) ? infoData.stigma.stigmaList
                   : (equipData && equipData.stigma && equipData.stigma.stigmaList) ? equipData.stigma.stigmaList : [];
    var arcanaList = (infoData && infoData.arcana && infoData.arcana.arcanaList) ? infoData.arcana.arcanaList
                   : (equipData && equipData.arcana && equipData.arcana.arcanaList) ? equipData.arcana.arcanaList : [];
    var daevList   = (infoData && infoData.daevanion && infoData.daevanion.boardList) ? infoData.daevanion.boardList : [];
    var rankList   = (infoData && infoData.ranking && infoData.ranking.rankingList) ? infoData.ranking.rankingList : [];
    var titleList  = (infoData && infoData.title && infoData.title.titleList) ? infoData.title.titleList : [];

    res.status(200).json({
      characterId:  rawId,
      serverId,
      nickname:     profile.characterName || '',
      class:        classMap[profile.className] || profile.className || '',
      level:        profile.characterLevel || 0,
      combat_power: profile.combatPower || 0,
      item_level:   itemLevel,
      server_name:  profile.serverName || '',
      guild_name:   profile.regionName || '',
      race:         profile.raceName   || '',
      profile_img:  profile.profileImage || '',
      equipment:    equip.map(mapEquip),
      stats:        statList,
      daevanion:    daevList,
      ranking:      rankList,
      titles:       titleList,
      stigma:       stigmaList,
      arcana:       arcanaList,
      pet:          petData,
      wing:         wingData,
      _debug: {
        all_slot_names: allSlotNames,
        equip_top_keys: Object.keys(equipData || {}),
        info_top_keys:  Object.keys(infoData  || {}),
        stigma_raw:     (infoData && infoData.stigma) ? infoData.stigma : ((equipData && equipData.stigma) ? equipData.stigma : 'NOT_FOUND'),
        skill_keys:     (infoData && infoData.skill) ? Object.keys(infoData.skill) : 'NOT_FOUND',
      }
    });
  } catch (err) {
    res.status(500).json({ error: '조회 실패', detail: err.message });
  }
}
