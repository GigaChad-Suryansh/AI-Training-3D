-- AI Training 3D hub: run this once in the Supabase SQL editor.
-- Anyone can read. Only signed-in people can publish, and only as themselves.

create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('environment', 'agent')),
  title       text not null check (char_length(title) between 1 and 60),
  description text not null default '' check (char_length(description) <= 400),
  author_id   uuid not null references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) <= 60),
  payload     jsonb not null check (octet_length(payload::text) <= 60000),
  likes       integer not null default 0 check (likes >= 0),
  created_at  timestamptz not null default now()
);
create index if not exists items_created_idx on public.items (created_at desc);

create table if not exists public.likes (
  item_id uuid not null references public.items (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (item_id, user_id)
);

alter table public.items enable row level security;
alter table public.likes enable row level security;

create policy "anyone can read items" on public.items for select using (true);
create policy "members publish as themselves" on public.items for insert to authenticated
  with check (author_id = auth.uid() and likes = 0);
create policy "authors delete their items" on public.items for delete to authenticated
  using (author_id = auth.uid());
create policy "members see their own likes" on public.likes for select to authenticated using (user_id = auth.uid());

-- Simple rate limit: at most 10 items per author per hour.
create or replace function public.limit_publishing() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.items where author_id = new.author_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'publishing too fast';
  end if;
  return new;
end $$;
drop trigger if exists items_rate_limit on public.items;
create trigger items_rate_limit before insert on public.items for each row execute function public.limit_publishing();

-- Like or unlike in one step. The count is changed only here, never by the client.
create or replace function public.toggle_like(item uuid) returns json language plpgsql security definer set search_path = public as $$
declare had boolean; n integer;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  select exists (select 1 from public.likes where item_id = item and user_id = auth.uid()) into had;
  if had then
    delete from public.likes where item_id = item and user_id = auth.uid();
    update public.items set likes = greatest(likes - 1, 0) where id = item returning likes into n;
  else
    insert into public.likes (item_id, user_id) values (item, auth.uid());
    update public.items set likes = likes + 1 where id = item returning likes into n;
  end if;
  return json_build_object('liked', not had, 'likes', n);
end $$;
revoke all on function public.toggle_like(uuid) from public;
grant execute on function public.toggle_like(uuid) to authenticated;
