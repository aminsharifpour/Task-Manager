import { TaskPicker } from "./hero-task-fields";
import { statusTone } from "./palette";
import JalaliDateField from "./jalali-date-field";
import TableAction from "./table-action";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  Table,
  Text,
  TextArea,
  TextField,
} from "@heroui/react";
import {
  ArrowLeft,
  Eye,
  FolderKanban,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { emptyPage, useModule } from "./use-module";
import { displayDate } from "./dates";
import type { Request } from "./use-module";
import "./projects-panel.css";

type Project = {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  owner?: { fullName: string };
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  templateId: string | null;
  workflowTemplateSteps?: { id: string; title: string; requiresApproval: boolean; assigneeType: string }[] | null;
};
type Template = {
  id: string;
  name: string;
  tasks: string[];
  fields: {
    id: string;
    label: string;
    required: boolean;
    type: string;
    options?: string[];
  }[];
};
const statuses: Record<string, string> = {
  active: "فعال",
  paused: "متوقف",
  completed: "تکمیل‌شده",
  archived: "بایگانی",
};
const number = (value: number) => new Intl.NumberFormat("fa").format(value);
function ProjectSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <Select
      className="project-select"
      fullWidth
      aria-label={label}
      value={value || null}
      onChange={(value) => onChange(String(value || ""))}
      isDisabled={disabled}
      isRequired={required}
      placeholder="انتخاب کنید"
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="project-popover" dir="rtl">
        <ListBox items={options}>
          {(item) => (
            <ListBox.Item id={item.id} textValue={item.name}>
              <Label>{item.name}</Label>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
function Message({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  return (
    <Alert status={error ? "danger" : "success"}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
export default function ProjectsPanel({
  api,
  canCreate,
  initialProjectId = "",
  onManage,
}: {
  api: Request;
  canCreate: boolean;
  initialProjectId?: string;
  onManage: (id: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [page, setPage] = useState(1),
    [createOpen, setCreateOpen] = useState(false),
    [detail, setDetail] = useState(initialProjectId),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (initialProjectId) setDetail(initialProjectId);
  }, [initialProjectId]);
  const state = useModule(
    api,
    "/projects?page=" +
      page +
      "&pageSize=25&search=" +
      encodeURIComponent(query) +
      (status !== "all" ? "&status=" + status : ""),
    emptyPage<Project>(),
  );
  useEffect(() => {
    const last = Math.max(1, Math.ceil(state.data.total / 25));
    if (!state.loading && page > last) setPage(last);
  }, [state.data.total, state.loading, page]);
  return (
    <section className="projects-page">
      <header className="projects-intro">
        <div>
          <span className="projects-intro-eyebrow">فضای پروژه‌ها</span>
          <h2>کار تیم را از اینجا شروع کنید</h2>
          <p>هر پروژه، محل برنامه‌ریزی تسک‌ها، تعیین مسئولیت‌ها و پیگیری مسیر انجام کار است.</p>
        </div>
        {canCreate && <Button onPress={() => setCreateOpen(true)}><Plus size={17} /> ساخت پروژه</Button>}
      </header>
      <ol className="projects-journey" aria-label="مراحل راه‌اندازی پروژه">
        <li><span>۱</span><div><strong>پروژه را بسازید</strong><small>نام، مسئول و در صورت نیاز قالب آماده را انتخاب کنید.</small></div></li>
        <li><span>۲</span><div><strong>مسیر کار را روشن کنید</strong><small>در مدیریت پروژه، مراحل و تأییدکننده‌ها را تنظیم کنید.</small></div></li>
        <li><span>۳</span><div><strong>تسک‌ها را پیش ببرید</strong><small>تسک جدید بسازید و اقدام بعدی هر مرحله را دنبال کنید.</small></div></li>
      </ol>
      <div className="projects-page-toolbar">
        <div>
          <Text className="projects-section-label">همه پروژه‌های شما</Text>
          <Text className="projects-page-caption">
            پروژه‌های قابل دسترسی در سازمان فعلی
          </Text>
        </div>
        <div className="projects-toolbar-actions">
          <Button
            variant="outline"
            isDisabled={state.loading}
            onPress={state.refresh}
            aria-label="تازه‌سازی پروژه‌ها"
          >
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>
      {notice && <Message message={notice} />}{" "}
      {state.error && <Message error message={state.error} />}
      <Card className="projects-list-card">
        <Card.Header className="projects-list-header">
          <div>
            <Card.Title>فهرست پروژه‌ها</Card.Title>
            <Card.Description>
              {state.loading
                ? "در حال دریافت…"
                : number(state.data.total) + " پروژه"}
            </Card.Description>
          </div>
          <Chip data-tone="blue" size="sm" variant="soft" color="accent">
            جدول پروژه‌ها
          </Chip>
        </Card.Header>
        <Card.Content className="projects-list-content">
          <div className="projects-list-filters">
            <TextField
              aria-label="جستجوی پروژه"
              value={search}
              onChange={setSearch}
              className="project-search"
              type="search"
            >
              <Label>جستجوی پروژه</Label>
              <div className="project-search-control">
                <Search size={16} />
                <Input placeholder="نام پروژه را جستجو کنید…" maxLength={200} />
              </div>
            </TextField>
            <ProjectSelect
              label="وضعیت پروژه"
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
          </div>
          {(search || status !== "all") && <Button size="sm" variant="ghost" onPress={() => {setSearch("");setQuery("");setStatus("all");setPage(1);}}>پاک کردن فیلترها</Button>}
          {state.loading && (
            <div className="projects-loading" role="status">
              <Spinner size="sm" />
              <Text>در حال دریافت پروژه‌ها…</Text>
            </div>
          )}
          <Table
            variant="secondary"
            className="workspace-data-table projects-table"
          >
            <Table.ScrollContainer>
              <Table.Content
                aria-label="جدول پروژه‌ها"
                aria-busy={state.loading}
              >
                <Table.Header>
                  <Table.Column id="name" isRowHeader>
                    پروژه
                  </Table.Column>
                  <Table.Column id="owner">مسئول پروژه</Table.Column>
                  <Table.Column id="status">وضعیت</Table.Column>
                  <Table.Column id="start">شروع</Table.Column>
                  <Table.Column id="end">تحویل</Table.Column>
                  <Table.Column id="created">تاریخ ایجاد</Table.Column>
                  <Table.Column id="actions">عملیات</Table.Column>
                </Table.Header>
                <Table.Body
                  items={state.data.items}
                  renderEmptyState={() => (
                    <div className="projects-empty">
                      <FolderKanban size={32} />
                      <Text>
                        {state.error
                          ? "دریافت پروژه‌ها انجام نشد"
                          : state.loading
                            ? "در حال دریافت…"
                            : query || status !== "all"
                              ? "پروژه‌ای با این فیلتر پیدا نشد"
                              : "هنوز پروژه‌ای ندارید"}
                      </Text>
                      <Description>
                        {query || status !== "all"
                          ? "جستجو یا وضعیت را تغییر دهید."
                          : "پروژه‌های شما در این جدول نمایش داده می‌شوند."}
                      </Description>
                      {canCreate &&
                        !query &&
                        status === "all" &&
                        !state.loading && (
                          <TableAction
                            label="ساخت اولین پروژه"
                            variant="primary"
                            onPress={() => setCreateOpen(true)}
                          >
                            <Plus size={18} />
                          </TableAction>
                        )}
                    </div>
                  )}
                >
                  {(row) => (
                    <Table.Row id={row.id} textValue={row.name}>
                      <Table.Cell>
                        <button type="button" className="project-name-button" onClick={() => setDetail(row.id)} aria-label={"جزئیات پروژه " + row.name}>
                          <FolderKanban size={18} />
                          <span>
                            <strong>{row.name}</strong>
                            <Text className="project-description">
                              {row.description || "بدون توضیح"}
                            </Text>
                          </span>
                        </button>
                      </Table.Cell>
                      <Table.Cell>
                        {row.owner?.fullName || "مسئول پروژه"}
                      </Table.Cell>
                      <Table.Cell>
                        <Chip
                          data-tone={statusTone(row.status)}
                          size="sm"
                          variant="soft"
                          color={
                            row.status === "active"
                              ? "accent"
                              : row.status === "completed"
                                ? "success"
                                : row.status === "paused"
                                  ? "warning"
                                  : "default"
                          }
                        >
                          {statuses[row.status] || row.status}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        {row.startDate ? displayDate(row.startDate) : "—"}
                      </Table.Cell>
                      <Table.Cell>
                        {row.endDate ? displayDate(row.endDate) : "—"}
                      </Table.Cell>
                      <Table.Cell>
                        {displayDate(row.createdAt, true).split("،")[0]}
                      </Table.Cell>
                      <Table.Cell>
                        <TableAction
                          label={"مشاهده پروژه " + row.name}
                          onPress={() => setDetail(row.id)}
                        >
                          <Eye size={18} />
                        </TableAction>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
            <Table.Footer className="projects-table-footer">
              <Text>
                {state.data.total
                  ? number((page - 1) * 25 + 1) +
                    " تا " +
                    number(Math.min(page * 25, state.data.total)) +
                    " از " +
                    number(state.data.total) +
                    " پروژه"
                  : "۰ پروژه"}
              </Text>
              <div className="projects-paging">
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
      {createOpen && (
        <CreateProject
          api={api}
          onClose={() => setCreateOpen(false)}
          onCreated={(name) => {
            setCreateOpen(false);
            setSearch("");
            setQuery("");
            setStatus("all");
            setPage(1);
            setNotice("پروژه «" + name + "» ساخته شد.");
            state.refresh();
          }}
        />
      )}
      {detail && (
        <ProjectDetail
          key={detail}
          api={api}
          id={detail}
          row={state.data.items.find((row) => row.id === detail)}
          canManage={canCreate}
          onClose={() => setDetail("")}
          onManage={() => onManage(detail)}
        />
      )}
    </section>
  );
}
function CreateProject({
  api,
  onClose,
  onCreated,
}: {
  api: Request;
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    ownerId: "self",
    startDate: "",
    endDate: "",
    templateId: "none",
    starter: "yes",
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submitting = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const templates = useModule<Template[]>(api, "/project-templates", []);
  const change = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const selectedTemplate = templates.data.find(
    (row) => row.id === form.templateId,
  );
  const invalidDates = Boolean(
    form.startDate && form.endDate && form.endDate < form.startDate,
  );
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open && !submitting.current) onClose();
      }}
      isDismissable={!busy}
      isKeyboardDismissDisabled={busy}
      className="project-modal-backdrop"
    >
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog className="project-modal" dir="rtl">
          <Modal.CloseTrigger aria-label="بستن ساخت پروژه" isDisabled={busy} />
          <Modal.Header>
            <Modal.Icon>
              <FolderKanban size={23} />
            </Modal.Icon>
            <Modal.Heading>پروژه جدید</Modal.Heading>
              <Description>پروژه را در دو گام بسازید: اطلاعات اصلی و الگوی شروع کار.</Description>
          </Modal.Header>
          <Form
            className="project-create-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (submitting.current) return;
              if (!form.ownerId) {
                setError("مسئول پروژه را از پیشنهادها انتخاب کنید.");
                return;
              }
              if (!form.name.trim()) {
                setError("نام پروژه را وارد کنید.");
                return;
              }
              if (invalidDates) {
                setError("تاریخ تحویل نباید پیش از تاریخ شروع باشد.");
                return;
              }
              submitting.current = true;
              setBusy(true);
              setError("");
              void api<Project>("/projects", {
                method: "POST",
                body: JSON.stringify({
                  name: form.name.trim(),
                  description: form.description.trim(),
                  ownerId: form.ownerId === "self" ? undefined : form.ownerId,
                  startDate: form.startDate || null,
                  endDate: form.endDate || null,
                  templateId:
                    form.templateId === "none" ? null : form.templateId,
                  createStarterTasks: form.starter === "yes",
                }),
              })
                .then((row) => {
                  if (mounted.current) onCreated(row.name);
                })
                .catch((error) => {
                  if (mounted.current)
                    setError(
                      error instanceof Error
                        ? error.message
                        : "ثبت پروژه انجام نشد.",
                    );
                })
                .finally(() => {
                  submitting.current = false;
                  if (mounted.current) setBusy(false);
                });
            }}
          >
            <Modal.Body>
              {error && <Message error message={error} />}
              <div className="project-form-section-title"><span>۱</span><div><strong>اطلاعات اصلی</strong><small>نام، هدف، مسئول و زمان‌بندی پروژه</small></div></div>
              <TextField
                name="name"
                value={form.name}
                onChange={(value) => change("name", value)}
                isRequired
                isDisabled={busy}
                autoFocus
              >
                <Label>نام پروژه</Label>
                <Input
                  placeholder="مثلاً بازطراحی وب‌سایت شرکت"
                  maxLength={200}
                />
                <FieldError />
              </TextField>
              <TextField
                name="description"
                value={form.description}
                onChange={(value) => change("description", value)}
                isDisabled={busy}
              >
                <Label>توضیح پروژه</Label>
                <TextArea
                  rows={3}
                  maxLength={5000}
                  placeholder="هدف، محدوده و خروجی مورد انتظار پروژه…"
                />
                <Description>اختیاری؛ حداکثر ۵۰۰۰ نویسه.</Description>
              </TextField>
              <TaskPicker
                api={api}
                resource="members" label="مسئول پروژه"
                required
                disabled={busy}
                value={form.ownerId}
                selfId="self"
                selfLabel="خودم (ایجادکننده پروژه)"
                currentLabel="مسئول انتخاب‌شده"
                onChange={(value) => change("ownerId", value)}
              />
              <Description>مسئول باید عضو داخلی سازمان باشد.</Description>
              <div className="project-form-grid">
                <JalaliDateField
                  label="تاریخ شروع (شمسی)"
                  value={form.startDate}
                  onChange={(value) => change("startDate", value)}
                  disabled={busy}
                  max={form.endDate || undefined}
                />
                <JalaliDateField
                  label="تاریخ تحویل (شمسی)"
                  value={form.endDate}
                  onChange={(value) => change("endDate", value)}
                  disabled={busy}
                  min={form.startDate || undefined}
                />
              </div>
              <div className="project-form-section-title"><span>۲</span><div><strong>روش شروع کار</strong><small>قالب آماده، مراحل و تسک‌های آغازین</small></div></div>
              <ProjectSelect
                label="قالب اولیه پروژه"
                value={form.templateId}
                disabled={busy || templates.loading}
                onChange={(value) => change("templateId", value)}
                options={[
                  { id: "none", name: "شروع از صفر" },
                  ...templates.data.map((row) => ({
                    id: row.id,
                    name: row.name,
                  })),
                ]}
              />
              {templates.error && (
                <>
                  <Message error message={templates.error} />
                  <Button
                    type="button"
                    variant="ghost"
                    onPress={templates.refresh}
                  >
                    دریافت دوباره قالب‌ها
                  </Button>
                </>
              )}
              {selectedTemplate && (
                <Card className="project-template-preview">
                  <Card.Header>
                    <Card.Title>{selectedTemplate.name}</Card.Title>
                    <Card.Description>
                      قالب گردش‌کار و فیلدهای مربوط به این نوع پروژه اعمال
                      می‌شود.
                    </Card.Description>
                  </Card.Header>
                  <Card.Content>
                    <Text>{selectedTemplate.tasks.join(" · ")}</Text>
                    <ProjectSelect
                      label="تسک‌های آغازین قالب"
                      value={form.starter}
                      disabled={busy}
                      onChange={(value) => change("starter", value)}
                      options={[
                        { id: "yes", name: "ساخت تسک‌های آغازین" },
                        { id: "no", name: "فقط قالب، بدون تسک آغازین" },
                      ]}
                    />
                  </Card.Content>
                </Card>
              )}
              <div className="project-form-next"><strong>بعد از ساخت چه کار کنم؟</strong><p>از جزئیات پروژه وارد «مدیریت و گردش‌کار» شوید، مراحل را بازبینی کنید و سپس در بخش تسک‌ها کارهای تیم را بسازید.</p></div>
            </Modal.Body>
            <Modal.Footer>
              <Button
                type="button"
                variant="outline"
                isDisabled={busy}
                onPress={onClose}
              >
                انصراف
              </Button>
              <Button
                type="submit"
                isDisabled={
                  busy || invalidDates || !form.name.trim() || !form.ownerId
                }
                isPending={busy}
              >
                <Plus size={17} />
                {busy ? "در حال ساخت…" : "ساخت پروژه"}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
function ProjectDetail({
  api,
  id,
  row,
  canManage,
  onClose,
  onManage,
}: {
  api: Request;
  id: string;
  row?: Project;
  canManage: boolean;
  onClose: () => void;
  onManage: () => void;
}) {
  const state = useModule<Project | null>(
    api,
    "/projects/" + encodeURIComponent(id),
    null,
  );
  const project = state.data;
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container size="md">
        <Modal.Dialog className="project-modal" dir="rtl">
          <Modal.CloseTrigger aria-label="بستن جزئیات پروژه" />
          <Modal.Header>
            <Modal.Icon>
              <FolderKanban size={22} />
            </Modal.Icon>
            <Modal.Heading>{project?.name || "جزئیات پروژه"}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {state.error ? (
              <Message error message={state.error} />
            ) : state.loading ? (
              <Spinner />
            ) : (
              project && (
                <>
                  <Chip
                    data-tone={statusTone(project.status)}
                    size="sm"
                    variant="soft"
                    color="accent"
                  >
                    {statuses[project.status] || project.status}
                  </Chip>
                  <Text className="project-detail-description">
                    {project.description ||
                      "توضیحی برای این پروژه ثبت نشده است."}
                  </Text>
                  <div className="project-detail-grid">
                    {[
                      [
                        "مسئول پروژه",
                        project.owner?.fullName ||
                          row?.owner?.fullName ||
                          "مسئول تعیین‌شده",
                      ],
                      [
                        "شروع",
                        project.startDate
                          ? displayDate(project.startDate)
                          : "تعیین نشده",
                      ],
                      [
                        "تحویل",
                        project.endDate
                          ? displayDate(project.endDate)
                          : "تعیین نشده",
                      ],
                      ["تاریخ ایجاد", displayDate(project.createdAt, true)],
                    ].map(([label, value]) => (
                      <Card key={label}>
                        <Card.Header>
                          <Card.Description>{label}</Card.Description>
                          <Card.Title>{value}</Card.Title>
                        </Card.Header>
                      </Card>
                    ))}
                  </div>
                  <div className="project-detail-workflow">
                    <div className="project-detail-workflow-heading"><strong>مسیر کار این پروژه</strong><span>{number(project.workflowTemplateSteps?.length || 0)} مرحله</span></div>
                    {project.workflowTemplateSteps?.length ? <ol>{project.workflowTemplateSteps.map((step, index) => <li key={step.id}><span>{number(index + 1)}</span><div><strong>{step.title}</strong><small>{step.requiresApproval ? "نیازمند تأیید" : "مرحله اجرایی"}</small></div></li>)}</ol> : <p>هنوز گردش‌کار مرحله‌ای تعریف نشده است. می‌توانید از مدیریت پروژه برای تسک‌های جدید مسیر مشخص کنید.</p>}
                  </div>
                </>
              )
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline" onPress={onClose}>
              بستن
            </Button>
            {canManage && project && (
              <Button onPress={onManage}>
                مدیریت و گردش‌کار پروژه
                <ArrowLeft size={16} />
              </Button>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
