-- ============================================================================
-- DEV database roles — the two-role pattern from schema.sql §21
-- ============================================================================
-- relos_auth: bootstrap only (token/slug -> tenant + role resolution).
--             BYPASSRLS here is a dev convenience; production narrows this
--             (security-definer lookup functions or explicit policies).
-- relos_app : all tenant work; RLS-bound, sets app.tenant_id per transaction.
-- Run against the app database (e.g. `relos`) after schema.sql.
-- ============================================================================

do $$
begin
  if not exists (select from pg_roles where rolname = 'relos_auth') then
    create role relos_auth login password 'auth';
  end if;
  if not exists (select from pg_roles where rolname = 'relos_app') then
    create role relos_app login password 'app';
  end if;
end $$;

alter role relos_auth bypassrls;

grant usage on schema public to relos_auth, relos_app;
grant select on users, memberships, roles, teams, tenants, tenant_settings to relos_auth;
grant select, insert, update, delete on all tables in schema public to relos_app;
grant usage, select on all sequences in schema public to relos_app;
