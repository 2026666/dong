-- =============================================================================
-- 三国冰河 · 盟战统计 —— Supabase 数据库结构
-- 用法：Supabase Dashboard → SQL Editor → 粘贴本文件全部内容 → Run（可重复执行）
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. profiles：账号档案（账号名、角色、注册时间、最后活跃）
--    · 由触发器在 auth.users 插入时自动创建
--    · 第一个注册的账号自动成为管理员（admin）
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null,
  role        text not null default 'member' check (role in ('member', 'admin')),
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz
);

create unique index if not exists profiles_username_key on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- 不开放任何 update 权限：用户无法篡改自己的 role（last_seen 走下面的函数）

-- -----------------------------------------------------------------------------
-- 2. 注册触发器：建 profile，并让第一个用户成为管理员
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
  first_user boolean;
begin
  uname := coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1));

  select count(*) = 0 into first_user from public.profiles;

  insert into public.profiles (id, username, role)
  values (new.id, uname, case when first_user then 'admin' else 'member' end)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 3. user_data：每个账号一份业务数据（名单 / 战报 / 规则）
--    payload 形如 { players: [...], battles: [...], config: {...} }
-- -----------------------------------------------------------------------------
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  payload    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "user_data_select_own" on public.user_data;
create policy "user_data_select_own" on public.user_data
  for select using (auth.uid() = user_id);

drop policy if exists "user_data_insert_own" on public.user_data;
create policy "user_data_insert_own" on public.user_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_data_update_own" on public.user_data;
create policy "user_data_update_own" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 4. page_views：页面访问记录（用于控制台的访问统计）
--    只允许写入自己的记录，读取只能通过 admin_stats()
-- -----------------------------------------------------------------------------
create table if not exists public.page_views (
  id         bigserial primary key,
  user_id    uuid references auth.users (id) on delete cascade,
  path       text not null,
  created_at timestamptz not null default now()
);

create index if not exists page_views_created_at_idx on public.page_views (created_at desc);
create index if not exists page_views_user_idx on public.page_views (user_id, created_at desc);

alter table public.page_views enable row level security;

drop policy if exists "page_views_insert_own" on public.page_views;
create policy "page_views_insert_own" on public.page_views
  for insert with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 5. touch_profile()：登录后更新「最后活跃时间」
-- -----------------------------------------------------------------------------
create or replace function public.touch_profile()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

revoke all on function public.touch_profile() from public;
grant execute on function public.touch_profile() to authenticated;

-- -----------------------------------------------------------------------------
-- 6. admin_stats()：控制台数据（只有 admin 能调用，否则报 not authorized）
--    返回 JSON：注册数、访问量、7 日趋势、页面 Top、用户列表
-- -----------------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
  result jsonb;
begin
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) into is_admin;

  if not is_admin then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'today',
      jsonb_build_object(
        'registrations', (select count(*) from auth.users u where u.created_at >= date_trunc('day', now())),
        'views',         (select count(*) from public.page_views v where v.created_at >= date_trunc('day', now())),
        'visitors',      (select count(distinct v.user_id) from public.page_views v where v.created_at >= date_trunc('day', now())),
        'battles',       (select coalesce(sum(jsonb_array_length(coalesce(ud.payload -> 'battles', '[]'::jsonb))), 0) from public.user_data ud)
      ),
    'total',
      jsonb_build_object(
        'registrations', (select count(*) from auth.users),
        'users',         (select count(*) from public.profiles),
        'views',         (select count(*) from public.page_views),
        'dataBytes',     (select coalesce(sum(length(ud.payload::text)), 0) from public.user_data ud)
      ),
    'yesterday',
      jsonb_build_object(
        'registrations', (select count(*) from auth.users u
                           where u.created_at >= date_trunc('day', now()) - interval '1 day'
                             and u.created_at <  date_trunc('day', now())),
        'views',         (select count(*) from public.page_views v
                           where v.created_at >= date_trunc('day', now()) - interval '1 day'
                             and v.created_at <  date_trunc('day', now()))
      ),
    'registrationTrend', (
      select coalesce(jsonb_agg(jsonb_build_object('day', to_char(d, 'MM-DD'), 'value', coalesce(c, 0)) order by d), '[]'::jsonb)
      from generate_series(current_date - 6, current_date, interval '1 day') d
      left join (
        select date_trunc('day', created_at) as day, count(*) as c
        from auth.users group by 1
      ) u on u.day = d
    ),
    'viewTrend', (
      select coalesce(jsonb_agg(jsonb_build_object('day', to_char(d, 'MM-DD'), 'value', coalesce(c, 0)) order by d), '[]'::jsonb)
      from generate_series(current_date - 6, current_date, interval '1 day') d
      left join (
        select date_trunc('day', created_at) as day, count(*) as c
        from public.page_views group by 1
      ) v on v.day = d
    ),
    'topPaths', (
      select coalesce(jsonb_agg(jsonb_build_object('path', t.path, 'count', t.c) order by t.c desc), '[]'::jsonb)
      from (
        select path, count(*) as c
        from public.page_views
        where created_at >= now() - interval '7 days'
        group by path
        order by c desc
        limit 8
      ) t
    ),
    'users', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'role', p.role,
        'createdAt', p.created_at,
        'lastSeenAt', p.last_seen_at,
        'players', coalesce(jsonb_array_length(ud.payload -> 'players'), 0),
        'battles', coalesce(jsonb_array_length(ud.payload -> 'battles'), 0),
        'bytes', coalesce(length(ud.payload::text), 0)
      ) order by p.created_at desc), '[]'::jsonb)
      from public.profiles p
      left join public.user_data ud on ud.user_id = p.id
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_stats() from public;
grant execute on function public.admin_stats() to authenticated;
