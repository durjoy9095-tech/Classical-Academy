-- =====================================================================
-- Classical Academy - Supabase schema (PostgreSQL + RLS + Storage)
-- Run this whole file once in: Supabase Dashboard > SQL Editor.
-- It is safe to re-run (policies are dropped and recreated).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  username text unique check (username ~ '^[a-z0-9_]{3,30}$'),
  email text,
  mobile text,
  class_level int check (class_level between 6 and 10),
  group_name text check (group_name in ('science','humanities','business')),
  avatar_url text,
  role text not null default 'student'
    check (role in ('super_admin','admin','moderator','teacher','student')),
  created_at timestamptz not null default now(),
  check (group_name is null or class_level >= 9)
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  is_published boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  class_level int check (class_level between 6 and 10),
  created_at timestamptz not null default now()
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null,
  avatar_url text,
  subject text,
  qualification text,
  experience text,
  bio text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  class_level int not null check (class_level between 6 and 10),
  group_name text check (group_name in ('science','humanities','business')),
  subject_id uuid references public.subjects(id) on delete set null,
  teacher_id uuid references public.teachers(id) on delete set null,
  price numeric(10,2) not null default 0 check (price >= 0),
  thumbnail_url text,
  featured boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  kind text not null default 'video' check (kind in ('video','live','note')),
  video_url text,
  live_at timestamptz,
  position int not null default 0,
  is_preview boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists public.lesson_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  kind text not null default 'book'
    check (kind in ('book','pdf','notes','slides','material','course')),
  price numeric(10,2) not null default 0 check (price >= 0),
  image_url text,
  file_path text,                                   -- private-files bucket path
  course_id uuid unique references public.courses(id) on delete cascade,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.books (            -- free digital library
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  description text,
  class_level int check (class_level between 6 and 10),
  subject_id uuid references public.subjects(id) on delete set null,
  cover_url text,
  file_path text not null,                          -- private-files bucket path
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  qty int not null default 1 check (qty between 1 and 20),
  primary key (user_id, product_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  total numeric(10,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  payment_method text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  price numeric(10,2) not null,
  qty int not null default 1
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null,
  method text,
  trx_id text,
  sender_number text,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('book','course','product')),
  item_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  class_level int not null check (class_level between 6 and 10),
  group_name text check (group_name in ('science','humanities','business')),
  subject_id uuid references public.subjects(id) on delete set null,
  kind text not null default 'mcq' check (kind in ('mcq','written','mixed')),
  start_at timestamptz,
  end_at timestamptz,
  duration_minutes int not null default 30 check (duration_minutes > 0),
  total_marks numeric not null default 0,           -- maintained by trigger
  pass_marks numeric not null default 0,
  is_published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  kind text not null default 'mcq' check (kind in ('mcq','written')),
  body text not null,
  options jsonb,                                    -- ["A","B","C","D"] for mcq
  correct_index int,                                -- 0-based, mcq only (never sent to students)
  marks numeric not null default 1,
  position int not null default 0
);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  answers jsonb not null default '{}'::jsonb,
  mcq_score numeric,
  written_score numeric,
  total_score numeric generated always as (coalesce(mcq_score,0) + coalesce(written_score,0)) stored,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','graded')),
  unique (exam_id, user_id)
);

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  kind text not null default 'support' check (kind in ('support','doubt')),
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open','answered','closed')),
  reply text,
  replied_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  label text,
  last_seen timestamptz not null default now(),
  unique (user_id, device_id)
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_courses_class on public.courses(class_level, is_published);
create index if not exists idx_lessons_course on public.lessons(course_id, position);
create index if not exists idx_enroll_user on public.enrollments(user_id);
create index if not exists idx_orders_user on public.orders(user_id, created_at desc);
create index if not exists idx_attempts_user on public.exam_attempts(user_id);
create index if not exists idx_questions_exam on public.questions(exam_id, position);
create index if not exists idx_activity_user on public.activity_log(user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 2. ROLE HELPER FUNCTIONS (security definer, used by RLS policies)
-- ---------------------------------------------------------------------
create or replace function public.auth_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_super() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.auth_role() = 'super_admin', false) $$;

create or replace function public.is_admin_up() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.auth_role() in ('super_admin','admin'), false) $$;

create or replace function public.is_mod_up() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.auth_role() in ('super_admin','admin','moderator'), false) $$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.auth_role() in ('super_admin','admin','moderator','teacher'), false) $$;

create or replace function public.owns_teacher(tid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.teachers t where t.id = tid and t.profile_id = auth.uid()) $$;

create or replace function public.teaches_course(cid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.courses c join public.teachers t on t.id = c.teacher_id
                 where c.id = cid and t.profile_id = auth.uid()) $$;

create or replace function public.manages_exam(eid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select public.is_admin_up() or exists(select 1 from public.exams e
      where e.id = eid and e.created_by = auth.uid() and public.auth_role() = 'teacher') $$;

create or replace function public.has_course_access(cid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select public.is_staff() or exists(
     select 1 from public.enrollments e join public.courses c on c.id = e.course_id
     where e.course_id = cid and e.user_id = auth.uid() and c.is_published) $$;

-- ---------------------------------------------------------------------
-- 3. TRIGGERS
-- ---------------------------------------------------------------------
-- Create a profile for every new auth user (email or Google). Role is ALWAYS 'student'.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  uname text := lower(nullif(m->>'username',''));
  cl int; gr text;
begin
  if uname is null or uname !~ '^[a-z0-9_]{3,30}$'
     or exists(select 1 from public.profiles where username = uname) then
    uname := 'user_' || substr(replace(new.id::text,'-',''),1,10);
  end if;
  begin cl := nullif(m->>'class_level','')::int; exception when others then cl := null; end;
  if cl is not null and cl not between 6 and 10 then cl := null; end if;
  gr := nullif(m->>'group_name','');
  if gr is not null and (cl is null or cl < 9 or gr not in ('science','humanities','business')) then gr := null; end if;
  insert into public.profiles(id, full_name, username, email, mobile, class_level, group_name, avatar_url)
  values (new.id,
          coalesce(nullif(m->>'full_name',''), nullif(m->>'name',''), split_part(new.email,'@',1)),
          uname, new.email, nullif(m->>'mobile',''), cl, gr,
          coalesce(m->>'avatar_url', m->>'picture'));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only a Super Admin may change roles; nobody can edit their own privileges.
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then            -- SQL editor / service role (uid null) is allowed
    if new.role is distinct from old.role and not public.is_super() then
      raise exception 'role change not allowed';
    end if;
    if new.id is distinct from old.id then raise exception 'id is immutable'; end if;
    if not public.is_admin_up() then new.email := old.email; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_profile on public.profiles;
create trigger trg_guard_profile before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Paid courses automatically get a store product.
create or replace function public.sync_course_product() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.price > 0 then
    insert into public.products(title, description, kind, price, image_url, course_id, is_published)
    values (new.title, new.description, 'course', new.price, new.thumbnail_url, new.id, new.is_published)
    on conflict (course_id) do update set title = excluded.title, description = excluded.description,
      price = excluded.price, image_url = excluded.image_url, is_published = excluded.is_published;
  else
    update public.products set is_published = false where course_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_course_product on public.courses;
create trigger trg_course_product after insert or update on public.courses
  for each row execute function public.sync_course_product();

-- Keep exams.total_marks in sync with its questions.
create or replace function public.refresh_exam_total() returns trigger
language plpgsql security definer set search_path = public as $$
declare eid uuid := coalesce(new.exam_id, old.exam_id);
begin
  update public.exams set total_marks =
    (select coalesce(sum(marks),0) from public.questions where exam_id = eid) where id = eid;
  return null;
end $$;

drop trigger if exists trg_questions_total on public.questions;
create trigger trg_questions_total after insert or update or delete on public.questions
  for each row execute function public.refresh_exam_total();

-- ---------------------------------------------------------------------
-- 4. VIEW: questions WITHOUT answers, only during the student's own live attempt
-- ---------------------------------------------------------------------
create or replace view public.questions_public as
  select q.id, q.exam_id, q.kind, q.body, q.options, q.marks, q.position
  from public.questions q
  where exists (select 1 from public.exam_attempts a
                where a.exam_id = q.exam_id and a.user_id = auth.uid() and a.status = 'in_progress');

-- ---------------------------------------------------------------------
-- 5. RPC FUNCTIONS
-- ---------------------------------------------------------------------
create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as
$$ select not exists(select 1 from public.profiles where username = lower(p_username)) $$;

-- internal: mark an order paid and grant purchased courses
create or replace function public.fulfill_order(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order;
  if not found then return; end if;
  update public.orders set status = 'paid' where id = p_order;
  update public.payments set status = 'verified' where order_id = p_order;
  insert into public.enrollments(user_id, course_id)
    select o.user_id, p.course_id from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order and p.course_id is not null
    on conflict do nothing;
end $$;

create or replace function public.checkout(p_method text, p_trx text, p_phone text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); oid uuid; total numeric;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.cart_items c join public.products p on p.id = c.product_id
                 where c.user_id = uid and p.is_published) then
    raise exception 'cart empty';
  end if;
  select coalesce(sum(p.price * c.qty),0) into total
    from public.cart_items c join public.products p on p.id = c.product_id
    where c.user_id = uid and p.is_published;
  if total > 0 and (coalesce(trim(p_trx),'') = '' or p_method not in ('bkash','nagad','rocket','other')) then
    raise exception 'payment info required';
  end if;
  insert into public.orders(user_id, total, status, payment_method)
    values (uid, total, 'pending', case when total > 0 then p_method end) returning id into oid;
  insert into public.order_items(order_id, product_id, price, qty)
    select oid, p.id, p.price, c.qty from public.cart_items c
    join public.products p on p.id = c.product_id where c.user_id = uid and p.is_published;
  insert into public.payments(order_id, user_id, amount, method, trx_id, sender_number, status)
    values (oid, uid, total, case when total > 0 then p_method end, nullif(trim(p_trx),''),
            nullif(trim(p_phone),''), 'pending');
  delete from public.cart_items where user_id = uid;
  if total = 0 then perform public.fulfill_order(oid); end if;
  return oid;
end $$;

create or replace function public.confirm_order(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_up() then raise exception 'not allowed'; end if;
  perform public.fulfill_order(p_order);
end $$;

create or replace function public.reject_order(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_up() then raise exception 'not allowed'; end if;
  update public.orders set status = 'cancelled' where id = p_order and status = 'pending';
  update public.payments set status = 'rejected' where order_id = p_order and status = 'pending';
end $$;

create or replace function public.start_exam(p_exam uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e public.exams; a public.exam_attempts;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into e from public.exams where id = p_exam and is_published;
  if not found then raise exception 'exam not available'; end if;
  select * into a from public.exam_attempts where exam_id = p_exam and user_id = auth.uid();
  if not found then
    if e.start_at is not null and now() < e.start_at then raise exception 'exam not started'; end if;
    if e.end_at is not null and now() > e.end_at then raise exception 'exam ended'; end if;
    insert into public.exam_attempts(exam_id, user_id) values (p_exam, auth.uid()) returning * into a;
  end if;
  return jsonb_build_object('attempt', to_jsonb(a), 'duration_minutes', e.duration_minutes, 'server_now', now());
end $$;

create or replace function public.submit_exam(p_attempt uuid, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.exam_attempts; e public.exams; sc numeric; has_written boolean;
begin
  select * into a from public.exam_attempts where id = p_attempt and user_id = auth.uid() for update;
  if not found then raise exception 'exam not available'; end if;
  if a.status <> 'in_progress' then raise exception 'already submitted'; end if;
  select * into e from public.exams where id = a.exam_id;
  if now() > a.started_at + make_interval(mins => e.duration_minutes) + interval '45 seconds' then
    p_answers := '{}'::jsonb;                         -- too late: answers discarded
  end if;
  select coalesce(sum(q.marks),0) into sc from public.questions q
    where q.exam_id = a.exam_id and q.kind = 'mcq'
      and jsonb_typeof(p_answers -> q.id::text) = 'number'
      and (p_answers ->> q.id::text)::int = q.correct_index;
  select exists(select 1 from public.questions where exam_id = a.exam_id and kind = 'written') into has_written;
  update public.exam_attempts set answers = p_answers, submitted_at = now(), mcq_score = sc,
      written_score = case when has_written then null else 0 end,
      status = case when has_written then 'submitted' else 'graded' end
    where id = p_attempt returning * into a;
  return to_jsonb(a);
end $$;

create or replace function public.exam_review(p_attempt uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.exam_attempts;
begin
  select * into a from public.exam_attempts where id = p_attempt and user_id = auth.uid();
  if not found or a.status = 'in_progress' then raise exception 'exam not available'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'kind', q.kind, 'body', q.body,
            'options', q.options, 'marks', q.marks, 'correct_index', q.correct_index)
            order by q.position), '[]'::jsonb) from public.questions q where q.exam_id = a.exam_id);
end $$;

-- ---------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- profiles
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_mod_up() or (
    public.auth_role() = 'teacher' and exists (
      select 1 from public.enrollments e join public.courses c on c.id = e.course_id
      join public.teachers t on t.id = c.teacher_id
      where e.user_id = profiles.id and t.profile_id = auth.uid()))
  or (public.auth_role() = 'teacher' and exists (
      select 1 from public.exam_attempts a
      where a.user_id = profiles.id and public.manages_exam(a.exam_id))));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_super() or (public.is_admin_up() and role in ('student','teacher','moderator')))
  with check (public.is_super() or (public.is_admin_up() and role in ('student','teacher','moderator')));

-- site settings / content
create policy settings_read on public.site_settings for select to anon, authenticated using (true);
create policy settings_write on public.site_settings for all to authenticated
  using (public.is_super()) with check (public.is_super());

create policy ann_read on public.announcements for select to anon, authenticated
  using (is_published or public.is_mod_up());
create policy ann_write on public.announcements for all to authenticated
  using (public.is_mod_up()) with check (public.is_mod_up());

create policy subjects_read on public.subjects for select to anon, authenticated using (true);
create policy subjects_write on public.subjects for all to authenticated
  using (public.is_admin_up()) with check (public.is_admin_up());

create policy teachers_read on public.teachers for select to anon, authenticated using (true);
create policy teachers_admin on public.teachers for all to authenticated
  using (public.is_admin_up()) with check (public.is_admin_up());
create policy teachers_self on public.teachers for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- courses & lessons
create policy courses_read on public.courses for select to anon, authenticated
  using (is_published or public.is_staff());
create policy courses_write on public.courses for all to authenticated
  using (public.is_admin_up() or public.owns_teacher(teacher_id))
  with check (public.is_admin_up() or public.owns_teacher(teacher_id));

create policy lessons_read on public.lessons for select to authenticated
  using (public.has_course_access(course_id)
         or (is_preview and exists(select 1 from public.courses c where c.id = course_id and c.is_published)));
create policy lessons_write on public.lessons for all to authenticated
  using (public.is_admin_up() or public.teaches_course(course_id))
  with check (public.is_admin_up() or public.teaches_course(course_id));

create policy enroll_read on public.enrollments for select to authenticated
  using (user_id = auth.uid() or public.is_admin_up() or public.teaches_course(course_id));
create policy enroll_free on public.enrollments for insert to authenticated
  with check (user_id = auth.uid() and exists(
    select 1 from public.courses c where c.id = course_id and c.is_published and c.price = 0));
create policy enroll_delete_own on public.enrollments for delete to authenticated
  using ((user_id = auth.uid() and exists(select 1 from public.courses c where c.id = course_id and c.price = 0))
         or public.is_admin_up());
create policy enroll_admin_insert on public.enrollments for insert to authenticated
  with check (public.is_admin_up());

create policy progress_own on public.lesson_progress for all to authenticated
  using (user_id = auth.uid()) with check (
    user_id = auth.uid() and exists(select 1 from public.lessons l where l.id = lesson_id and public.has_course_access(l.course_id)));
create policy progress_staff on public.lesson_progress for select to authenticated using (public.is_staff());

-- store
create policy products_read on public.products for select to authenticated
  using (is_published or public.is_admin_up());
create policy products_write on public.products for all to authenticated
  using (public.is_admin_up()) with check (public.is_admin_up());

create policy books_read on public.books for select to authenticated
  using (is_published or public.is_staff());
create policy books_write on public.books for all to authenticated
  using (public.is_admin_up()) with check (public.is_admin_up());

create policy cart_own on public.cart_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy orders_read on public.orders for select to authenticated
  using (user_id = auth.uid() or public.is_admin_up());
create policy order_items_read on public.order_items for select to authenticated
  using (exists(select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin_up())));
create policy payments_read on public.payments for select to authenticated
  using (user_id = auth.uid() or public.is_admin_up());

create policy bookmarks_own on public.bookmarks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- exams
create policy exams_read on public.exams for select to authenticated
  using (is_published or public.is_staff());
create policy exams_insert on public.exams for insert to authenticated
  with check (public.is_admin_up() or (public.auth_role() = 'teacher' and created_by = auth.uid()));
create policy exams_update on public.exams for update to authenticated
  using (public.manages_exam(id)) with check (public.manages_exam(id));
create policy exams_delete on public.exams for delete to authenticated using (public.manages_exam(id));

create policy questions_staff on public.questions for all to authenticated
  using (public.manages_exam(exam_id)) with check (public.manages_exam(exam_id));

create policy attempts_read on public.exam_attempts for select to authenticated
  using (user_id = auth.uid() or public.manages_exam(exam_id));
create policy attempts_grade on public.exam_attempts for update to authenticated
  using (public.manages_exam(exam_id)) with check (public.manages_exam(exam_id));

-- support & doubts
create policy support_read on public.support_requests for select to authenticated
  using (user_id = auth.uid() or public.is_mod_up() or (public.auth_role() = 'teacher' and kind = 'doubt'));
create policy support_insert on public.support_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'open' and reply is null);
create policy support_update on public.support_requests for update to authenticated
  using (public.is_mod_up() or (public.auth_role() = 'teacher' and kind = 'doubt'))
  with check (public.is_mod_up() or (public.auth_role() = 'teacher' and kind = 'doubt'));

create policy devices_own on public.devices for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy activity_own on public.activity_log for select to authenticated
  using (user_id = auth.uid() or public.is_admin_up());
create policy activity_insert on public.activity_log for insert to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 7. GRANTS (RLS does the real filtering; anon only sees public content)
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
revoke all on all tables in schema public from anon;
grant select on public.site_settings, public.announcements, public.subjects,
                public.teachers, public.courses to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.questions_public to authenticated;
revoke all on public.questions_public from anon;

revoke execute on function public.fulfill_order(uuid) from public, anon, authenticated;
revoke execute on function public.checkout(text,text,text) from public, anon;
revoke execute on function public.confirm_order(uuid) from public, anon;
revoke execute on function public.reject_order(uuid) from public, anon;
revoke execute on function public.start_exam(uuid) from public, anon;
revoke execute on function public.submit_exam(uuid,jsonb) from public, anon;
revoke execute on function public.exam_review(uuid) from public, anon;
grant execute on function public.checkout(text,text,text), public.confirm_order(uuid),
  public.reject_order(uuid), public.start_exam(uuid), public.submit_exam(uuid,jsonb),
  public.exam_review(uuid) to authenticated;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. STORAGE
--   avatars       public  - each user writes only inside their own folder
--   public-media  public  - course thumbnails, teacher photos, product images (staff upload)
--   private-files private - PDFs; readable only if free library item or purchased
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('avatars','avatars',true), ('public-media','public-media',true), ('private-files','private-files',false)
on conflict (id) do nothing;

drop policy if exists ca_avatar_insert on storage.objects;
drop policy if exists ca_avatar_update on storage.objects;
drop policy if exists ca_avatar_delete on storage.objects;
drop policy if exists ca_media_insert on storage.objects;
drop policy if exists ca_media_update on storage.objects;
drop policy if exists ca_media_delete on storage.objects;
drop policy if exists ca_private_manage on storage.objects;
drop policy if exists ca_private_read on storage.objects;

create policy ca_avatar_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy ca_avatar_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy ca_avatar_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy ca_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media' and public.is_staff());
create policy ca_media_update on storage.objects for update to authenticated
  using (bucket_id = 'public-media' and public.is_staff());
create policy ca_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'public-media' and public.is_admin_up());

create policy ca_private_manage on storage.objects for all to authenticated
  using (bucket_id = 'private-files' and public.is_admin_up())
  with check (bucket_id = 'private-files' and public.is_admin_up());
create policy ca_private_read on storage.objects for select to authenticated
  using (bucket_id = 'private-files' and (
    public.is_staff()
    or exists (select 1 from public.books b where b.file_path = storage.objects.name and b.is_published)
    or exists (select 1 from public.order_items oi
               join public.orders o on o.id = oi.order_id
               join public.products p on p.id = oi.product_id
               where o.user_id = auth.uid() and o.status = 'paid' and p.file_path = storage.objects.name)));

-- ---------------------------------------------------------------------
-- 9. DEFAULT SITE SETTINGS (generic text, no demo students/courses)
-- ---------------------------------------------------------------------
insert into public.site_settings(key, value) values
 ('welcome', jsonb_build_object(
   'hero_title', 'ক্লাসিক্যাল একাডেমি',
   'hero_subtitle', 'ষষ্ঠ থেকে দশম শ্রেণির শিক্ষার্থীদের জন্য আধুনিক অনলাইন শিক্ষা প্ল্যাটফর্ম',
   'intro', 'রেকর্ডেড ক্লাস, লাইভ ক্লাস, ডিজিটাল বই, অনলাইন পরীক্ষা ও ব্যক্তিগত ড্যাশবোর্ড — সবকিছু এক জায়গায়।',
   'youtube_channel_url', '', 'video_urls', jsonb_build_array(),
   'contact_phone', '', 'contact_email', '', 'contact_address', '', 'support_hours', '')),
 ('payment', jsonb_build_object('bkash','','nagad','','rocket','','note','পেমেন্ট করে ট্রানজেকশন আইডি দিন। যাচাইয়ের পর অর্ডার সক্রিয় হবে।'))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 10. FIRST SUPER ADMIN
-- Register normally in the app, verify your email, then run (replace the email):
--   update public.profiles set role = 'super_admin' where email = 'you@example.com';
-- ---------------------------------------------------------------------
