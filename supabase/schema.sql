-- Run in the Supabase SQL Editor. Browser code uses only the anon key.
create extension if not exists pgcrypto;

create table if not exists public.admin_members (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student','faculty','pending_faculty')),
  requested_role text not null check (requested_role in ('student','faculty')),
  full_name text not null, email text not null, register_id text, faculty_id text,
  department text not null default 'Artificial Intelligence and Data Science',
  academic_year text, academic_session text, section text, designation text, created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists academic_session text;
update public.profiles set academic_year=case lower(trim(academic_year)) when 'i year' then '1st Year' when 'ii year' then '2nd Year' when 'iii year' then '3rd Year' when 'iv year' then '4th Year' else academic_year end where lower(trim(academic_year)) in ('i year','ii year','iii year','iv year');

create or replace function public.create_aether_profile() returns trigger language plpgsql security definer set search_path = public as $$
declare requested text;
begin
  requested := case when new.raw_user_meta_data->>'requested_role' = 'faculty' then 'faculty' else 'student' end;
  insert into public.profiles(id,role,requested_role,full_name,email,register_id,faculty_id,department,academic_year,academic_session,section,designation)
  values(new.id,case when requested = 'faculty' then 'pending_faculty' else 'student' end,requested,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''),'Department member'),new.email,
    nullif(new.raw_user_meta_data->>'register_id',''),nullif(new.raw_user_meta_data->>'faculty_id',''),
    coalesce(nullif(new.raw_user_meta_data->>'department',''),'Artificial Intelligence and Data Science'),
    nullif(new.raw_user_meta_data->>'academic_year',''),nullif(new.raw_user_meta_data->>'academic_session',''),nullif(new.raw_user_meta_data->>'section',''),nullif(new.raw_user_meta_data->>'designation',''));
  return new;
end;
$$;
drop trigger if exists on_aether_auth_user_created on auth.users;
create trigger on_aether_auth_user_created after insert on auth.users for each row execute procedure public.create_aether_profile();

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(), title text not null, type text not null, date date not null,
  time text not null, place text not null, cell text not null, detail text not null,
  color text not null default 'cyan', created_at timestamptz not null default now()
);
-- Expanded event management fields. Existing records remain unpublished until reviewed.
alter table public.events add column if not exists end_date date;
alter table public.events add column if not exists academic_session text;
alter table public.events add column if not exists year_of_study text;
alter table public.events add column if not exists faculty_coordinator text;
alter table public.events add column if not exists registration_link text;
alter table public.events add column if not exists poster_url text;
alter table public.events add column if not exists attachment_url text;
alter table public.events add column if not exists registration_deadline date;
alter table public.events add column if not exists status text not null default 'Upcoming';
alter table public.events add column if not exists published boolean not null default false;
alter table public.events add column if not exists event_type text;
alter table public.events add column if not exists description text;
alter table public.events add column if not exists start_date date;
alter table public.events add column if not exists venue text;
alter table public.events add column if not exists organizing_cell text;
alter table public.events add column if not exists created_by uuid references auth.users(id) on delete set null;
update public.events set start_date = date where start_date is null;
update public.events set event_type = type where event_type is null;
update public.events set venue = place where venue is null;
update public.events set organizing_cell = cell where organizing_cell is null;
update public.events set description = detail where description is null;
create or replace function public.attach_event_owner() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;
drop trigger if exists attach_aether_event_owner on public.events;
create trigger attach_aether_event_owner before insert on public.events for each row execute procedure public.attach_event_owner();
with duplicates as (
  select ctid, row_number() over (partition by lower(trim(title)), date order by created_at asc, id asc) as occurrence
  from public.events
)
delete from public.events e using duplicates d where e.ctid = d.ctid and d.occurrence > 1;
create unique index if not exists events_unique_title_date on public.events (lower(trim(title)), date);
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(), name text not null, category text not null, year text not null,
  tags text[] not null default '{}', description text not null, created_at timestamptz not null default now()
);
alter table public.projects add column if not exists academic_session text;
alter table public.projects add column if not exists year_of_study text;
create table if not exists public.announcements (id uuid primary key default gen_random_uuid(), body text not null, published boolean not null default false, created_at timestamptz not null default now());
alter table public.announcements add column if not exists title text not null default 'Department announcement';
alter table public.announcements add column if not exists academic_session text;
alter table public.announcements add column if not exists year_of_study text;
alter table public.announcements add column if not exists photo_url text;
alter table public.announcements add column if not exists attachment_url text;
alter table public.projects add column if not exists github_url text;
alter table public.projects add column if not exists demo_url text;
alter table public.projects add column if not exists team_members text;
alter table public.projects add column if not exists guide text;
alter table public.projects add column if not exists problem_statement text;
alter table public.projects add column if not exists image_url text;
alter table public.projects add column if not exists status text;
create table if not exists public.achievements (id uuid primary key default gen_random_uuid(), title text not null, category text not null, date date, description text not null, consent_note text not null, created_at timestamptz not null default now());
alter table public.achievements add column if not exists academic_session text;
alter table public.achievements add column if not exists year_of_study text;
alter table public.achievements add column if not exists photo_url text;
alter table public.achievements add column if not exists attachment_url text;
create table if not exists public.gallery (id uuid primary key default gen_random_uuid(), title text not null, image_url text not null, caption text, alt_text text not null, created_at timestamptz not null default now());
alter table public.gallery add column if not exists academic_session text;
alter table public.gallery add column if not exists year_of_study text;
alter table public.gallery add column if not exists attachment_url text;
create table if not exists public.cell_activities (id uuid primary key default gen_random_uuid(), title text not null, cell text not null, category text not null, start_date date not null, end_date date not null, venue text not null, status text not null default 'Planned' check(status in ('Planned','Ongoing','Completed','On Hold')), progress integer not null default 0 check(progress between 0 and 100), description text not null, created_at timestamptz not null default now());
alter table public.cell_activities add column if not exists coordinator text;
alter table public.cell_activities add column if not exists academic_session text;
alter table public.cell_activities add column if not exists year_of_study text;
alter table public.cell_activities add column if not exists photo_url text;
alter table public.cell_activities add column if not exists attachment_url text;
alter table public.cell_activities add column if not exists published boolean not null default false;

-- Department administration modules. These records are private to verified administrators and faculty.
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(), name text not null, register_number text not null,
  email text not null, phone text, academic_year text not null, section text, profile_photo text, cell text,
  created_at timestamptz not null default now()
);
alter table public.students add column if not exists cell text;
alter table public.students add column if not exists academic_session text;
alter table public.students add column if not exists announcement text;
update public.students set academic_year=case lower(trim(academic_year)) when 'i year' then '1st Year' when 'ii year' then '2nd Year' when 'iii year' then '3rd Year' when 'iv year' then '4th Year' else academic_year end where lower(trim(academic_year)) in ('i year','ii year','iii year','iv year');
create table if not exists public.faculty (
  id uuid primary key default gen_random_uuid(), name text not null, faculty_id text not null,
  email text not null, designation text, department text not null, subject text, profile_photo text,
  created_at timestamptz not null default now()
);
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(), academic_year text not null, semester text not null,
  subject_code text not null, subject_name text not null, credits numeric not null,
  assigned_faculty text, section text, created_at timestamptz not null default now()
);
alter table public.subjects add column if not exists academic_session text;
alter table public.subjects add column if not exists year_of_study text;
create table if not exists public.internal_marks (
  id uuid primary key default gen_random_uuid(), student text not null, subject text not null,
  assessment text not null, maximum_marks numeric not null check(maximum_marks >= 0),
  obtained_marks numeric not null check(obtained_marks >= 0 and obtained_marks <= maximum_marks),
  formula_note text, created_at timestamptz not null default now()
);
alter table public.internal_marks add column if not exists academic_session text;
alter table public.internal_marks add column if not exists year_of_study text;
create table if not exists public.semester_results (
  id uuid primary key default gen_random_uuid(), student text not null, semester text not null,
  subject text not null, marks numeric not null, grade text, credits numeric, sgpa numeric, cgpa numeric,
  created_at timestamptz not null default now()
);
alter table public.semester_results add column if not exists academic_session text;
alter table public.semester_results add column if not exists year_of_study text;
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(), student text not null, subject text not null,
  date date not null, attendance_status text not null check(attendance_status in ('Present','Absent','Approved OD')),
  total_classes integer not null check(total_classes >= 0), present_classes integer not null check(present_classes >= 0 and present_classes <= total_classes),
  attendance_percentage numeric not null default 0, created_at timestamptz not null default now()
);
alter table public.attendance add column if not exists academic_session text;
alter table public.attendance add column if not exists year_of_study text;
create table if not exists public.timetable (
  id uuid primary key default gen_random_uuid(), day text not null, period text not null,
  start_time time not null, end_time time not null, subject text not null, faculty text,
  classroom text, section text, created_at timestamptz not null default now()
);
alter table public.timetable add column if not exists academic_year text;
alter table public.timetable add column if not exists academic_session text;
alter table public.timetable add column if not exists photo_url text;
alter table public.timetable add column if not exists attachment_url text;
update public.timetable set academic_year=case lower(trim(academic_year)) when 'i year' then '1st Year' when 'ii year' then '2nd Year' when 'iii year' then '3rd Year' when 'iv year' then '4th Year' else academic_year end where lower(trim(academic_year)) in ('i year','ii year','iii year','iv year');
create table if not exists public.department_cells (
  id uuid primary key default gen_random_uuid(), cell text not null, faculty_coordinator text,
  student_leader text, members text, activity_title text, description text, start_date date,
  end_date date, venue text, status text not null default 'Planned', progress integer check(progress between 0 and 100),
  photo_url text, achievements text, created_at timestamptz not null default now()
);
alter table public.department_cells add column if not exists academic_session text;
alter table public.department_cells add column if not exists year_of_study text;
alter table public.department_cells add column if not exists attachment_url text;

create table if not exists public.final_year_projects (
  id uuid primary key default gen_random_uuid(), project_title text not null, batch text not null, guide text not null,
  team_members text not null, problem_statement text not null, project_process text not null, ppt_url text,
  review_0_date date, review_0_details text, review_1_date date, review_1_details text,
  review_2_date date, review_2_details text, review_3_date date, review_3_details text,
  review_4_date date, review_4_details text, status text not null default 'Planning', created_at timestamptz not null default now()
);
alter table public.final_year_projects add column if not exists academic_session text;

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, student_name text not null, student_email text not null,
  created_at timestamptz not null default now()
);
alter table public.registrations add column if not exists user_id uuid references auth.users(id) on delete set null;

create or replace function public.attach_registration_owner() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.user_id := auth.uid(); end if;
  return new;
end;
$$;
drop trigger if exists attach_aether_registration_owner on public.registrations;
create trigger attach_aether_registration_owner before insert on public.registrations for each row execute procedure public.attach_registration_owner();

alter table public.admin_members enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.projects enable row level security;
alter table public.announcements enable row level security;
alter table public.achievements enable row level security;
alter table public.gallery enable row level security;
alter table public.cell_activities enable row level security;
alter table public.registrations enable row level security;
alter table public.students enable row level security;
alter table public.faculty enable row level security;
alter table public.subjects enable row level security;
alter table public.internal_marks enable row level security;
alter table public.semester_results enable row level security;
alter table public.attendance enable row level security;
alter table public.timetable enable row level security;
alter table public.department_cells enable row level security;
alter table public.final_year_projects enable row level security;
revoke all on public.students, public.faculty, public.subjects, public.internal_marks, public.semester_results, public.attendance, public.timetable, public.department_cells, public.final_year_projects from anon, authenticated;
grant select, insert, update, delete on public.students, public.faculty, public.subjects, public.internal_marks, public.semester_results, public.attendance, public.timetable, public.department_cells, public.final_year_projects to authenticated;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update(full_name,department,academic_year,academic_session,section,designation) on public.profiles to authenticated;

create or replace function public.aether_is_admin_aal2() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal','aal1')='aal2' and exists(select 1 from public.admin_members a where a.user_id=auth.uid());
$$;
create or replace function public.aether_is_faculty_aal2() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal','aal1')='aal2' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='faculty');
$$;
create or replace function public.aether_is_staff_aal2() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.aether_is_admin_aal2() or public.aether_is_faculty_aal2();
$$;
revoke all on function public.aether_is_admin_aal2() from public, anon;
revoke all on function public.aether_is_faculty_aal2() from public, anon;
revoke all on function public.aether_is_staff_aal2() from public, anon;
grant execute on function public.aether_is_admin_aal2() to authenticated;
grant execute on function public.aether_is_faculty_aal2() to authenticated;
grant execute on function public.aether_is_staff_aal2() to authenticated;

drop policy if exists "Admins can read their own membership" on public.admin_members;
create policy "Admins can read their own membership" on public.admin_members for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select to authenticated using (id = auth.uid() or exists(select 1 from public.admin_members a where a.user_id = auth.uid()));
drop policy if exists "Users update allowed profile fields" on public.profiles;
create policy "Users update allowed profile fields" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "Events are public to read" on public.events;
create policy "Published events are public" on public.events for select to anon, authenticated using (published = true or public.aether_is_admin_aal2());
drop policy if exists "Faculty read own events" on public.events;
create policy "Faculty read own events" on public.events for select to authenticated using (created_by = auth.uid() and exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'faculty'));
drop policy if exists "Admins manage events" on public.events;
create policy "Admins manage events" on public.events for all to authenticated using (public.aether_is_staff_aal2()) with check (public.aether_is_staff_aal2());
drop policy if exists "Verified faculty manage events" on public.events;
create policy "Verified faculty manage events" on public.events for insert to authenticated with check (public.aether_is_faculty_aal2());
drop policy if exists "Faculty update own events" on public.events;
create policy "Faculty update own events" on public.events for update to authenticated using (created_by=auth.uid() and public.aether_is_faculty_aal2()) with check (created_by=auth.uid() and public.aether_is_faculty_aal2());
drop policy if exists "Projects are public to read" on public.projects;
create policy "Projects are public to read" on public.projects for select to anon, authenticated using (true);
drop policy if exists "Admins manage projects" on public.projects;
create policy "Admins manage projects" on public.projects for all to authenticated using (public.aether_is_staff_aal2()) with check (public.aether_is_staff_aal2());
drop policy if exists "Published announcements are public" on public.announcements;
create policy "Published announcements are public" on public.announcements for select to anon, authenticated using (published=true or public.aether_is_admin_aal2());
drop policy if exists "Admins manage announcements" on public.announcements;
create policy "Admins manage announcements" on public.announcements for all to authenticated using (public.aether_is_staff_aal2()) with check (public.aether_is_staff_aal2());
drop policy if exists "Public achievements read" on public.achievements;
create policy "Public achievements read" on public.achievements for select to anon, authenticated using (true);
drop policy if exists "Admins manage achievements" on public.achievements;
create policy "Admins manage achievements" on public.achievements for all to authenticated using (public.aether_is_staff_aal2()) with check (public.aether_is_staff_aal2());
drop policy if exists "Public gallery read" on public.gallery;
create policy "Public gallery read" on public.gallery for select to anon, authenticated using (true);
drop policy if exists "Admins manage gallery" on public.gallery;
create policy "Admins manage gallery" on public.gallery for all to authenticated using (public.aether_is_staff_aal2()) with check (public.aether_is_staff_aal2());
drop policy if exists "Public cell activities read" on public.cell_activities;
create policy "Published cell activities read" on public.cell_activities for select to anon, authenticated using (published=true or public.aether_is_admin_aal2());
drop policy if exists "Admins manage cell activities" on public.cell_activities;
create policy "Admins manage cell activities" on public.cell_activities for all to authenticated using (public.aether_is_staff_aal2()) with check (public.aether_is_staff_aal2());
drop policy if exists "Cell leaders manage assigned activities" on public.cell_activities;
create policy "Cell leaders manage assigned activities" on public.cell_activities for all to authenticated
using (exists(select 1 from public.students s join public.profiles p on p.id=auth.uid() where lower(s.email)=lower(p.email) and (s.cell=cell_activities.cell or (cell_activities.cell='Technical Activity Cell' and lower(trim(s.name))='sindhuja') or (cell_activities.cell='Sports Cell' and lower(trim(s.name))='martin prisca') or (cell_activities.cell='Competition & Hackathon Cell' and lower(trim(s.name))='anusha') or (cell_activities.cell='Project Cell' and lower(trim(s.name))='abinaya'))))
with check (exists(select 1 from public.students s join public.profiles p on p.id=auth.uid() where lower(s.email)=lower(p.email) and (s.cell=cell_activities.cell or (cell_activities.cell='Technical Activity Cell' and lower(trim(s.name))='sindhuja') or (cell_activities.cell='Sports Cell' and lower(trim(s.name))='martin prisca') or (cell_activities.cell='Competition & Hackathon Cell' and lower(trim(s.name))='anusha') or (cell_activities.cell='Project Cell' and lower(trim(s.name))='abinaya'))));
drop policy if exists "Students read own assignment" on public.students;
create policy "Students read own assignment" on public.students for select to authenticated using (lower(email)=lower(auth.jwt()->>'email'));
drop policy if exists "Faculty manage department records" on public.students;
create policy "Faculty manage department records" on public.students for all to authenticated using (public.aether_is_staff_aal2()) with check (public.aether_is_staff_aal2());
do $$ declare table_name text; begin
  foreach table_name in array array['students','subjects','internal_marks','semester_results','attendance','timetable','department_cells'] loop
    execute format('drop policy if exists %I on public.%I', 'Admins manage ' || table_name, table_name);
    execute format('create policy %I on public.%I for all to authenticated using (public.aether_is_staff_aal2()) with check (public.aether_is_staff_aal2())', 'Admins manage ' || table_name, table_name);
  end loop;
end $$;
drop policy if exists "Students read matching timetable" on public.timetable;
create policy "Students read matching timetable" on public.timetable for select to authenticated using (
  exists(
    select 1 from public.profiles p where p.id=auth.uid() and p.role='student'
      and p.academic_year is not null
      and timetable.academic_year=p.academic_year
  )
);
drop policy if exists "Admins manage faculty" on public.faculty;
create policy "Admins manage faculty" on public.faculty for all to authenticated using (public.aether_is_admin_aal2()) with check (public.aether_is_admin_aal2());
drop policy if exists "Admins and faculty manage final year projects" on public.final_year_projects;
create policy "Admins and faculty manage final year projects" on public.final_year_projects for all to authenticated using (public.aether_is_staff_aal2()) with check (public.aether_is_staff_aal2());
drop policy if exists "Visitors can register for events" on public.registrations;
create policy "Visitors can register for events" on public.registrations for insert to anon, authenticated with check (exists(select 1 from public.events e where e.id = event_id) and ((auth.uid() is null and user_id is null) or user_id = auth.uid()));
drop policy if exists "Admins read registrations" on public.registrations;
create policy "Admins read registrations" on public.registrations for select to authenticated using (user_id=auth.uid() or public.aether_is_admin_aal2());

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='events') then alter publication supabase_realtime add table public.events; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='projects') then alter publication supabase_realtime add table public.projects; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='announcements') then alter publication supabase_realtime add table public.announcements; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='achievements') then alter publication supabase_realtime add table public.achievements; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='gallery') then alter publication supabase_realtime add table public.gallery; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cell_activities') then alter publication supabase_realtime add table public.cell_activities; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='students') then alter publication supabase_realtime add table public.students; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='faculty') then alter publication supabase_realtime add table public.faculty; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='subjects') then alter publication supabase_realtime add table public.subjects; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='internal_marks') then alter publication supabase_realtime add table public.internal_marks; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='semester_results') then alter publication supabase_realtime add table public.semester_results; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='attendance') then alter publication supabase_realtime add table public.attendance; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='timetable') then alter publication supabase_realtime add table public.timetable; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='department_cells') then alter publication supabase_realtime add table public.department_cells; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='final_year_projects') then alter publication supabase_realtime add table public.final_year_projects; end if;
end $$;
