import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  Modal,
  Spinner,
  Table,
  Text,
  TextField,
} from "@heroui/react";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  Eye,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import JalaliDateField from "./jalali-date-field";
import TableAction from "./table-action";
import MinuteFiles from "./minute-files";
import { emptyPage, useModule } from "./use-module";
import type { Request, Permissions } from "./use-module";
import type { Minute } from "./minute-types";
import { displayDate, workspaceToday } from "./dates";
import { TaskMessage } from "./hero-task-fields";
import "./minutes-panel.css";

const number = (value: number) => new Intl.NumberFormat("fa").format(value);
const MinuteEditorDialog = lazy(() => import("./minute-editor-dialog"));
const MinuteDetailDialog = lazy(() => import("./minute-detail-dialog"));
type View = "active" | "archived";
type DateMode = "exact" | "range";

export default function MinutesPanel({
  api,
  permissions,
  initialMinuteId = "",
}: {
  api: Request;
  permissions: Permissions;
  initialMinuteId?: string;
}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [dateMode, setDateMode] = useState<DateMode>("exact");
  const [exactDate, setExactDate] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [view, setView] = useState<View>("active");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<Minute | null | undefined>();
  const [detail, setDetail] = useState(initialMinuteId);
  const [files, setFiles] = useState<{ id: string; title: string }>();
  const [removing, setRemoving] = useState<Minute>();
  const [archiveBusy, setArchiveBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (initialMinuteId) setDetail(initialMinuteId);
  }, [initialMinuteId]);
  const dateFrom = dateMode === "exact" ? exactDate : from;
  const dateTo = dateMode === "exact" ? exactDate : to;
  const state = useModule(
    api,
    "/minutes?page=" +
      page +
      "&pageSize=25&view=" +
      view +
      "&search=" +
      encodeURIComponent(query) +
      (dateFrom ? "&from=" + dateFrom : "") +
      (dateTo ? "&to=" + dateTo : ""),
    emptyPage<Minute>(),
  );
  useEffect(() => {
    const last = Math.max(1, Math.ceil(state.data.total / 25));
    if (!state.loading && page > last) setPage(last);
  }, [page, state.loading, state.data.total]);
  const manager = ["owner", "admin", "project_manager"].includes(
    permissions.role,
  );
  const clearFilters = () => {
    setSearch("");
    setQuery("");
    setExactDate("");
    setFrom("");
    setTo("");
    setPage(1);
  };
  const toggleArchive = async (minute: Minute) => {
    if (archiveBusy) return;
    setArchiveBusy(minute.id);
    setActionError("");
    setNotice("");
    try {
      await api("/minutes/" + encodeURIComponent(minute.id) + "/archive", {
        method: "PATCH",
        body: JSON.stringify({ archived: !minute.archivedAt }),
      });
      setDetail("");
      setNotice(
        minute.archivedAt
          ? "صورت‌جلسه از آرشیو بازگردانده شد."
          : "صورت‌جلسه به آرشیو منتقل شد.",
      );
      state.refresh();
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : "تغییر وضعیت آرشیو انجام نشد.",
      );
    } finally {
      setArchiveBusy("");
    }
  };
  const hasFilters = Boolean(search || dateFrom || dateTo);
  return (
    <section className="minutes-page">
      <header className="minutes-intro">
        <div>
          <span className="minutes-eyebrow">ثبت و پیگیری جلسات</span>
          <h2>هر جلسه، یک سند قابل پیگیری</h2>
          <p>
            گفتگوها، تصمیم‌ها و اقدام‌های بعدی را در یک صورت‌جلسه کامل ثبت کنید؛
            بعداً آن را با تاریخ یا عنوان پیدا کنید.
          </p>
        </div>
        {manager && (
          <Button onPress={() => setEditor(null)}>
            <Plus size={17} />
            صورت‌جلسه جدید
          </Button>
        )}
      </header>
      <div className="minutes-steps" aria-label="روند کار صورت‌جلسه">
        <div>
          <span>۱</span>
          <strong>مشخصات جلسه</strong>
          <small>عنوان، تاریخ و حاضران</small>
        </div>
        <div>
          <span>۲</span>
          <strong>متن و تصمیم‌ها</strong>
          <small>ویرایشگر کامل با جدول و فهرست</small>
        </div>
        <div>
          <span>۳</span>
          <strong>نگهداری و بازیابی</strong>
          <small>جست‌وجوی تاریخ و آرشیو</small>
        </div>
      </div>
      <div className="minutes-toolbar">
        <div>
          <Text className="minutes-section-label">صورت‌جلسه‌های سازمان</Text>
          <Description>
            جلسه‌های جاری و آرشیوشده را جداگانه مرور کنید.
          </Description>
        </div>
        <div className="minutes-toolbar-actions">
          <Button
            variant="outline"
            isIconOnly
            aria-label="تازه‌سازی صورت‌جلسه‌ها"
            isDisabled={state.loading}
            onPress={state.refresh}
          >
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>
      {state.error && <TaskMessage error message={state.error} />}
      {actionError && <TaskMessage error message={actionError} />}
      {notice && <TaskMessage message={notice} />}
      <Card className="minutes-list-card">
        <Card.Header className="minutes-list-header">
          <div>
            <Card.Title>فهرست صورت‌جلسه‌ها</Card.Title>
            <Card.Description>
              {state.loading
                ? "در حال دریافت…"
                : number(state.data.total) +
                  (view === "active"
                    ? " صورت‌جلسه جاری"
                    : " صورت‌جلسه آرشیوشده")}
            </Card.Description>
          </div>
          <div
            className="minutes-view-tabs"
            role="group"
            aria-label="نمای صورت‌جلسه‌ها"
          >
            <Button
              size="sm"
              variant={view === "active" ? "primary" : "ghost"}
              aria-pressed={view === "active"}
              onPress={() => {
                setView("active");
                setPage(1);
              }}
            >
              <FileText size={15} />
              جاری
            </Button>
            <Button
              size="sm"
              variant={view === "archived" ? "primary" : "ghost"}
              aria-pressed={view === "archived"}
              onPress={() => {
                setView("archived");
                setPage(1);
              }}
            >
              <Archive size={15} />
              آرشیو
            </Button>
          </div>
        </Card.Header>
        <Card.Content className="minutes-list-content">
          <div className="minutes-filter-heading">
            <div>
              <CalendarDays size={18} />
              <strong>پیدا کردن صورت‌جلسه</strong>
              <span>عنوان یا متن جلسه و تاریخ برگزاری را جست‌وجو کنید.</span>
            </div>
            {hasFilters && (
              <Button
                className="minutes-clear"
                variant="ghost"
                size="sm"
                onPress={clearFilters}
              >
                پاک کردن فیلترها
              </Button>
            )}
          </div>
          <div className="minutes-filters">
            <TextField
              fullWidth
              type="search"
              value={search}
              onChange={setSearch}
            >
              <Label>جست‌وجو در عنوان و متن</Label>
              <Input maxLength={200} placeholder="مثلاً برنامه‌ریزی محصول…" />
            </TextField>
            <div className="minutes-date-filter">
              <div
                className="minutes-date-switch"
                role="group"
                aria-label="نوع جست‌وجوی تاریخ"
              >
                <button
                  type="button"
                  aria-pressed={dateMode === "exact"}
                  onClick={() => {
                    setDateMode("exact");
                    setPage(1);
                  }}
                >
                  تاریخ دقیق
                </button>
                <button
                  type="button"
                  aria-pressed={dateMode === "range"}
                  onClick={() => {
                    setDateMode("range");
                    setPage(1);
                  }}
                >
                  بازهٔ تاریخ
                </button>
              </div>
              {dateMode === "exact" ? (
                <div className="minutes-exact-date">
                  <JalaliDateField
                    label="تاریخ جلسه (شمسی)"
                    value={exactDate}
                    onChange={(value) => {
                      setExactDate(value);
                      setPage(1);
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      setExactDate(workspaceToday());
                      setPage(1);
                    }}
                  >
                    امروز
                  </Button>
                </div>
              ) : (
                <div className="minutes-date-range">
                  <JalaliDateField
                    label="از تاریخ جلسه (شمسی)"
                    value={from}
                    onChange={(value) => {
                      setFrom(value);
                      setPage(1);
                    }}
                    max={to || undefined}
                  />
                  <JalaliDateField
                    label="تا تاریخ جلسه (شمسی)"
                    value={to}
                    onChange={(value) => {
                      setTo(value);
                      setPage(1);
                    }}
                    min={from || undefined}
                  />
                </div>
              )}
            </div>
          </div>
          {state.loading && (
            <div className="minutes-loading" role="status">
              <Spinner size="sm" />
              <Text>در حال دریافت صورت‌جلسه‌ها…</Text>
            </div>
          )}
          <Table
            variant="secondary"
            className="workspace-data-table minutes-table"
          >
            <Table.ScrollContainer>
              <Table.Content
                aria-label={
                  view === "active"
                    ? "جدول صورت‌جلسه‌های جاری"
                    : "جدول آرشیو صورت‌جلسه‌ها"
                }
                aria-busy={state.loading}
              >
                <Table.Header>
                  <Table.Column id="title" isRowHeader>
                    صورت‌جلسه
                  </Table.Column>
                  <Table.Column id="date">تاریخ جلسه</Table.Column>
                  <Table.Column id="summary">بخشی از متن</Table.Column>
                  <Table.Column id="attendees">حاضران</Table.Column>
                  <Table.Column id="files">پیوست‌ها</Table.Column>
                  <Table.Column id="actions">عملیات</Table.Column>
                </Table.Header>
                <Table.Body
                  items={state.data.items}
                  renderEmptyState={() => (
                    <div className="minutes-empty">
                      <FileText size={32} />
                      <Text>
                        {state.loading
                          ? "در حال دریافت…"
                          : state.error
                            ? "دریافت صورت‌جلسه‌ها انجام نشد"
                            : hasFilters
                              ? "صورت‌جلسه‌ای با این جست‌وجو پیدا نشد"
                              : view === "archived"
                                ? "آرشیو خالی است"
                                : "هنوز صورت‌جلسه‌ای ثبت نشده است"}
                      </Text>
                      <Description>
                        {hasFilters
                          ? "تاریخ یا عبارت جست‌وجو را تغییر دهید."
                          : view === "archived"
                            ? "صورت‌جلسه‌های بایگانی‌شده اینجا نمایش داده می‌شوند."
                            : "جلسه را با متن و تصمیم‌های آن ثبت کنید."}
                      </Description>
                      {manager &&
                        view === "active" &&
                        !hasFilters &&
                        !state.loading &&
                        !state.error && (
                          <TableAction
                            label="ثبت صورت‌جلسه"
                            variant="primary"
                            onPress={() => setEditor(null)}
                          >
                            <Plus size={18} />
                          </TableAction>
                        )}
                    </div>
                  )}
                >
                  {(row) => (
                    <Table.Row id={row.id} textValue={row.title}>
                      <Table.Cell>
                        <button
                          type="button"
                          className="minute-title-button"
                          aria-label={"جزئیات صورت‌جلسه " + row.title}
                          onClick={() => setDetail(row.id)}
                        >
                          <FileText size={18} />
                          <span>
                            <strong>{row.title}</strong>
                            {row.archivedAt && <small>آرشیوشده</small>}
                          </span>
                        </button>
                      </Table.Cell>
                      <Table.Cell>{displayDate(row.date)}</Table.Cell>
                      <Table.Cell>
                        <Text className="minute-preview">{row.summary}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text className="minute-attendees">
                          {row.attendees || "ثبت نشده"}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="workspace-table-actions">
                          <TableAction
                            label={"پیوست‌های " + row.title}
                            onPress={() =>
                              setFiles({ id: row.id, title: row.title })
                            }
                          >
                            <Paperclip size={18} />
                          </TableAction>
                          <Chip size="sm" variant="soft">
                            {number(row._count?.attachments || 0)}
                          </Chip>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="minute-row-actions">
                          <TableAction
                            label={"مشاهده صورت‌جلسه " + row.title}
                            onPress={() => setDetail(row.id)}
                          >
                            <Eye size={18} />
                          </TableAction>
                          {manager && (
                            <>
                              <TableAction
                                label={"ویرایش " + row.title}
                                onPress={() => setEditor(row)}
                              >
                                <Pencil size={18} />
                              </TableAction>
                              <TableAction
                                label={
                                  (row.archivedAt
                                    ? "بازگردانی از آرشیو "
                                    : "آرشیو ") + row.title
                                }
                                onPress={() => void toggleArchive(row)}
                              >
                                {row.archivedAt ? (
                                  <ArchiveRestore size={18} />
                                ) : (
                                  <Archive size={18} />
                                )}
                              </TableAction>
                              {view === "archived" && (
                                <TableAction
                                  label={"حذف " + row.title}
                                  onPress={() => setRemoving(row)}
                                  variant="danger-soft"
                                >
                                  <Trash2 size={18} />
                                </TableAction>
                              )}
                            </>
                          )}
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
            <Table.Footer className="minutes-table-footer">
              <Text>
                {state.data.total
                  ? number((page - 1) * 25 + 1) +
                    " تا " +
                    number(Math.min(page * 25, state.data.total)) +
                    " از " +
                    number(state.data.total) +
                    " صورت‌جلسه"
                  : "۰ صورت‌جلسه"}
              </Text>
              <div className="minutes-paging">
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
            </Table.Footer>
          </Table>
        </Card.Content>
      </Card>
      {editor !== undefined && (
        <Suspense
          fallback={
            <p role="status" className="minutes-loading">
              در حال آماده‌سازی ویرایشگر…
            </p>
          }
        >
          <MinuteEditorDialog
            key={editor?.id || "new"}
            api={api}
            minute={editor}
            onClose={() => setEditor(undefined)}
            onDone={(row) => {
              setEditor(undefined);
              setNotice("صورت‌جلسه «" + row.title + "» ذخیره شد.");
              state.refresh();
            }}
          />
        </Suspense>
      )}
      {detail && (
        <Suspense
          fallback={
            <p role="status" className="minutes-loading">
              در حال باز کردن صورت‌جلسه…
            </p>
          }
        >
          <MinuteDetailDialog
            key={detail}
            api={api}
            id={detail}
            manager={manager}
            onClose={() => setDetail("")}
            onEdit={(row) => {
              setDetail("");
              setEditor(row);
            }}
            onFiles={(row) => {
              setDetail("");
              setFiles({ id: row.id, title: row.title });
            }}
            onArchive={(row) => void toggleArchive(row)}
          />
        </Suspense>
      )}
      {files && (
        <Modal.Backdrop
          isOpen
          onOpenChange={(open) => {
            if (!open) setFiles(undefined);
          }}
        >
          <Modal.Container scroll="inside">
            <Modal.Dialog className="minute-modal" dir="rtl">
              <Modal.CloseTrigger aria-label="بستن پیوست‌ها" />
              <Modal.Header>
                <Modal.Heading>پیوست‌های صورت‌جلسه</Modal.Heading>
                <Description>{files.title}</Description>
              </Modal.Header>
              <Modal.Body>
                <MinuteFiles api={api} minuteId={files.id} />
              </Modal.Body>
              <Modal.Footer>
                <Button variant="outline" onPress={() => setFiles(undefined)}>
                  بستن
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
      {removing && (
        <DeleteMinute
          api={api}
          minute={removing}
          onClose={() => setRemoving(undefined)}
          onDone={() => {
            setRemoving(undefined);
            setNotice("صورت‌جلسه حذف شد.");
            state.refresh();
          }}
        />
      )}
    </section>
  );
}

function DeleteMinute({
  api,
  minute,
  onClose,
  onDone,
}: {
  api: Request;
  minute: Minute;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  return (
    <Modal.Backdrop
      isOpen
      isDismissable={!busy}
      isKeyboardDismissDisabled={busy}
      onOpenChange={(open) => {
        if (!open && !lock.current) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="minute-modal minute-delete-modal" dir="rtl">
          <Modal.CloseTrigger
            isDisabled={busy}
            aria-label="بستن حذف صورت‌جلسه"
          />
          <Modal.Header>
            <Modal.Heading>حذف صورت‌جلسه</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {error && <TaskMessage error message={error} />}
            <Text>صورت‌جلسه «{minute.title}» حذف شود؟</Text>
            <Description>
              این عمل برگشت‌پذیر نیست. صورت‌جلسه دارای پیوست قابل حذف نیست.
            </Description>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline" isDisabled={busy} onPress={onClose}>
              انصراف
            </Button>
            <Button
              variant="danger"
              isDisabled={busy || Boolean(minute._count?.attachments)}
              isPending={busy}
              onPress={() => {
                if (lock.current) return;
                lock.current = true;
                setBusy(true);
                setError("");
                void api("/minutes/" + encodeURIComponent(minute.id), {
                  method: "DELETE",
                })
                  .then(onDone)
                  .catch((reason) =>
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : "حذف صورت‌جلسه انجام نشد.",
                    ),
                  )
                  .finally(() => {
                    lock.current = false;
                    setBusy(false);
                  });
              }}
            >
              حذف صورت‌جلسه
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
