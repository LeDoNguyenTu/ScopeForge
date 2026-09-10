create policy platform_admins_explicit_browser_deny
  on public.platform_admins
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy platform_admin_audit_events_explicit_browser_deny
  on public.platform_admin_audit_events
  for all
  to anon, authenticated
  using (false)
  with check (false);
