// 일회성 자동 마이그레이션 — 완료 후 이 파일 삭제 예정
const SB_REF   = 'kyltdtasbhqjwbaapark';
const SB_TOKEN = 'sbp_b10b6d1b191d6d44cfa61974e7ba0e56ac44e5b2';
const SB_API   = `https://api.supabase.com/v1/projects/${SB_REF}/database/query`;

const TABLES = [
  { name: 'members',     sql: `SELECT id,nickname,server,rank,intro,is_main,player_id,class,level,combat_power,item_level,server_name,guild_name,race,profile_img,character_id,last_synced,updated_at FROM members ORDER BY combat_power DESC` },
  { name: 'notices',     sql: `SELECT * FROM notices ORDER BY created_at ASC` },
  { name: 'recruits',    sql: `SELECT * FROM recruits ORDER BY created_at ASC` },
  { name: 'war_surveys', sql: `SELECT * FROM war_surveys ORDER BY created_at ASC` },
  { name: 'boss_timers', sql: `SELECT * FROM boss_timers` },
  { name: 'config',      sql: `SELECT * FROM config` },
];

const JSON_COLS = ['equipment','stats','daevanion','ranking','stigma','arcana','titles','pet','wing','reqs','applies','comments','responses'];
const INT_COLS  = ['combat_power','level','slots','views','is_main','kill_time'];

export async function onRequest(context) {
  const { env } = context;
  const headers = { 'Content-Type': 'application/json' };

  const TURSO_URL   = env.TURSO_URL;
  const TURSO_TOKEN = env.TURSO_TOKEN;
  if (!TURSO_URL || !TURSO_TOKEN) return new Response(JSON.stringify({ error: 'TURSO env 미설정' }), { status: 500, headers });

  const report = {};

  for (const { name, sql } of TABLES) {
    let offset = 0, totalInserted = 0, totalErrors = 0;

    while (true) {
      // Supabase Management API로 쿼리 (15건씩)
      let rows;
      try {
        const r = await fetch(SB_API, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SB_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `${sql} LIMIT 15 OFFSET ${offset}`, variables: [] })
        });
        rows = await r.json();
      } catch(e) {
        report[name] = { error: 'Supabase fetch 실패: ' + e.message }; break;
      }

      if (!Array.isArray(rows) || rows.length === 0) break;

      // Turso에 배치 삽입
      const requests = rows.map(row => {
        const cols = Object.keys(row).filter(k => row[k] !== null && row[k] !== undefined);
        const args = cols.map(c => {
          const v = row[c];
          if (v === null || v === undefined) return { type: 'null' };
          if (JSON_COLS.includes(c)) return { type: 'text', value: typeof v === 'string' ? v : JSON.stringify(v) };
          if (INT_COLS.includes(c)) return { type: 'integer', value: String(parseInt(v) || 0) };
          if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' };
          if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: String(v) };
          return { type: 'text', value: String(v) };
        });
        return { type: 'execute', stmt: { sql: `INSERT OR IGNORE INTO ${name} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`, args } };
      });
      requests.push({ type: 'close' });

      try {
        const tr = await fetch(`${TURSO_URL}/v2/pipeline`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${TURSO_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests })
        });
        const td = await tr.json();
        (td.results || []).forEach(r => {
          if (r.type === 'error') totalErrors++;
          else if (r.type === 'ok' && r.response?.type === 'execute') totalInserted++;
        });
      } catch(e) { totalErrors += rows.length; }

      offset += rows.length;
      if (rows.length < 15) break;
    }

    report[name] = { inserted: totalInserted, errors: totalErrors };
  }

  return new Response(JSON.stringify({ ok: true, report }), { headers });
}
