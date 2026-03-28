// Supabase → Turso 데이터 마이그레이션
// 사용법: /api/db-migrate?confirm=migrate&table=members
// table 파라미터 없으면 모든 테이블 (타임아웃 위험)

const SB_URL = 'https://kyltdtasbhqjwbaapark.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bHRkdGFzYmhxandiYWFwYXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTM3NjQsImV4cCI6MjA5MDA4OTc2NH0.oTqSe1jO1rqXe2H8UHPeeoX2I9Hj3BrJTvs-RY4n2ho';

const ALL_TABLES = [
  { name: 'members',     order: 'combat_power.desc' },
  { name: 'notices',     order: 'created_at.asc' },
  { name: 'recruits',    order: 'created_at.asc' },
  { name: 'war_surveys', order: 'created_at.asc' },
  { name: 'boss_timers', order: null },
  { name: 'config',      order: null },
];

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const headers = { 'Content-Type': 'application/json' };

  if (url.searchParams.get('confirm') !== 'migrate') {
    return new Response(JSON.stringify({ error: '?confirm=migrate 파라미터 추가 후 실행하세요' }), { status: 400, headers });
  }

  const TURSO_URL = env.TURSO_URL;
  const TURSO_TOKEN = env.TURSO_TOKEN;
  if (!TURSO_URL || !TURSO_TOKEN) {
    return new Response(JSON.stringify({ error: 'TURSO_URL / TURSO_TOKEN 환경변수 미설정' }), { status: 500, headers });
  }

  // ?table=members 로 테이블 지정 가능
  const tableParam = url.searchParams.get('table');
  const targets = tableParam
    ? ALL_TABLES.filter(t => t.name === tableParam)
    : ALL_TABLES;

  if (targets.length === 0) {
    return new Response(JSON.stringify({ error: '알 수 없는 테이블: ' + tableParam }), { status: 400, headers });
  }

  const report = {};

  for (const { name, order } of targets) {
    try {
      // Turso 기존 데이터 확인
      const existing = await tursoQuery(`SELECT COUNT(*) as n FROM ${name}`, [], TURSO_URL, TURSO_TOKEN);
      if (existing?.data?.[0]?.n > 0) {
        report[name] = { skipped: true, existing: existing.data[0].n };
        continue;
      }

      // Supabase에서 데이터 가져오기
      const orderQs = order ? `&order=${order}` : '';
      const sbRes = await fetch(`${SB_URL}/rest/v1/${name}?select=*${orderQs}&limit=1000`, {
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
      });
      const rows = await sbRes.json();
      if (!Array.isArray(rows)) { report[name] = { error: JSON.stringify(rows) }; continue; }
      if (rows.length === 0) { report[name] = { inserted: 0 }; continue; }

      // Turso 일괄 삽입 (10개씩 배치)
      let inserted = 0, errors = 0;
      const BATCH = 10;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const requests = batch.map(row => {
          const cols = Object.keys(row).filter(k => row[k] !== undefined);
          const args = cols.map(c => serializeVal(row[c], c));
          return {
            type: 'execute',
            stmt: {
              sql: `INSERT OR IGNORE INTO ${name} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
              args: args.map(v => {
                if (v === null || v === undefined) return { type: 'null' };
                if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: String(v) };
                return { type: 'text', value: String(v) };
              })
            }
          };
        });
        requests.push({ type: 'close' });

        const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${TURSO_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests })
        });
        const d = await res.json();
        (d.results || []).forEach(r => {
          if (r.type === 'error') errors++;
          else if (r.type === 'ok' && r.response?.type === 'execute') inserted++;
        });
      }
      report[name] = { inserted, errors };
    } catch(e) {
      report[name] = { error: e.message };
    }
  }

  return new Response(JSON.stringify({ ok: true, report }), { headers });
}

function serializeVal(v, col) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (col === 'combat_power' || col === 'level' || col === 'slots' || col === 'views') return parseInt(v) || 0;
  return v;
}

async function tursoQuery(sql, args, url, token) {
  try {
    const res = await fetch(`${url}/v2/pipeline`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          { type: 'execute', stmt: { sql, args: [] } },
          { type: 'close' }
        ]
      })
    });
    const d = await res.json();
    const r = d.results?.[0];
    if (!r || r.type === 'error') return { data: null, error: r?.error?.message };
    const cols = (r.response?.result?.cols || []).map(c => c.name);
    const rows = (r.response?.result?.rows || []).map(row => {
      const obj = {};
      cols.forEach((col, i) => {
        const cell = row[i];
        if (!cell || cell.type === 'null') obj[col] = null;
        else if (cell.type === 'integer') obj[col] = parseInt(cell.value, 10);
        else if (cell.type === 'float') obj[col] = parseFloat(cell.value);
        else obj[col] = cell.value;
      });
      return obj;
    });
    return { data: rows, error: null };
  } catch(e) {
    return { data: null, error: e.message };
  }
}
