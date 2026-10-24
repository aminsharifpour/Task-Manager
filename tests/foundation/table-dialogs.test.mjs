/**
 * Isolated render/handler tests. HeroUI and React hooks are mocked:
 * these tests do NOT replace a real browser focus/layout test or npm run build.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { setImmediate as flush } from "node:timers/promises";
import ts from "typescript";

const root = fileURLToPath(new URL("../../", import.meta.url));
const sourceDir = path.join(root, "apps/web/src/features/workspace");
const names = ["record-dialog.tsx", "task-details-panel.tsx", "task-comments-panel.tsx", "task-files-panel.tsx"];
const source = name => fs.readFileSync(path.join(sourceDir, name), "utf8");

function nodes(tree, predicate) {
  const result = [];
  const walk = value => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== "object" || !("type" in value)) return;
    if (predicate(value)) result.push(value);
    walk(value.props?.children);
  };
  walk(tree);
  return result;
}
const find = (tree, predicate) => {
  const found = nodes(tree, predicate);
  assert.ok(found.length, "Expected render node was not found");
  return found[0];
};
const byType = (tree, type) => find(tree, node => node.type === type);
const clickLabel = (tree, label) => find(tree, node => node.type === "Button" && node.props.children === label);

function state(data, overrides = {}) {
  return {
    data, loading: false, busy: false, error: "", notice: "",
    refresh() {},
    async act(action) { await action(); },
    ...overrides,
  };
}
function runtime(fixtures = {}) {
  let active;
  const modules = new Map(Object.entries(fixtures));
  const react = {
    useState(initial) {
      assert.ok(active, "Hooks must be rendered within the isolated harness");
      const owner = active, slot = owner.cursor++;
      if (!(slot in owner.slots)) owner.slots[slot] = typeof initial === "function" ? initial() : initial;
      return [owner.slots[slot], next => {
        owner.slots[slot] = typeof next === "function" ? next(owner.slots[slot]) : next;
      }];
    },
    useRef(initial) { return react.useState(() => ({ current: initial }))[0]; },
    useEffect() {},
  };
  const make = (type, props, key) => ({ type, props: props || {}, key });
  const modal = Object.fromEntries(
    ["Backdrop", "Container", "Dialog", "Header", "Heading", "Body", "Footer", "CloseTrigger"]
      .map(name => [name, "Modal." + name]),
  );
  const requireMock = name => {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx: make, jsxs: make, Fragment: "Fragment" };
    if (name === "@heroui/react") return { Button: "Button", Form: "Form", Description: "Description", Modal: modal };
    if (name === "lucide-react") return { FileUp: "FileUp" };
    if (name.endsWith(".css")) return {};
    if (name === "@/components/ui/input") return { Input: "Input" };
    if (name === "./task-edit-panel") return { __esModule: true, default: "TaskEditor" };
    if (name === "./task-custom-fields") return { CustomFields: "CustomFields" };
    if (name === "./task-record-types") return load("task-record-types.ts");
    if (name === "./task-readonly-sections") return Object.fromEntries(
      ["ReadonlySection", "ReadonlyComments", "ReadonlyFiles", "ReadonlyTime", "ReadonlyActivity", "ReadonlyChildren"].map(key => [key, key]));
    if (name === "./record-dialog") return { __esModule: true, default: "RecordDialog" };
    if (name === "./resource-picker") return { __esModule: true, default: "ResourcePicker" };
    if (name === "./jalali-date-field") return { __esModule: true, default: "JalaliDateField" };
    if (name === "./jalali-timeline") return { jalaliDate: value => String(value) };
    if (name === "./dates") return { workspaceToday: () => "2026-10-24", displayDate: value => String(value) };
    if (name === "./use-module") return {
      emptyPage: () => ({ items: [], total: 0, page: 1, pageSize: 25 }),
      useModule(_api, route, initial) {
        if (!modules.has(route)) modules.set(route, state(initial));
        return modules.get(route);
      },
    };
    throw new Error("Unmocked import: " + name);
  };
  function load(name) {
    const output = ts.transpileModule(source(name), {
      fileName: name,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    });
    const mod = { exports: {} };
    vm.runInNewContext(output.outputText, {
      module: mod, exports: mod.exports, require: requireMock,
      console, Error, URL, Blob, TextEncoder, setTimeout, clearTimeout,
      crypto: { randomUUID: () => "test-idempotency-key" },
      window: { setTimeout, clearTimeout },
    }, { filename: name });
    return mod.exports;
  }
  function renderer(Component, props) {
    const owner = { slots: [], cursor: 0 };
    return {
      render(nextProps = props) {
        props = nextProps;
        owner.cursor = 0;
        const previous = active;
        active = owner;
        try { return Component(props); } finally { active = previous; }
      },
    };
  }
  return { load, renderer, modules };
}
const guest = { userId: "u1", role: "guest", canManageHr: false, canManageAccounting: false };
const taskRecord = {
  id: "t1", title: "Task 1", description: "Read only details", priority: "normal",
  startDate: null, executionDate: null, estimateMinutes: null, parentTaskId: null,
  customFields: {}, version: 4, project: null, workflowSteps: [],
};
const versionRecord = {
  id: "v1", version: 2, originalName: "plan.pdf", byteSize: 128,
  checksum: "abc123", createdAt: "2026-10-24T00:00:00Z",
  ownReview: { version: 3, decision: "approved", comment: null }, reviews: [],
};
const fileRecord = { id: "f1", name: "plan.pdf", currentVersion: 2, archivedAt: null, versions: [versionRecord] };
const filePage = {
  items: [fileRecord], total: 1, page: 1, pageSize: 25,
  canUpload: true, maxUploadBytes: 20971520, acceptedExtensions: [".pdf"],
};
function fileHarness(api = async () => undefined) {
  const rt = runtime({
    "/tasks/t1/files?page=1&archived=false": state(filePage),
    "/files/f1/versions?page=1": state({ items: [versionRecord], total: 1, page: 1, pageSize: 25, reviewKind: "internal" }),
  });
  const parent = rt.renderer(rt.load("task-files-panel.tsx").default, { api, task: taskRecord, onClose() {} });
  clickLabel(parent.render(), "نسخه‌ها و بازخورد").props.onPress();
  const historyNode = find(parent.render(), node => typeof node.type === "function" && node.type.name === "VersionHistory");
  const history = rt.renderer(historyNode.type, historyNode.props);
  return { rt, parent, history };
}

for (const name of names) {
  test(name + ": TSX parses without syntax errors", () => {
    const parsed = ts.createSourceFile(name, source(name), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(parsed.parseDiagnostics.length, 0);
  });
}
test("record dialog has named heading, scrollable body, RTL and two close controls", () => {
  const rt = runtime(), Comp = rt.load("record-dialog.tsx").default;
  const tree = rt.renderer(Comp, { title: "A record", closeLabel: "Close", children: "Content", onClose() {} }).render();
  assert.equal(tree.type, "Modal.Backdrop");
  assert.equal(tree.props.isOpen, true);
  assert.equal(byType(tree, "Modal.Container").props.scroll, "inside");
  assert.equal(byType(tree, "Modal.Container").props.placement, "center");
  assert.equal(byType(tree, "Modal.Dialog").props.dir, "rtl");
  assert.equal(byType(tree, "Modal.Heading").props.children, "A record");
  assert.equal(byType(tree, "Modal.CloseTrigger").props["aria-label"], "Close");
  assert.equal(clickLabel(tree, "Close").props.type, "button");
});
test("backdrop/Escape dismissal routes to the supplied close callback", () => {
  let closed = 0;
  const rt = runtime(), Comp = rt.load("record-dialog.tsx").default;
  const tree = rt.renderer(Comp, { title: "Record", children: null, onClose() { closed++; } }).render();
  tree.props.onOpenChange(true);
  assert.equal(closed, 0);
  tree.props.onOpenChange(false);
  assert.equal(closed, 1);
});
test("footer close uses the same close handler", () => {
  let closed = 0;
  const rt = runtime(), Comp = rt.load("record-dialog.tsx").default;
  const tree = rt.renderer(Comp, { title: "Record", closeLabel: "Close", onClose() { closed++; } }).render();
  clickLabel(tree, "Close").props.onPress();
  assert.equal(closed, 1);
});
test("pending writes block pointer, keyboard and button dismissal", () => {
  let closed = 0;
  const rt = runtime(), Comp = rt.load("record-dialog.tsx").default;
  const tree = rt.renderer(Comp, { title: "Record", closeLabel: "Close", busy: true, onClose() { closed++; } }).render();
  assert.equal(tree.props.isDismissable, false);
  assert.equal(tree.props.isKeyboardDismissDisabled, true);
  assert.equal(byType(tree, "Modal.CloseTrigger").props.isDisabled, true);
  assert.equal(clickLabel(tree, "Close").props.isDisabled, true);
  tree.props.onOpenChange(false);
  clickLabel(tree, "Close").props.onPress();
  assert.equal(closed, 0);
});
test("dirty drafts ask before closing; cancelling keeps the parent open", () => {
  let closed = 0;
  const rt = runtime(), Comp = rt.load("record-dialog.tsx").default;
  const render = rt.renderer(Comp, { title: "Record", dirty: true, onClose() { closed++; } });
  render.render().props.onOpenChange(false);
  let tree = render.render();
  assert.equal(nodes(tree, node => node.type === "Modal.Backdrop").length, 2);
  assert.equal(closed, 0);
  clickLabel(tree, "ادامه ویرایش").props.onPress();
  tree = render.render();
  assert.equal(nodes(tree, node => node.type === "Modal.Backdrop").length, 1);
  assert.equal(closed, 0);
});
test("explicit discard closes once without a network write", () => {
  let closed = 0;
  const rt = runtime(), Comp = rt.load("record-dialog.tsx").default;
  const render = rt.renderer(Comp, { title: "Record", dirty: true, onClose() { closed++; } });
  render.render().props.onOpenChange(false);
  clickLabel(render.render(), "بستن بدون ذخیره").props.onPress();
  assert.equal(closed, 1);
});
test("dismissing discard confirmation does not close the record", () => {
  let closed = 0;
  const rt = runtime(), Comp = rt.load("record-dialog.tsx").default;
  const render = rt.renderer(Comp, { title: "Record", dirty: true, onClose() { closed++; } });
  render.render().props.onOpenChange(false);
  nodes(render.render(), node => node.type === "Modal.Backdrop")[1].props.onOpenChange(false);
  assert.equal(nodes(render.render(), node => node.type === "Modal.Backdrop").length, 1);
  assert.equal(closed, 0);
});
test("loading and failed task details stay in a closable dialog", () => {
  for (const error of ["", "Network unavailable"]) {
    let closed = 0, retried = 0;
    const rt = runtime({ "/tasks/t1/details": state(undefined, { error, loading: !error, refresh() { retried++; } }) });
    const tree = rt.renderer(rt.load("task-details-panel.tsx").default, {
      api: async () => undefined, id: "t1", permissions: guest, onClose() { closed++; }, onChanged() {},
    }).render();
    assert.equal(tree.type, "RecordDialog");
    tree.props.onClose();
    assert.equal(closed, 1);
    if (error) { clickLabel(tree, "تلاش دوباره").props.onPress(); assert.equal(retried, 1); }
  }
});
test("read-only details do not acquire edit forms or new permissions", () => {
  const rt = runtime({
    "/tasks/t1/details": state({ task: taskRecord, canEdit: false, checklist: [], dependencies: [] }),
  });
  const tree = rt.renderer(rt.load("task-details-panel.tsx").default, {
    api: async () => undefined, id: "t1", permissions: guest, onClose() {}, onChanged() {},
  }).render();
  assert.equal(tree.type, "RecordDialog");
  assert.equal(nodes(tree, node => node.type === "Form").length, 0);
  const grid = find(tree, node => typeof node.type === "function" && node.type.name === "DisplayGrid");
  assert.equal(grid.type(grid.props).props.className, "record-readonly-grid");
  assert.equal(nodes(tree, node => ["form", "input", "textarea", "select"].includes(node.type)).length, 0);
});
test("comments open in a dialog, protect drafts and preserve the existing POST payload", async () => {
  const calls = [];
  const rt = runtime(), api = async (route, options) => { calls.push([route, options]); };
  const render = rt.renderer(rt.load("task-comments-panel.tsx").default, {
    api, task: taskRecord, internal: true, onClose() {},
  });
  let tree = render.render();
  assert.equal(tree.type, "RecordDialog");
  find(tree, node => node.type === "Input").props.onChange({ target: { value: "A new comment" } });
  tree = render.render();
  assert.equal(tree.props.dirty, true);
  byType(tree, "form").props.onSubmit({ preventDefault() {} });
  await flush();
  assert.equal(calls[0][0], "/tasks/t1/comments");
  assert.deepEqual(JSON.parse(calls[0][1].body), { text: "A new comment", stepId: "general" });
  assert.equal(render.render().props.dirty, false);
});
test("guests cannot post task comments", () => {
  const rt = runtime();
  const tree = rt.renderer(rt.load("task-comments-panel.tsx").default, {
    api: async () => undefined, task: taskRecord, internal: false, onClose() {},
  }).render();
  assert.equal(tree.type, "RecordDialog");
  assert.equal(nodes(tree, node => node.type === "form").length, 0);
});
test("file selection is protected until upload or explicit discard", () => {
  const { parent } = fileHarness();
  let tree = parent.render();
  assert.equal(tree.type, "RecordDialog");
  find(tree, node => node.type === "input" && node.props.type === "file").props.onChange({
    target: { files: [{ name: "draft.pdf", size: 4, lastModified: 1 }] },
  });
  assert.equal(parent.render().props.dirty, true);
});
test("version history opens in its own dialog and clears the selected history on close", () => {
  const { parent, history } = fileHarness();
  const tree = history.render();
  assert.equal(tree.type, "RecordDialog");
  tree.props.onClose();
  assert.equal(nodes(parent.render(), node => typeof node.type === "function" && node.type.name === "VersionHistory").length, 0);
});
test("version feedback has an independent close callback", () => {
  const { rt, history } = fileHarness();
  const tree = history.render();
  find(tree, node => node.type === "Button" && node.props["aria-haspopup"] === "dialog" && Array.isArray(node.props.children)).props.onPress();
  const feedback = find(history.render(), node => typeof node.type === "function" && node.type.name === "Feedback");
  const render = rt.renderer(feedback.type, feedback.props);
  assert.equal(render.render().type, "RecordDialog");
  render.render().props.onClose();
  assert.equal(nodes(history.render(), node => typeof node.type === "function" && node.type.name === "Feedback").length, 0);
});
test("file metadata opens in a dialog rather than an inline details disclosure", () => {
  const { history } = fileHarness();
  clickLabel(history.render(), "مشخصات و شناسه یکپارچگی فایل").props.onPress();
  const tree = history.render();
  assert.equal(nodes(tree, node => node.type === "RecordDialog").length, 2);
  assert.equal(nodes(tree, node => node.type === "details").length, 0);
});
test("file review uses a dialog and preserves optimistic version checks", async () => {
  const calls = [];
  const { rt, history } = fileHarness(async (route, options) => { calls.push([route, options]); });
  const tree = history.render();
  find(tree, node => node.type === "Button" && Array.isArray(node.props.children) && node.props.children[0] === "درخواست اصلاح نسخه ").props.onPress();
  const review = find(history.render(), node => typeof node.type === "function" && node.type.name === "VersionReview");
  const render = rt.renderer(review.type, review.props);
  assert.equal(render.render().type, "RecordDialog");
  byType(render.render(), "textarea").props.onChange({ target: { value: "Please revise the diagram" } });
  const dirtyTree = render.render();
  assert.equal(dirtyTree.props.dirty, true);
  byType(dirtyTree, "form").props.onSubmit({ preventDefault() {} });
  await flush();
  assert.equal(calls[0][0], "/files/f1/versions/v1/review");
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    decision: "changes_requested", comment: "Please revise the diagram", expectedVersion: 3,
  });
});
test("no browser prompt remains in the file interaction path", () => {
  assert.ok(!source("task-files-panel.tsx").includes("window.prompt"));
});
test("dialog styles isolate the portal and use dynamic viewport height", () => {
  const css = fs.readFileSync(path.join(sourceDir, "record-dialog.css"), "utf8");
  assert.ok(css.includes("100dvh"));
  assert.ok(css.includes("overflow-y: auto"));
  assert.ok(css.includes(".workspace-record-dialog-footer"));
  assert.ok(css.includes("--workspace-primary: #205a49"));
});
