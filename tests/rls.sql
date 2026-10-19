-- Ephemeral integration fixtures. Everything rolls back, including auth users.
begin;
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000a01','moa-a@example.invalid'),('00000000-0000-4000-8000-000000000b01','moa-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000a01","role":"authenticated"}',true);
insert into public.moa_budgets(month,amount) values(date '2099-01-01',100000);
insert into public.moa_recurring(id,title,amount,type,category,start_date,due_day) values('00000000-0000-4000-8000-000000000c01','test recurring',1000,'income','용돈',(date_trunc('month',now() at time zone 'Asia/Seoul')-interval '2 month')::date,31);
select public.moa_sync_recurring();
do $$ declare expected integer; begin
 expected:=case when (now() at time zone 'Asia/Seoul')::date=(date_trunc('month',now() at time zone 'Asia/Seoul')+interval '1 month - 1 day')::date then 3 else 2 end;
 if (select count(*) from public.transactions where recurring_id='00000000-0000-4000-8000-000000000c01')<>expected then raise exception 'Recurring backfill failed'; end if;
 if public.moa_sync_recurring()<>0 then raise exception 'Duplicate recurrence'; end if;
end $$;
update public.transactions set is_deleted=true where recurring_id='00000000-0000-4000-8000-000000000c01';
do $$ begin if public.moa_sync_recurring()<>0 then raise exception 'Deleted rows revived'; end if; end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000b01","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.moa_budgets where user_id='00000000-0000-4000-8000-000000000a01') then raise exception 'Budget leaked'; end if;
 if exists(select 1 from public.moa_recurring where user_id='00000000-0000-4000-8000-000000000a01') then raise exception 'Rule leaked'; end if;
 if exists(select 1 from public.transactions where user_id='00000000-0000-4000-8000-000000000a01') then raise exception 'Transaction leaked'; end if;
 update public.transactions set amount=123 where user_id='00000000-0000-4000-8000-000000000a01';
 if found then raise exception 'Another user row changed'; end if;
 begin
  insert into public.moa_budgets(user_id,month,amount) values('00000000-0000-4000-8000-000000000a01',date '2099-02-01',99);
  raise exception 'Spoofed owner insert allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000a01","role":"authenticated"}',true);
do $$ begin
 begin
  update public.moa_budgets set user_id='00000000-0000-4000-8000-000000000b01' where month=date '2099-01-01';
  raise exception 'Owner reassignment allowed';
 exception when insufficient_privilege then null;
 end;
 if has_table_privilege('anon','public.transactions','SELECT') or has_table_privilege('authenticated','public.transactions','TRUNCATE') then raise exception 'Excessive privilege'; end if;
end $$;
select 'PASS: backfill, idempotency, deletion, RLS read/update/insert, owner reassignment and anonymous privileges' as test_result;
rollback;
