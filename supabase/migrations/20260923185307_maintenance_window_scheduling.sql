alter table public.platform_settings
  add column maintenance_ends_at timestamptz,
  add column maintenance_time_zone text,
  add column maintenance_auto_disable boolean not null default true;

alter table public.platform_settings
  add constraint platform_settings_maintenance_window_required
    check (not maintenance_mode or maintenance_ends_at is not null),
  add constraint platform_settings_maintenance_time_zone_bounded
    check (
      maintenance_time_zone is null
      or char_length(maintenance_time_zone) between 1 and 100
    );

grant select (
  id,
  registration_enabled,
  maintenance_mode,
  maintenance_message,
  maintenance_ends_at,
  maintenance_time_zone,
  maintenance_auto_disable,
  updated_at
) on table public.platform_settings to anon, authenticated;

comment on column public.platform_settings.maintenance_ends_at is
  'Absolute UTC completion estimate for the active maintenance window.';
comment on column public.platform_settings.maintenance_time_zone is
  'Optional IANA time zone used to display the shared completion estimate; null follows each browser.';
comment on column public.platform_settings.maintenance_auto_disable is
  'When true, application readers treat maintenance as disabled after maintenance_ends_at.';
