import { timelinePreviewApi } from "./readonly-timeline";
import { statusTone, priorityTone } from "./palette";
import TableAction from "./table-action";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  Spinner,
  Table,
  Text,
  TextField,
} from "@heroui/react";
import {
  Eye,
  Pencil,
  CalendarDays,
  CheckCheck,
  Download,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
} from "lucide-react";
import { downloadExport } from "./export-download";

import { emptyPage, useModule } from "./use-module";
import type { Request, Permissions } from "./use-module";
import { TaskMessage, TaskSelect } from "./hero-task-fields";
import CreateTaskModal from "./create-task-modal";
import TaskDetails from "./task-details-panel";
import { Calendar } from "./task-timeline";
import Gantt from "./task-gantt";
import JalaliDateField from "./jalali-date-field";
import { jalaliDate } from "./jalali-timeline";
import "./tasks-panel.css";
type Task = {
  canEdit: boolean;
  priority: string;
  startDate: string | null;
  estimateMinutes: number | null;
  id: string;
  title: string;
  description: string | null;
  status: string;
  version: number;
  assignerId: string;
  assigneePrimaryId: string;
  assigneePrimary?: { fullName: string };
  assigneeSecondaryId: string | null;
  projectId: string | null;
  executionDate: string | null;
  project: { name: string } | null;
  workflowSteps: { id: string; title: string; requiresApproval: boolean }[];
  workflowCurrentStep: number;
  workflowCompletedAt: string | null;
  workflowPendingAssigneeIds: string[];
};
const statuses: Record<string, string> = {
  todo: "انجام‌نشده",
  doing: "در حال انجام",
  blocked: "متوقف",
  done: "انجام‌شده",
};
const priorities: Record<string, string> = {
  low: "کم",
  normal: "عادی",
  high: "زیاد",
  urgent: "فوری",
};
const number = (value: number) => new Intl.NumberFormat("fa").format(value);
export default function TasksPanel({
  api,
  permissions,
  initialTaskId = "",
}: {
  api: Request;
  permissions: Permissions;
  initialTaskId?: string;
}) {
  const previewApi = useMemo(() => timelinePreviewApi(api), [api]);
  const [ganttRevision, setGanttRevision] = useState(0),
    [editing, setEditing] = useState(false);
  const openDetails = (id: string) => {
    setEditing(false);
    setDetailId(id);
  };
  const [detailId, setDetailId] = useState(initialTaskId),
    [createOpen, setCreateOpen] = useState(false),
    [notice, setNotice] = useState("");
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [priority, setPriority] = useState("all"),
    [sort, setSort] = useState("newest"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [page, setPage] = useState(1),
    [view, setView] = useState("table"),
    [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (initialTaskId) {
      setEditing(false);
      setDetailId(initialTaskId);
    }
  }, [initialTaskId]);
  const state = useModule(
    api,
    "/tasks?page=" +
      page +
      "&pageSize=25&search=" +
      encodeURIComponent(query) +
      "&sort=" +
      sort +
      (status !== "all" ? "&status=" + status : "") +
      (priority !== "all" ? "&priority=" + priority : "") +
      (from ? "&from=" + from : "") +
      (to ? "&to=" + to : ""),
    emptyPage<Task>(),
  );
  useEffect(() => {
    if (!state.loading && page > Math.max(1, Math.ceil(state.data.total / 25)))
      setPage(Math.max(1, Math.ceil(state.data.total / 25)));
  }, [page, state.loading, state.data.total]);
  const internal = permissions.role !== "guest";
  const stage = (task: Task) =>
    task.workflowCompletedAt
      ? "تکمیل‌شده"
      : task.workflowSteps?.[task.workflowCurrentStep]?.title ||
        "بدون گردش‌کار";
  const needsMyAction = (task: Task) => !task.workflowCompletedAt && task.workflowPendingAssigneeIds?.includes(permissions.userId);
  const dueSoon = state.data.items.filter(task => task.status !== "done" && task.executionDate && new Date(task.executionDate).getTime() < Date.now() + 3 * 86400000).length;
  const myTurn = state.data.items.filter(needsMyAction).length;
  const actions = (task: Task) => (
    <div className="task-row-actions">
      <TableAction
        label={"جزئیات تسک " + task.title}
        onPress={() => openDetails(task.id)}
      >
        <Eye size={18} />
      </TableAction>
      <TableAction
        label={"ویرایش تسک " + task.title}
        onPress={() => {
          setEditing(true);
          setDetailId(task.id);
        }}
      >
        <Pencil size={18} />
      </TableAction>
    </div>
  );
  const card = (task: Task) => (
    <div key={task.id}>
      <Card className="task-board-card">
        <Card.Header>
          <Card.Title>{task.title}</Card.Title>
          <Card.Description>
            {task.project?.name || "بدون پروژه"}
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <Text>{task.description || "بدون توضیح"}</Text>
          <Chip
            data-tone={priorityTone(task.priority)}
            size="sm"
            variant="soft"
            color={task.priority === "urgent" ? "danger" : "default"}
          >
            {priorities[task.priority]}
          </Chip>
          <Description>
            {task.executionDate
              ? "موعد: " + jalaliDate(task.executionDate)
              : "بدون موعد"}
          </Description>
          <Description>مسئول: {task.assigneePrimaryId === permissions.userId ? "شما" : task.assigneePrimary?.fullName || "عضو سازمان"}</Description>
          <Description>{stage(task)}</Description>
          {needsMyAction(task) && <span className="task-action-badge">نوبت اقدام شما</span>}
        </Card.Content>
        <Card.Footer>{actions(task)}</Card.Footer>
      </Card>
    </div>
  );
  const pager = (
    <div className="task-table-footer">
      <Text>
        {state.data.total
          ? number((page - 1) * 25 + 1) +
            " تا " +
            number(Math.min(page * 25, state.data.total)) +
            " از " +
            number(state.data.total) +
            " تسک"
          : "۰ تسک"}
      </Text>
      <div className="task-paging">
        <Button
          size="sm"
          variant="outline"
          isDisabled={page <= 1 || state.loading}
          onPress={() => setPage((value) => value - 1)}
        >
          قبلی
        </Button>
        <Text>
          صفحه {number(page)} از{" "}
          {number(Math.max(1, Math.ceil(state.data.total / 25)))}
        </Text>
        <Button
          size="sm"
          variant="outline"
          isDisabled={page * 25 >= state.data.total || state.loading}
          onPress={() => setPage((value) => value + 1)}
        >
          بعدی
        </Button>
      </div>
    </div>
  );
  return (
    <section className="tasks-page">
      <header className="tasks-intro">
        <div><span className="tasks-intro-eyebrow">فضای تسک‌ها</span><h2>کارهای تیم را شفاف پیش ببرید</h2><p>مسئول، موعد و مرحلهٔ هر کار را یکجا ببینید؛ برای اقدام بعدی وارد جزئیات تسک شوید.</p></div>
        {internal && <Button onPress={() => setCreateOpen(true)}><Plus size={17}/> ساخت تسک</Button>}
      </header>
      <div className="tasks-overview" aria-label="خلاصه تسک‌های صفحه جاری">
        <div><span>تسک‌های این صفحه</span><strong>{number(state.data.items.length)}</strong><small>از {number(state.data.total)} نتیجه</small></div>
        <div><span>نوبت اقدام شما</span><strong>{number(myTurn)}</strong><small>در گردش‌کارهای این صفحه</small></div>
        <div><span>موعد نزدیک یا گذشته</span><strong>{number(dueSoon)}</strong><small>در همین صفحه، تا سه روز آینده</small></div>
      </div>
      <div className="task-page-toolbar">
        <div>
          <Text className="task-section-label">همه تسک‌های شما</Text>
          <Description>کارهای قابل دسترسی در سازمان فعلی</Description>
        </div>
        <div className="task-toolbar-actions">
          <Button
            variant="outline"
            isDisabled={state.busy}
            onPress={() =>
              void state.act(
                () => downloadExport(api, "tasks"),
                "خروجی تسک‌ها دریافت شد.",
              )
            }
          >
            <Download size={16} />
            خروجی
          </Button>
          <Button
            variant="outline"
            isIconOnly
            aria-label="تازه‌سازی تسک‌ها"
            isDisabled={state.loading}
            onPress={state.refresh}
          >
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>
      {state.error && <TaskMessage error message={state.error} />}{" "}
      {(notice || state.notice) && (
        <TaskMessage message={notice || state.notice} />
      )}
      <Card className="tasks-list-card">
        <Card.Header className="task-list-header">
          <div>
            <Card.Title>فهرست تسک‌ها</Card.Title>
            <Card.Description>
              {state.loading
                ? "در حال دریافت…"
                : number(state.data.total) + " تسک"}
            </Card.Description>
          </div>
          <div className="task-view-switch">
            {[
              { id: "table", label: "جدول", icon: List },
              { id: "board", label: "برد", icon: LayoutGrid },
              { id: "gantt", label: "گانت", icon: CheckCheck },
              { id: "calendar", label: "تقویم", icon: CalendarDays },
            ].map((row) => (
              <Button
                key={row.id}
                size="sm"
                variant={view === row.id ? "primary" : "ghost"}
                aria-pressed={view === row.id}
                onPress={() => setView(row.id)}
              >
                <row.icon size={15} />
                {row.label}
              </Button>
            ))}
          </div>
        </Card.Header>
        <Card.Content className="task-list-content">
          <div className="task-filter-grid">
            <TextField
              fullWidth
              type="search"
              value={search}
              onChange={setSearch}
            >
              <Label>جستجوی تسک</Label>
              <Input maxLength={200} placeholder="عنوان تسک را جستجو کنید…" />
            </TextField>
            <TaskSelect
              label="وضعیت"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={[
                { id: "all", name: "همه وضعیت‌ها" },
                ...Object.entries(statuses).map(([id, name]) => ({ id, name })),
              ]}
            />
            <TaskSelect
              label="اولویت"
              value={priority}
              onChange={(value) => {
                setPriority(value);
                setPage(1);
              }}
              options={[
                { id: "all", name: "همه اولویت‌ها" },
                ...Object.entries(priorities).map(([id, name]) => ({
                  id,
                  name,
                })),
              ]}
            />
          </div>
          <div className="task-filter-extras">
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={filtersOpen}
              onPress={() => setFiltersOpen((value) => !value)}
            >
              {filtersOpen ? "بستن فیلترهای بیشتر" : "مرتب‌سازی و بازه موعد"}
            </Button>
            {(search ||
              status !== "all" ||
              priority !== "all" ||
              from ||
              to ||
              sort !== "newest") && (
              <Button
                variant="ghost"
                size="sm"
                onPress={() => {
                  setSearch("");
                  setQuery("");
                  setStatus("all");
                  setPriority("all");
                  setFrom("");
                  setTo("");
                  setSort("newest");
                  setPage(1);
                }}
              >
                پاک کردن فیلترها
              </Button>
            )}
          </div>
          {filtersOpen && (
            <div className="task-filter-grid">
              <TaskSelect
                label="مرتب‌سازی"
                value={sort}
                onChange={(value) => {
                  setSort(value);
                  setPage(1);
                }}
                options={[
                  { id: "newest", name: "جدیدترین" },
                  { id: "due", name: "موعد" },
                  { id: "title", name: "عنوان" },
                ]}
              />
              <JalaliDateField
                label="از موعد (شمسی)"
                value={from}
                onChange={(value) => {
                  setFrom(value);
                  setPage(1);
                }}
              />
              <JalaliDateField
                label="تا موعد (شمسی)"
                value={to}
                onChange={(value) => {
                  setTo(value);
                  setPage(1);
                }}
                min={from || undefined}
              />
            </div>
          )}
          {state.loading && (
            <div className="task-loading" role="status">
              <Spinner size="sm" />
              <Text>در حال دریافت تسک‌ها…</Text>
            </div>
          )}
          {view === "table" ? (
            <Table
              variant="secondary"
              className="workspace-data-table tasks-table"
            >
              <Table.ScrollContainer>
                <Table.Content aria-label="جدول تسک‌ها">
                  <Table.Header>
                    <Table.Column id="title" isRowHeader>
                      تسک
                    </Table.Column>
                    <Table.Column id="project">پروژه</Table.Column>
                    <Table.Column id="assignee">مسئول</Table.Column>
                    <Table.Column id="priority">اولویت</Table.Column>
                    <Table.Column id="status">وضعیت</Table.Column>
                    <Table.Column id="due">موعد</Table.Column>
                    <Table.Column id="workflow">گردش‌کار</Table.Column>
                    <Table.Column id="actions">عملیات</Table.Column>
                  </Table.Header>
                  <Table.Body
                    items={state.data.items}
                    renderEmptyState={() => (
                      <div className="task-empty">
                        <CheckCheck size={32} />
                        <Text>
                          {state.loading
                            ? "در حال دریافت…"
                            : state.error
                              ? "دریافت تسک‌ها انجام نشد"
                              : query ||
                                  status !== "all" ||
                                  priority !== "all" ||
                                  from ||
                                  to
                                ? "تسکی با این فیلتر پیدا نشد"
                                : "هنوز تسکی ندارید"}
                        </Text>
                        <Description>
                          تسک‌های دارای دسترسی شما در این جدول نمایش داده
                          می‌شوند.
                        </Description>
                        {internal && !state.loading && !state.error && (
                          <TableAction
                            label="ساخت تسک"
                            variant="primary"
                            onPress={() => setCreateOpen(true)}
                          >
                            <Plus size={18} />
                          </TableAction>
                        )}
                      </div>
                    )}
                  >
                    {(task) => (
                      <Table.Row id={task.id} textValue={task.title}>
                        <Table.Cell>
                          <button type="button" className="task-title-button" onClick={() => openDetails(task.id)} aria-label={"جزئیات تسک " + task.title}>
                            <CheckCheck size={18} />
                            <span>
                              <strong>{task.title}</strong>
                              <Text className="task-description">
                                {task.description || "بدون توضیح"}
                              </Text>
                            </span>
                          </button>
                        </Table.Cell>
                        <Table.Cell>
                          {task.project?.name || "بدون پروژه"}
                        </Table.Cell>
                        <Table.Cell>
                          {task.assigneePrimaryId === permissions.userId
                            ? "شما"
                            : task.assigneePrimary?.fullName || "عضو سازمان"}
                        </Table.Cell>
                        <Table.Cell>
                          <Chip
                            data-tone={priorityTone(task.priority)}
                            size="sm"
                            variant="soft"
                            color={
                              task.priority === "urgent"
                                ? "danger"
                                : task.priority === "high"
                                  ? "warning"
                                  : "default"
                            }
                          >
                            {priorities[task.priority]}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip
                            data-tone={statusTone(task.status)}
                            size="sm"
                            variant="soft"
                            color={
                              task.status === "done"
                                ? "success"
                                : task.status === "blocked"
                                  ? "danger"
                                  : task.status === "doing"
                                    ? "accent"
                                    : "default"
                            }
                          >
                            {statuses[task.status]}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>
                          {task.executionDate
                            ? jalaliDate(task.executionDate)
                            : "—"}
                        </Table.Cell>
                        <Table.Cell>
                          <span className="task-workflow-cell"><Text className="task-stage">{stage(task)}</Text>{needsMyAction(task) && <span className="task-action-badge">نوبت شما</span>}</span>
                        </Table.Cell>
                        <Table.Cell>{actions(task)}</Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
              <Table.Footer>{pager}</Table.Footer>
            </Table>
          ) : (
            <div className="task-alternate-view">
              {view !== "gantt" && (
                <Description>
                  این نما تسک‌های همین صفحه و فیلتر را نمایش می‌دهد.
                </Description>
              )}
              {view === "gantt" ? (
                <Gantt
                  api={previewApi}
                  initialDates={state.data.items}
                  filters={{
                    search: query,
                    status,
                    priority,
                    dueFrom: from,
                    dueTo: to,
                  }}
                  revision={ganttRevision}
                  onOpen={openDetails}
                  onChanged={state.refresh}
                />
              ) : view === "calendar" ? (
                <Calendar
                  tasks={state.data.items}
                  onOpen={(task) => openDetails(task.id)}
                />
              ) : (
                <div className="task-board">
                  {Object.entries(statuses).map(([value, label]) => (
                    <Card
                      className="task-board-column"
                      data-tone={statusTone(value)}
                      key={value}
                    >
                      <Card.Header>
                        <Card.Title>{label}</Card.Title>
                        <Chip size="sm" variant="soft">
                          {number(
                            state.data.items.filter(
                              (row) => row.status === value,
                            ).length,
                          )}
                        </Chip>
                      </Card.Header>
                      <Card.Content>
                        {!state.data.items.some(row => row.status === value) && <p className="task-board-empty">در این ستون تسکی نیست.</p>}
                        {state.data.items
                          .filter((row) => row.status === value)
                          .map(card)}
                      </Card.Content>
                    </Card>
                  ))}
                </div>
              )}
              {view !== "gantt" && pager}
            </div>
          )}
        </Card.Content>
      </Card>
      {createOpen && (
        <CreateTaskModal
          api={api}
          permissions={permissions}
          onClose={() => setCreateOpen(false)}
          onCreated={(title) => {
            setCreateOpen(false);
            setSearch("");
            setQuery("");
            setStatus("all");
            setPriority("all");
            setFrom("");
            setTo("");
            setSort("newest");
            setPage(1);
            setNotice("تسک «" + title + "» ساخته شد.");
            state.refresh();
          }}
        />
      )}
      {detailId && (
        <TaskDetails
          key={detailId + (editing ? ":edit" : ":view")}
          initialMode={editing? "edit" : "view"}
          api={api}
          id={detailId}
          permissions={permissions}
          onClose={() => setDetailId("")}
          onChanged={() => {
            state.refresh();
            setGanttRevision((value) => value + 1);
          }}
        />
      )}
    </section>
  );
}
