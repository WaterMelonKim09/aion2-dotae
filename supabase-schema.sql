-- ================================================================
-- 아이온2 도태 — Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에서 전체 실행하세요
-- ================================================================

-- members 테이블
CREATE TABLE IF NOT EXISTS members (
  id              TEXT PRIMARY KEY,
  nickname        TEXT,
  server          TEXT,
  rank            TEXT DEFAULT '',
  intro           TEXT DEFAULT '',
  is_main         BOOLEAN DEFAULT true,
  player_id       TEXT,
  class           TEXT DEFAULT '',
  level           INTEGER DEFAULT 0,
  combat_power    BIGINT DEFAULT 0,
  item_level      BIGINT DEFAULT 0,
  equipment       JSONB DEFAULT '[]',
  stats           JSONB DEFAULT '[]',
  daevanion       JSONB DEFAULT '[]',
  ranking         JSONB DEFAULT '[]',
  stigma          JSONB DEFAULT '[]',
  arcana          JSONB DEFAULT '[]',
  pet             JSONB,
  wing            JSONB,
  server_name     TEXT DEFAULT '',
  guild_name      TEXT DEFAULT '',
  race            TEXT DEFAULT '',
  profile_img     TEXT DEFAULT '',
  character_id    TEXT DEFAULT '',
  last_synced     TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- recruits 테이블
CREATE TABLE IF NOT EXISTS recruits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT,
  type        TEXT DEFAULT '던전',
  author      TEXT,
  reqs        JSONB DEFAULT '[]',
  min_cp      TEXT DEFAULT '',
  slots       INTEGER DEFAULT 4,
  schedule    TEXT DEFAULT '',
  description TEXT DEFAULT '',
  applies     JSONB DEFAULT '[]',
  comments    JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- notices 테이블
CREATE TABLE IF NOT EXISTS notices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT,
  content     TEXT,
  author      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- war_surveys 테이블
CREATE TABLE IF NOT EXISTS war_surveys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT,
  deadline    TEXT DEFAULT '',
  responses   JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- boss_timers 테이블
CREATE TABLE IF NOT EXISTS boss_timers (
  id          TEXT PRIMARY KEY,
  kill_time   BIGINT,
  updated_at  TEXT
);

-- config 테이블
CREATE TABLE IF NOT EXISTS config (
  key             TEXT PRIMARY KEY,
  latest_version  TEXT DEFAULT '',
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- RLS (Row Level Security) 활성화 + 공개 접근 허용
-- ================================================================
ALTER TABLE members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruits    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE war_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE boss_timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE config      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON members     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON recruits    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON notices     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON war_surveys FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON boss_timers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON config      FOR ALL TO anon USING (true) WITH CHECK (true);
