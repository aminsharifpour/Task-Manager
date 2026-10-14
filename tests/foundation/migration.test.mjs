import { test } from "node:test";
import assert from "node:assert/strict";
import { planMigration } from "../../apps/api/scripts/migration-plan.mjs";
import { pagination, requireAdmin, requireManager } from "../../apps/api/src/modules/organizations/policy.js";

const fixture = () => ({ teamMembers: [{ id: "u1", passwordHash: "synthetic" }], projects: [
  { id: "p1", name: "same", ownerId: "u1" }, { id: "p2", name: "same", ownerId: "u1" },
], tasks: [{ id: "t1", title: "test", projectName: "same", assignerId: "u1", assigneePrimaryId: "u1" }] });

test("duplicate project names require an explicit task mapping", () => {
  const db = fixture();
  const before = JSON.stringify(db);
  assert.equal(planMigration(db).ok, false);
  assert.equal(planMigration(db).issues[0].code, "AMBIGUOUS_PROJECT");
  const plan = planMigration(db, { t1: "p2" });
  assert.equal(plan.ok, true);
  assert.equal(plan.links.t1, "p2");
  assert.equal(JSON.stringify(db), before);
  assert.equal(planMigration(db, { t1: "p2" }).checksum, plan.checksum);
});
test("unknown stable project IDs cannot fall back to a matching name", () => {
  const db = fixture(); db.tasks[0].projectId = "other-tenant";
  assert.equal(planMigration(db).ok, false);
});
test("broken references and invalid dates block migration", () => {
  const db = fixture(); db.tasks[0].assigneePrimaryId = "missing"; db.tasks[0].executionDate = "broken";
  const plan = planMigration(db, { t1: "p1" });
  assert.ok(plan.issues.some((i) => i.code === "BROKEN_REFERENCE"));
  assert.ok(plan.issues.some((i) => i.code === "INVALID_DATE"));
});
test("guest and member roles cannot escalate privileges", () => {
  for (const role of ["guest", "member"]) {
    assert.throws(() => requireManager({ role }), { status: 403 });
    assert.throws(() => requireAdmin({ role }), { status: 403 });
  }
  assert.throws(() => requireAdmin({ role: "project_manager" }), { status: 403 });
});
test("unbounded or malformed pagination is rejected", () => {
  assert.deepEqual(pagination({}), { skip: 0, take: 25, page: 1, pageSize: 25 });
  for (const query of [{ page: "-1" }, { pageSize: "1000" }, { page: "1.5" }, { page: "hello" }]) assert.throws(() => pagination(query), { status: 400 });
});
