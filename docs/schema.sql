-- ============================================================================
-- second mind — 数据库结构（PostgreSQL / PostgREST 风格）
-- ----------------------------------------------------------------------------
-- 幂等：可以重复执行。
-- 在云环境的 SQL 控制台里整段运行即可。要求：
--   - 存在 `auth.uid()` 函数，返回当前登录用户 id（Supabase / WorkBuddy 云均自带）
--   - 角色 `anon` / `authenticated` 存在
-- ============================================================================

-- 0. 全局单调递增游标：所有增量同步都靠它
CREATE SEQUENCE IF NOT EXISTS sm_rev_seq AS BIGINT;

-- 1. 表 ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.identities (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id    TEXT NOT NULL DEFAULT auth.uid(),
  name        TEXT NOT NULL,
  color       INT  NOT NULL DEFAULT 0,
  sort_order  INT  NOT NULL DEFAULT 0,
  x           DOUBLE PRECISION,
  y           DOUBLE PRECISION,
  rev         BIGINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.nodes (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id    TEXT NOT NULL DEFAULT auth.uid(),
  identity_id BIGINT,
  parent_id   BIGINT,
  kind        TEXT NOT NULL DEFAULT 'skill',   -- skill|step|progress|todo|note|question
  title       TEXT NOT NULL DEFAULT '',
  note        TEXT,
  status      TEXT,                            -- todo: open|done
  progress    INT,                             -- 0..100
  x           DOUBLE PRECISION,
  y           DOUBLE PRECISION,
  collapsed   BOOLEAN NOT NULL DEFAULT false,
  rev         BIGINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.edges (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id    TEXT NOT NULL DEFAULT auth.uid(),
  source_id   BIGINT NOT NULL,
  source_kind TEXT NOT NULL DEFAULT 'node',    -- node|identity
  target_id   BIGINT NOT NULL,
  target_kind TEXT NOT NULL DEFAULT 'node',    -- node|identity
  kind        TEXT NOT NULL DEFAULT 'reference',
  label       TEXT,
  rev         BIGINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.devices (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id     TEXT NOT NULL DEFAULT auth.uid(),
  device_key   TEXT NOT NULL,
  label        TEXT,
  platform     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 days'),
  revoked_at   TIMESTAMPTZ,
  UNIQUE (owner_id, device_key)
);

-- 2. rev 触发器 --------------------------------------------------------------

CREATE OR REPLACE FUNCTION sm_touch() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  NEW.rev := nextval('sm_rev_seq');
  NEW.updated_at := now();
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS sm_touch_trg ON public.identities;
CREATE TRIGGER sm_touch_trg BEFORE INSERT OR UPDATE ON public.identities
  FOR EACH ROW EXECUTE FUNCTION sm_touch();

DROP TRIGGER IF EXISTS sm_touch_trg ON public.nodes;
CREATE TRIGGER sm_touch_trg BEFORE INSERT OR UPDATE ON public.nodes
  FOR EACH ROW EXECUTE FUNCTION sm_touch();

DROP TRIGGER IF EXISTS sm_touch_trg ON public.edges;
CREATE TRIGGER sm_touch_trg BEFORE INSERT OR UPDATE ON public.edges
  FOR EACH ROW EXECUTE FUNCTION sm_touch();

-- devices 没有 rev 列，不挂触发器

-- 3. 索引 --------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS identities_rev_idx  ON public.identities (owner_id, rev);
CREATE INDEX IF NOT EXISTS nodes_rev_idx       ON public.nodes      (owner_id, rev);
CREATE INDEX IF NOT EXISTS nodes_identity_idx  ON public.nodes      (owner_id, identity_id);
CREATE INDEX IF NOT EXISTS edges_rev_idx       ON public.edges      (owner_id, rev);
CREATE INDEX IF NOT EXISTS devices_owner_idx   ON public.devices    (owner_id, last_seen_at DESC);

-- 4. 行级隔离 ----------------------------------------------------------------
-- 每个账号只能读写 owner_id = auth.uid() 的行；未登录时 auth.uid() 为 NULL，
-- 所有策略都不成立，服务端不返回任何数据（不是前端隐藏）。

DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['identities', 'nodes', 'edges', 'devices'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated, anon', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_sel', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated, anon USING (owner_id = auth.uid())',
      t || '_sel', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_ins', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated, anon WITH CHECK (owner_id = auth.uid())',
      t || '_ins', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_upd', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated, anon USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())',
      t || '_upd', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_del', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated, anon USING (owner_id = auth.uid())',
      t || '_del', t);
  END LOOP;
END
$do$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

-- 5. 设备裁决 ----------------------------------------------------------------
-- 3 台上限与 15 天信任窗口必须在服务端判断，前端改不了。

CREATE OR REPLACE FUNCTION sm_claim_device(p_key text, p_label text, p_platform text)
RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE
  v_uid    text := auth.uid();
  v_id     bigint;
  v_rev    timestamptz;
  v_exp    timestamptz;
  v_others int;
  v_list   jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  -- 过期的信任窗口视为已注销
  UPDATE devices SET revoked_at = now()
   WHERE owner_id = v_uid AND revoked_at IS NULL AND expires_at < now();

  SELECT id, revoked_at INTO v_id, v_rev
    FROM devices WHERE owner_id = v_uid AND device_key = p_key;

  -- 已绑定且未注销：续期 / 刷新活跃时间
  IF v_id IS NOT NULL AND v_rev IS NULL THEN
    UPDATE devices
       SET last_seen_at = now(),
           label    = coalesce(p_label, label),
           platform = coalesce(p_platform, platform),
           expires_at = CASE WHEN expires_at < now() THEN now() + interval '15 days' ELSE expires_at END
     WHERE id = v_id;

    SELECT expires_at INTO v_exp FROM devices WHERE id = v_id;
    RETURN jsonb_build_object('status', 'ok', 'device_id', v_id, 'expires_at', v_exp);
  END IF;

  -- 新设备：检查是否已达 3 台
  SELECT count(*) INTO v_others
    FROM devices
   WHERE owner_id = v_uid AND revoked_at IS NULL AND expires_at > now() AND device_key <> p_key;

  IF v_others >= 3 THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'id', id, 'label', label, 'platform', platform, 'last_seen_at', last_seen_at
           ) ORDER BY last_seen_at DESC), '[]'::jsonb)
      INTO v_list
      FROM devices
     WHERE owner_id = v_uid AND revoked_at IS NULL AND expires_at > now() AND device_key <> p_key;

    RETURN jsonb_build_object('status', 'limit', 'devices', v_list);
  END IF;

  INSERT INTO devices (owner_id, device_key, label, platform)
  VALUES (v_uid, p_key, p_label, p_platform)
  ON CONFLICT (owner_id, device_key) DO UPDATE
     SET last_seen_at = now(),
         revoked_at   = NULL,
         expires_at   = now() + interval '15 days',
         label        = coalesce(excluded.label, devices.label),
         platform     = coalesce(excluded.platform, devices.platform)
  RETURNING id, expires_at INTO v_id, v_exp;

  RETURN jsonb_build_object('status', 'ok', 'device_id', v_id, 'expires_at', v_exp);
END
$fn$;

CREATE OR REPLACE FUNCTION sm_revoke_device(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE
  v_uid text := auth.uid();
  v_n   int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  UPDATE devices SET revoked_at = now()
   WHERE id = p_id AND owner_id = v_uid AND revoked_at IS NULL;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('status', 'ok', 'revoked', v_n);
END
$fn$;

REVOKE EXECUTE ON FUNCTION sm_claim_device(text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION sm_claim_device(text, text, text) TO authenticated, anon;

REVOKE EXECUTE ON FUNCTION sm_revoke_device(bigint) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION sm_revoke_device(bigint) TO authenticated, anon;
