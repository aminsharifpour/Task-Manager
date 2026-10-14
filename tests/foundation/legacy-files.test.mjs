import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { planLegacyChatFiles } from "../../apps/api/scripts/lib/legacy-file-plan.mjs";

test("legacy file dry-run verifies inline/local bytes and rejects escape/remote/missing references without mutation", async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "shekof-legacy-files-")), root = path.join(base, "uploads");
  try {
    await fs.mkdir(root); await fs.writeFile(path.join(root, "sample.txt"), "sample"); await fs.writeFile(path.join(base, "outside.txt"), "private");
    const attachments = [{ name: "inline.txt", dataUrl: "data:text/plain;base64,c2FtcGxl", size: 6 }, { name: "sample.txt", dataUrl: "/uploads/sample.txt", size: 6 }, { dataUrl: "/uploads/../outside.txt" }, { dataUrl: "/uploads/missing.txt" }, { dataUrl: "https://example.test/private.txt" }, { dataUrl: "data:text/plain;base64,@@@" }];
    const sourceBytes = Buffer.from(JSON.stringify({ chatMessages: [{ id: "message", conversationId: "room", senderId: "sender", attachments }] }));
    const result = await planLegacyChatFiles({ sourceBytes, uploadsRoot: root, organizationId: "synthetic-org" });
    assert.equal(result.summary.verifiedBlobs, 2); assert.equal(result.summary.duplicateContent, 1); assert.equal(result.databaseVerified, false);
    assert.equal(result.entries[0].checksum, result.entries[1].checksum);
    assert.deepEqual(result.issues.map(issue => issue.code).sort(), ["INVALID_INLINE_DATA", "MISSING_BLOB", "REMOTE_OR_UNSUPPORTED_LOCATION", "UNSAFE_PATH"].sort());
    assert.equal((await fs.readFile(path.join(root, "sample.txt"))).toString(), "sample");
    assert.deepEqual(await fs.readdir(root), ["sample.txt"]);
    assert.equal((await planLegacyChatFiles({ sourceBytes, uploadsRoot: root })).issues.some(issue => issue.code === "ORGANIZATION_MAPPING_REQUIRED"), true);
  } finally {
    assert.ok(path.resolve(base).startsWith(path.resolve(os.tmpdir()) + path.sep + "shekof-legacy-files-")); await fs.rm(base, { recursive: true, force: true });
  }
});
