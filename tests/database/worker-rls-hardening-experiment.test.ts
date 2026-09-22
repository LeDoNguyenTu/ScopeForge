// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;

async function queryAs<T extends Record<string, unknown>>(role: string, sql: string) {
  await db.exec(`set role ${role}`);
  try {
    return await db.query<T>(sql);
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  db = new PGlite();

  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create role scopeforge_bypass_owner bypassrls;
    create role scopeforge_restricted_owner;

    grant service_role to postgres;
    grant scopeforge_bypass_owner to postgres;
    grant scopeforge_restricted_owner to postgres;

    grant create on schema public to scopeforge_bypass_owner;
    grant create on schema public to scopeforge_restricted_owner;

    create schema private;

    create table private.worker_tasks_bypass (
      id integer primary key,
      payload text not null
    );
    insert into private.worker_tasks_bypass values (1, 'trusted');
    alter table private.worker_tasks_bypass owner to scopeforge_bypass_owner;

    create or replace function public.worker_tasks_bypass_count()
    returns integer
    language sql
    security definer
    set search_path = ''
    as $$
      select count(*)::integer
      from private.worker_tasks_bypass
    $$;
    alter function public.worker_tasks_bypass_count() owner to scopeforge_bypass_owner;

    revoke all on table private.worker_tasks_bypass from public, anon, authenticated, service_role;
    revoke all on function public.worker_tasks_bypass_count() from public, anon, authenticated, service_role;
    grant execute on function public.worker_tasks_bypass_count() to service_role;

    create table private.worker_tasks_restricted (
      id integer primary key,
      payload text not null
    );
    insert into private.worker_tasks_restricted values (1, 'trusted');
    alter table private.worker_tasks_restricted owner to scopeforge_restricted_owner;

    create or replace function public.worker_tasks_restricted_count()
    returns integer
    language sql
    security definer
    set search_path = ''
    as $$
      select count(*)::integer
      from private.worker_tasks_restricted
    $$;
    alter function public.worker_tasks_restricted_count() owner to scopeforge_restricted_owner;

    revoke all on table private.worker_tasks_restricted from public, anon, authenticated, service_role;
    revoke all on function public.worker_tasks_restricted_count() from public, anon, authenticated, service_role;
    grant execute on function public.worker_tasks_restricted_count() to service_role;
  `);
}, 30_000);

afterAll(async () => {
  await db?.close();
});

describe("worker RLS hardening experiment", () => {
  it("keeps browser roles outside private worker tables before RLS", async () => {
    for (const role of ["anon", "authenticated"]) {
      await expect(
        queryAs(role, "select count(*)::integer as count from private.worker_tasks_bypass"),
      ).rejects.toThrow();
    }
  });

  it("shows that ENABLE + FORCE RLS does not constrain a BYPASSRLS SECURITY DEFINER owner", async () => {
    await db.exec(`
      alter table private.worker_tasks_bypass enable row level security;
      alter table private.worker_tasks_bypass force row level security;
    `);

    const result = await queryAs<{ count: number }>(
      "service_role",
      "select public.worker_tasks_bypass_count() as count",
    );

    expect(result.rows).toEqual([{ count: 1 }]);
  });

  it("shows that a non-BYPASSRLS SECURITY DEFINER owner is constrained by FORCE RLS", async () => {
    await db.exec(`
      alter table private.worker_tasks_restricted enable row level security;
      alter table private.worker_tasks_restricted force row level security;
    `);

    const withoutPolicy = await queryAs<{ count: number }>(
      "service_role",
      "select public.worker_tasks_restricted_count() as count",
    );
    expect(withoutPolicy.rows).toEqual([{ count: 0 }]);

    await db.exec(`
      create policy worker_tasks_restricted_owner_read
      on private.worker_tasks_restricted
      for select
      to scopeforge_restricted_owner
      using (true);
    `);

    const withPolicy = await queryAs<{ count: number }>(
      "service_role",
      "select public.worker_tasks_restricted_count() as count",
    );
    expect(withPolicy.rows).toEqual([{ count: 1 }]);
  });

  it("shows that BYPASSRLS does not substitute for missing table grants", async () => {
    await expect(
      queryAs(
        "service_role",
        "select count(*)::integer as count from private.worker_tasks_bypass",
      ),
    ).rejects.toThrow();

    const viaReviewedRpc = await queryAs<{ count: number }>(
      "service_role",
      "select public.worker_tasks_bypass_count() as count",
    );
    expect(viaReviewedRpc.rows).toEqual([{ count: 1 }]);
  });
});
