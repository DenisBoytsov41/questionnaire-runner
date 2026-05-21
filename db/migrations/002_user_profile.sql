alter table users
  add column email text not null default '',
  add column phone text not null default '',
  add column position text not null default '',
  add column preferences_json jsonb not null default '{"theme":"light","textSize":"normal","readingMode":"normal"}'::jsonb;

create index users_active_role_idx on users(active, role);
