-- Schedule: secure role management RPCs
-- Run in Supabase SQL Editor as project owner/admin.

-- Add a default role row for every existing profile/user. Existing admin role is preserved.
insert into public.user_roles (user_id, role)
select u.id, 'user'
from auth.users u
on conflict (user_id) do nothing;

create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  display_name text,
  group_id text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid() and r.role = 'admin'
  ) then
    raise exception 'Forbidden: admin role required';
  end if;

  return query
  select u.id, u.email::text, p.display_name, p.group_id,
         coalesce(r.role, 'user'), u.created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.user_roles r on r.user_id = u.id
  order by u.created_at desc;
end;
$$;

create or replace function public.admin_set_user_role(
  target_user_id uuid,
  new_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid() and r.role = 'admin'
  ) then
    raise exception 'Forbidden: admin role required';
  end if;

  if new_role not in ('user', 'leader', 'admin') then
    raise exception 'Invalid role';
  end if;

  if target_user_id = auth.uid() and new_role <> 'admin' then
    raise exception 'You cannot remove your own admin role here';
  end if;

  if not exists (select 1 from auth.users u where u.id = target_user_id) then
    raise exception 'User not found';
  end if;

  insert into public.user_roles (user_id, role)
  values (target_user_id, new_role)
  on conflict (user_id) do update set role = excluded.role;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_set_user_role(uuid, text) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
