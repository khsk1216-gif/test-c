-- Additive upgrade for the existing Moa transactions table.
create table public.moa_budgets (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 month date not null check (extract(day from month)=1),
 amount integer not null check(amount>0),
 primary key(user_id,month)
);
create table public.moa_recurring (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 1 and 120),
 amount integer not null check(amount>0),
 type text not null check(type in ('income','expense')),
 category text not null check(category in ('용돈','아르바이트','식비','간식','교통','쇼핑','문화생활','저축','기타')),
 memo text not null default '' check(char_length(memo)<=500),
 start_date date not null check(start_date between date '2000-01-01' and date '2100-12-31'),
 due_day integer not null check(due_day between 1 and 31),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(id,user_id)
);
create index moa_recurring_user_idx on public.moa_recurring(user_id,active);
alter table public.transactions add column is_deleted boolean not null default false;
alter table public.transactions add column recurring_id uuid;
alter table public.transactions add column occurrence_month date;
alter table public.transactions add constraint transactions_recurring_owner_fk foreign key(recurring_id,user_id) references public.moa_recurring(id,user_id);
alter table public.transactions add constraint transactions_recurring_month_unique unique(recurring_id,occurrence_month);
alter table public.transactions add constraint transactions_occurrence_pair check((recurring_id is null and occurrence_month is null) or (recurring_id is not null and occurrence_month is not null and extract(day from occurrence_month)=1));
create policy "Users can update their own transactions" on public.transactions for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
alter table public.moa_budgets enable row level security;
alter table public.moa_recurring enable row level security;
create policy moa_budget_owner on public.moa_budgets for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy moa_recurring_owner on public.moa_recurring for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
revoke all on public.transactions,public.moa_budgets,public.moa_recurring from anon,authenticated;
grant select,insert,update on public.transactions,public.moa_budgets,public.moa_recurring to authenticated;

create or replace function public.moa_sync_recurring() returns integer
language plpgsql security invoker set search_path='' as $$
declare inserted integer; today date := (now() at time zone 'Asia/Seoul')::date;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform 1 from public.moa_recurring r where r.user_id=(select auth.uid()) and r.active for update;
 insert into public.transactions(user_id,title,category,amount,type,date,memo,recurring_id,occurrence_month)
 select r.user_id,r.title,r.category,r.amount,r.type,d.due_date,r.memo,r.id,m.month::date
 from public.moa_recurring r
 cross join lateral generate_series(date_trunc('month',r.start_date::timestamp),date_trunc('month',today::timestamp),interval '1 month') m(month)
 cross join lateral (select (m.month+make_interval(days=>least(r.due_day,extract(day from(m.month+interval '1 month - 1 day'))::integer)-1))::date as due_date) d
 where r.user_id=(select auth.uid()) and r.active and d.due_date between r.start_date and today
 on conflict(recurring_id,occurrence_month) do nothing;
 get diagnostics inserted=row_count;
 return inserted;
end $$;
revoke execute on function public.moa_sync_recurring() from public,anon;
grant execute on function public.moa_sync_recurring() to authenticated;
create index transactions_recurring_owner_idx on public.transactions(recurring_id,user_id);
