// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const owner = "11111111-1111-4111-8111-111111111111";
const member = "22222222-2222-4222-8222-222222222222";
const invited = "33333333-3333-4333-8333-333333333333";
const workspace = "44444444-4444-4444-8444-444444444444";
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create type public.workspace_role as enum ('owner','admin','member','viewer');
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
    create table public.profiles(id uuid primary key,display_name text);
    create table public.workspaces(id uuid primary key);
    create table public.workspace_members(workspace_id uuid,user_id uuid,role public.workspace_role,joined_at timestamptz default now(),primary key(workspace_id,user_id));
    create table public.audit_events(workspace_id uuid,actor_type text,actor_id uuid,event_type text,target_type text,target_id uuid,metadata jsonb);
    create function private.has_workspace_role(w uuid, roles public.workspace_role[]) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.workspace_members where workspace_id=w and user_id=auth.uid() and role=any(roles)) $$;
    insert into auth.users values ('${owner}','owner@example.com',now(),null,null),('${member}','member@example.com',now(),null,null),('${invited}','friend@example.com',now(),null,null);
    insert into public.workspaces values ('${workspace}');
  `);
  await db.exec(await readFile("supabase/migrations/20260916040000_workspace_collaborator_controls.sql", "utf8"));
}, 20000);

beforeEach(async () => {
  await db.exec(`reset role; delete from public.audit_events; delete from public.workspace_members;
    update auth.users set banned_until=null,email_confirmed_at=now();
    insert into public.workspace_members(workspace_id,user_id,role) values ('${workspace}','${owner}','owner'),('${workspace}','${member}','member');`);
});
afterAll(async () => { await db?.close(); });

async function asUser(userId: string) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec("set role authenticated");
}
async function manage(operation: string, email: string | null = null, id: string | null = null, role = "member") {
  return db.query("select public.manage_workspace_collaborator($1,$2,$3,$4,$5::public.workspace_role)", [workspace, operation, email, id, role]);
}

describe("collaborator transaction authorization", () => {
  it("allows an owner to add a confirmed account, change role, and remove it with audit events", async () => {
    await asUser(owner);
    await manage("add", " FRIEND@example.com ");
    await manage("role", null, invited, "viewer");
    const roster = await db.query<{ user_id: string; role: string }>("select * from public.list_workspace_collaborators($1)", [workspace]);
    expect(roster.rows.find(row => row.user_id === invited)?.role).toBe("viewer");
    await manage("remove", null, invited);
    await db.exec("reset role");
    const audit = await db.query<{ metadata: unknown }>("select metadata from public.audit_events");
    expect(audit.rows).toHaveLength(3);
    expect(JSON.stringify(audit.rows)).not.toContain("example.com");
  });
  it("denies member writes and private roster reads", async () => {
    await asUser(member);
    await expect(manage("add", "friend@example.com")).rejects.toThrow("WORKSPACE_FORBIDDEN");
    await expect(db.query("select * from public.list_workspace_collaborators($1)", [workspace])).rejects.toThrow("WORKSPACE_FORBIDDEN");
  });
  it("denies a suspended owner even with an existing session claim", async () => {
    await db.exec(`update auth.users set banned_until=now()+interval '1 day' where id='${owner}'`);
    await asUser(owner);
    await expect(manage("add", "friend@example.com")).rejects.toThrow("WORKSPACE_FORBIDDEN");
    await expect(db.query("select * from public.list_workspace_collaborators($1)", [workspace])).rejects.toThrow("WORKSPACE_FORBIDDEN");
  });
  it("denies anonymous execution even with a forged claim", async () => {
    await asUser(owner);
    await db.exec("set role anon");
    await expect(manage("add", "friend@example.com")).rejects.toThrow(/permission denied/i);
  });
  it("cannot modify owner/admin membership or promote a member", async () => {
    await asUser(owner);
    await expect(manage("role", null, member, "admin")).rejects.toThrow("WORKSPACE_INVALID_INPUT");
    await expect(manage("remove", null, owner)).rejects.toThrow("WORKSPACE_PROTECTED_MEMBER");
    await db.exec(`reset role; update public.workspace_members set role='admin' where user_id='${member}';`);
    await asUser(owner);
    await expect(manage("remove", null, member)).rejects.toThrow("WORKSPACE_PROTECTED_MEMBER");
  });
  it("does not add unconfirmed or suspended accounts", async () => {
    await db.exec(`update auth.users set email_confirmed_at=null where id='${invited}'`);
    await asUser(owner);
    await expect(manage("add", "friend@example.com")).rejects.toThrow("WORKSPACE_ACCOUNT_UNAVAILABLE");
    await db.exec(`reset role; update auth.users set email_confirmed_at=now(),banned_until=now()+interval '1 day' where id='${invited}'`);
    await asUser(owner);
    await expect(manage("add", "friend@example.com")).rejects.toThrow("WORKSPACE_ACCOUNT_UNAVAILABLE");
  });
  it("rolls back the membership write if its audit write fails", async () => {
    await db.exec("alter table public.audit_events add constraint reject_audit check (false)");
    await asUser(owner);
    await expect(manage("add", "friend@example.com")).rejects.toThrow(/reject_audit/);
    await db.exec("reset role; alter table public.audit_events drop constraint reject_audit");
    const result = await db.query("select 1 from public.workspace_members where user_id=$1", [invited]);
    expect(result.rows).toHaveLength(0);
  });
});
