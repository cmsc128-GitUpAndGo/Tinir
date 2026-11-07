-- FR3 / NFR6 / NFR7: server-side registration rules for both roles.
-- Auth rejects the signup when the profile insert fails, so these rules hold even for clients that skip the form.

-- Contact numbers: optional digits with an optional leading +, spaces or hyphens between digits.
alter table app_private.profiles add constraint profiles_contact_number_format
  check (contact_number is null or contact_number ~ '^\+?[0-9][0-9 -]{5,18}[0-9]$');

-- College/program is a student-only field; owners never store it (data minimization).
alter table app_private.profiles add constraint profiles_college_program_student_only
  check (role = 'student' or college_program is null);

create or replace function app_private.new_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); chosen text := meta->>'role';
begin
  -- Copy the role once at signup. Subsequent user_metadata edits do not grant roles.
  -- Only the two self-service roles exist; anything else fails the profile check and the signup.
  insert into app_private.profiles(id,role,full_name,contact_number,college_program)
  values(new.id, chosen, trim(meta->>'full_name'),
    nullif(trim(meta->>'contact_number'),''),
    case when chosen = 'student' then nullif(trim(meta->>'college_program'),'') end);
  return new;
end $$;

revoke all on function app_private.new_profile() from public, anon, authenticated;
