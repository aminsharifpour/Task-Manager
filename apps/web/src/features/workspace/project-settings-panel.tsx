import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { Input } from "@/components/ui/input";
import JalaliDateField from "./jalali-date-field";
import ResourcePicker from "./resource-picker";
import MemberPicker from "./member-picker";
import { useModule, emptyPage } from "./use-module";
import type { Request } from "./use-module";
import type { FieldDefinition } from "./task-details-panel";
import "./project-settings.css";

type Step = {
  id: string;
  title: string;
  requiresApproval: boolean;
  assigneeType: string;
  assigneeMemberId?: string;
  assigneeRole?: string;
  approvalAssigneeType: string;
  approvalAssigneeMemberId?: string;
  approvalAssigneeRole?: string;
  dueDate?: string;
  approvalDeadline?: string;
  onApprove: string;
  onReject: string;
};
type Project = {
  members: { userId: string; user: { fullName: string } }[];
  id: string;
  name: string;
  description: string | null;
  version: number;
  status: string;
  ownerId: string;
  startDate: string | null;
  endDate: string | null;
  workflowTemplateSteps: Step[] | null;
  customFieldDefinitions: FieldDefinition[] | null;
};
const assigneeTypes: Record<string, string> = {
  task_assignee_primary: "مسئول اصلی تسک",
  task_assignee_secondary: "مسئول دوم تسک",
  task_assigner: "ایجادکننده تسک",
  project_owner: "مسئول پروژه",
  project_members: "اعضای پروژه",
  role: "نقش سازمانی",
  member: "عضو انتخاب‌شده",
  all_participants: "همه مشارکت‌کنندگان",
};
const roles: Record<string, string> = {
  owner: "مالک",
  admin: "مدیر سازمان",
  manager: "مدیر پروژه (نقش قدیمی)",
  project_manager: "مدیر پروژه",
  member: "عضو",
};
const projectStatuses: Record<string, string> = {
  active: "فعال",
  paused: "متوقف",
  completed: "تکمیل‌شده",
  archived: "بایگانی",
};
const routes: Record<string, string> = {
  next: "مرحله بعد",
  previous: "مرحله قبل",
  stay: "همین مرحله",
  done: "تکمیل تسک",
};
const number = (value: number) => new Intl.NumberFormat("fa").format(value);
const routeName = (value: string, steps: Step[]) =>
  routes[value] ||
  steps.find((step) => step.id === value)?.title ||
  "تعیین نشده";
const actorName = (step: Step, approval = false) => {
  const type = approval ? step.approvalAssigneeType : step.assigneeType;
  const role = approval ? step.approvalAssigneeRole : step.assigneeRole;
  return type === "role"
    ? roles[role || ""] || "نقش انتخاب‌نشده"
    : assigneeTypes[type] || "تعیین نشده";
};

export default function ProjectSettings({
  api,
  onChanged,
  initialProjectId = "",
}: {
  api: Request;
  onChanged: () => void;
  initialProjectId?: string;
}) {
  const list = useModule(
    api,
    "/projects?pageSize=100",
    emptyPage<{ id: string; name: string }>(),
  );
  const [id, setId] = useState(initialProjectId);
  useEffect(() => {
    if (!id && list.data.items.length) setId(list.data.items[0].id);
  }, [id, list.data]);
  return (
    <section className="project-settings-page">
      <header className="project-settings-hero">
        <span className="project-settings-eyebrow">تنظیمات پروژه</span>
        <h2>پروژه را برای کار تیم آماده کنید</h2>
        <p>
          ابتدا مشخصات را بررسی کنید، سپس مراحل انجام کار و تأیید را برای
          تسک‌های جدید تعریف کنید.
        </p>
      </header>
      <div className="project-settings-picker">
        <div>
          <strong>پروژه موردنظر</strong>
          <p>تنظیمات و قالب گردش‌کار همین پروژه نمایش داده می‌شود.</p>
        </div>
        <ResourcePicker
          api={api}
          resource="projects"
          label="پروژه برای تنظیم"
          value={id}
          onChange={setId}
        />
      </div>
      {list.error && (
        <p role="alert" className="workspace-error">
          {list.error}
        </p>
      )}
      {id ? (
        <ProjectEditor
          key={id}
          api={api}
          id={id}
          onChanged={() => {
            list.refresh();
            onChanged();
          }}
        />
      ) : (
        !list.loading && (
          <div className="project-settings-empty">
            هنوز پروژه‌ای برای تنظیم انتخاب نشده است.
          </div>
        )
      )}
    </section>
  );
}

function ProjectEditor({
  api,
  id,
  onChanged,
}: {
  api: Request;
  id: string;
  onChanged: () => void;
}) {
  const state = useModule<Project | undefined>(
    api,
    `/projects/${id}`,
    undefined,
    false,
  );
  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "active",
    ownerId: "",
    startDate: "",
    endDate: "",
  });
  const [steps, setSteps] = useState<Step[]>([]);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [grant, setGrant] = useState("");
  const [warning, setWarning] = useState("");
  useEffect(() => {
    const project = state.data;
    if (!project) return;
    setForm({
      name: project.name,
      description: project.description || "",
      status: project.status,
      ownerId: project.ownerId,
      startDate: project.startDate?.slice(0, 10) || "",
      endDate: project.endDate?.slice(0, 10) || "",
    });
    setSteps(project.workflowTemplateSteps || []);
    setFields(project.customFieldDefinitions || []);
    setWarning("");
  }, [state.data]);
  const updateStep = (index: number, value: Partial<Step>) =>
    setSteps((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...value } : row)),
    );
  const removeStep = (index: number) => {
    const removed = steps[index];
    if (
      steps.some(
        (step, i) =>
          i !== index &&
          (step.onApprove === removed.id || step.onReject === removed.id),
      )
    ) {
      setWarning(
        "مرحله دیگری به این مرحله ارجاع دارد. ابتدا مسیر پس از تأیید یا رد آن مرحله را تغییر دهید.",
      );
      return;
    }
    setWarning("");
    setSteps((rows) => rows.filter((_, i) => i !== index));
  };
  const person = (step: Step, index: number, approval: boolean) => {
    const type = approval ? step.approvalAssigneeType : step.assigneeType;
    return (
      <>
        <label>
          {approval ? "چه کسی تأیید می‌کند؟" : "چه کسی اجرا می‌کند؟"}
          <select
            aria-label={
              (approval ? "مسئول تأیید " : "مسئول اجرا ") + step.title
            }
            value={type}
            onChange={(event) =>
              updateStep(
                index,
                approval
                  ? { approvalAssigneeType: event.target.value }
                  : { assigneeType: event.target.value },
              )
            }
          >
            {Object.entries(assigneeTypes).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {type === "member" && (
          <MemberPicker
            api={api}
            label={approval ? "تأییدکننده مرحله" : "اجراکننده مرحله"}
            required
            value={
              (approval
                ? step.approvalAssigneeMemberId
                : step.assigneeMemberId) || ""
            }
            onChange={(value) =>
              updateStep(
                index,
                approval
                  ? { approvalAssigneeMemberId: value }
                  : { assigneeMemberId: value },
              )
            }
          />
        )}
        {type === "role" && (
          <label>
            نقش مسئول مرحله
            <select
              aria-label="نقش مرحله"
              required
              value={
                (approval ? step.approvalAssigneeRole : step.assigneeRole) || ""
              }
              onChange={(event) =>
                updateStep(
                  index,
                  approval
                    ? { approvalAssigneeRole: event.target.value }
                    : { assigneeRole: event.target.value },
                )
              }
            >
              <option value="">انتخاب نقش</option>
              {Object.entries(roles).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
      </>
    );
  };
  if (!state.data)
    return (
      <p
        role={state.error ? "alert" : "status"}
        className="project-settings-loading"
      >
        {state.error || "در حال دریافت پروژه…"}
      </p>
    );
  const invalidDates = Boolean(
    form.startDate && form.endDate && form.endDate < form.startDate,
  );
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (invalidDates) {
      setWarning("تاریخ تحویل نباید پیش از شروع پروژه باشد.");
      return;
    }
    const invalid = steps.findIndex(
      (step) =>
        !step.title.trim() ||
        (step.assigneeType === "member" && !step.assigneeMemberId) ||
        (step.assigneeType === "role" && !step.assigneeRole) ||
        (step.requiresApproval &&
          step.approvalAssigneeType === "member" &&
          !step.approvalAssigneeMemberId) ||
        (step.requiresApproval &&
          step.approvalAssigneeType === "role" &&
          !step.approvalAssigneeRole),
    );
    if (invalid >= 0) {
      setWarning(
        `مرحله ${number(invalid + 1)} کامل نیست؛ نام و مسئولان آن را بررسی کنید.`,
      );
      return;
    }
    setWarning("");
    void state.act(async () => {
      await api(`/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          workflowTemplateSteps: steps,
          customFieldDefinitions: fields,
          expectedVersion: state.data!.version,
        }),
      });
      onChanged();
    }, "پروژه ذخیره شد؛ قالب تازه برای تسک‌های جدید استفاده می‌شود.");
  };

  return (
    <>
      {state.error && (
        <p role="alert" className="workspace-error">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="workspace-success">
          {state.notice}
        </p>
      )}
      {warning && (
        <p role="alert" className="project-settings-warning">
          {warning}
        </p>
      )}
      <form className="project-settings-form" onSubmit={save}>
        <section className="project-settings-card">
          <div className="project-settings-card-title">
            <span>۰۱</span>
            <div>
              <h3>مشخصات پروژه</h3>
              <p>نام، مسئول، وضعیت و بازهٔ زمانی پروژه را تنظیم کنید.</p>
            </div>
          </div>
          <div className="module-form-grid">
            <label>
              نام پروژه برای ویرایش
              <Input
                required
                maxLength={200}
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </label>
            <label>
              وضعیت پروژه
              <select
                aria-label="وضعیت پروژه"
                value={form.status}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value })
                }
              >
                {Object.entries(projectStatuses).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <MemberPicker
              api={api}
              label="مسئول پروژه"
              required
              value={form.ownerId}
              onChange={(value) => setForm({ ...form, ownerId: value })}
              currentLabel="مسئول فعلی"
            />
            <JalaliDateField
              label="شروع پروژه (شمسی)"
              value={form.startDate}
              onChange={(value) => setForm({ ...form, startDate: value })}
              max={form.endDate || undefined}
            />
            <JalaliDateField
              label="تحویل پروژه (شمسی)"
              value={form.endDate}
              onChange={(value) => setForm({ ...form, endDate: value })}
              min={form.startDate || undefined}
            />
            <label className="project-settings-field-wide">
              توضیح پروژه برای ویرایش
              <textarea
                maxLength={5000}
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </label>
          </div>
          {invalidDates && (
            <p role="alert" className="workspace-error">
              تاریخ تحویل نباید پیش از شروع پروژه باشد.
            </p>
          )}
        </section>

        <section className="project-settings-card project-workflow-card">
          <div className="project-settings-card-title">
            <span>۰۲</span>
            <div>
              <h3>گردش‌کار تسک‌های جدید</h3>
              <p>
                مسیر انجام و تأیید کار را برای تسک‌هایی که بعداً ساخته می‌شوند
                تعریف کنید.
              </p>
            </div>
          </div>
          <div className="project-workflow-note">
            <strong>این بخش چه اثری دارد؟</strong>
            <p>
              هر تسک جدید می‌تواند یک نسخه از این مراحل را دریافت کند. ویرایش
              این قالب، مراحل تسک‌های موجود را تغییر نمی‌دهد.
            </p>
          </div>
          <ol className="project-workflow-guide">
            <li>
              <span>۱</span>
              <div>
                <strong>مرحله را نام‌گذاری کنید</strong>
                <small>مثلاً اجرا، بازبینی یا تحویل.</small>
              </div>
            </li>
            <li>
              <span>۲</span>
              <div>
                <strong>مسئول اقدام را مشخص کنید</strong>
                <small>یک عضو، نقش یا مسئول خود تسک.</small>
              </div>
            </li>
            <li>
              <span>۳</span>
              <div>
                <strong>مسیر بعدی را روشن کنید</strong>
                <small>
                  در صورت نیاز، تأییدکننده و نتیجهٔ رد را تعیین کنید.
                </small>
              </div>
            </li>
          </ol>
          <div className="project-workflow-preview">
            <div className="project-workflow-preview-heading">
              <h4>پیش‌نمایش مسیر</h4>
              <span>{number(steps.length)} مرحله</span>
            </div>
            {steps.length ? (
              <ol>
                {steps.map((step, index) => (
                  <li key={step.id}>
                    <span className="project-workflow-preview-number">
                      {number(index + 1)}
                    </span>
                    <div>
                      <strong>{step.title.trim() || "مرحله بدون نام"}</strong>
                      <small>اقدام: {actorName(step)}</small>
                      {step.requiresApproval && (
                        <small>
                          تأیید: {actorName(step, true)} · تأیید ←{" "}
                          {routeName(step.onApprove, steps)} · رد ←{" "}
                          {routeName(step.onReject, steps)}
                        </small>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p>
                هنوز مرحله‌ای تعریف نشده است. در این حالت، تسک‌های جدید بدون
                گردش‌کار مرحله‌ای ساخته می‌شوند.
              </p>
            )}
          </div>
          <div className="project-workflow-steps">
            {steps.map((step, index) => (
              <article className="project-workflow-step" key={step.id}>
                <header>
                  <span className="project-workflow-step-number">
                    {number(index + 1)}
                  </span>
                  <div>
                    <strong>
                      مرحله {number(index + 1)}:{" "}
                      {step.title.trim() || "بدون نام"}
                    </strong>
                    <p>
                      مشخص کنید چه کسی اقدام می‌کند و مرحله چگونه پیش می‌رود.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger-soft"
                    onPress={() => removeStep(index)}
                  >
                    برداشتن مرحله
                  </Button>
                </header>
                <div className="module-form-grid">
                  <label>
                    نام مرحله
                    <Input
                      required
                      maxLength={120}
                      value={step.title}
                      onChange={(event) =>
                        updateStep(index, { title: event.target.value })
                      }
                    />
                  </label>
                  {person(step, index, false)}
                  <JalaliDateField
                    label="موعد مرحله (شمسی)"
                    value={step.dueDate?.slice(0, 10) || ""}
                    onChange={(value) => updateStep(index, { dueDate: value })}
                  />
                  <label className="module-checkbox">
                    <input
                      type="checkbox"
                      checked={step.requiresApproval}
                      onChange={(event) =>
                        updateStep(index, {
                          requiresApproval: event.target.checked,
                        })
                      }
                    />
                    این مرحله به تأیید نیاز دارد
                  </label>
                </div>
                {step.requiresApproval && (
                  <div className="project-workflow-approval">
                    <div>
                      <strong>مسیر تأیید</strong>
                      <p>
                        پس از انجام مرحله، تأییدکننده تصمیم می‌گیرد تسک به کجا
                        برود.
                      </p>
                    </div>
                    <div className="module-form-grid">
                      {person(step, index, true)}
                      <JalaliDateField
                        label="موعد تأیید (شمسی)"
                        value={step.approvalDeadline?.slice(0, 10) || ""}
                        onChange={(value) =>
                          updateStep(index, { approvalDeadline: value })
                        }
                      />
                      {(["onApprove", "onReject"] as const).map((key) => (
                        <label key={key}>
                          {key === "onApprove" ? "اگر تأیید شد" : "اگر رد شد"}
                          <select
                            aria-label={
                              key === "onApprove" ? "پس از تأیید" : "پس از رد"
                            }
                            value={step[key]}
                            onChange={(event) =>
                              updateStep(index, { [key]: event.target.value })
                            }
                          >
                            {Object.entries(routes).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                            {steps.map((row) => (
                              <option key={row.id} value={row.id}>
                                {row.title || "مرحله بدون نام"}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    <p className="project-workflow-route-summary">
                      تأیید ← {routeName(step.onApprove, steps)}　 ·　 رد ←{" "}
                      {routeName(step.onReject, steps)}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            isDisabled={steps.length >= 12}
            onPress={() =>
              setSteps((rows) => [
                ...rows,
                {
                  id: crypto.randomUUID(),
                  title: "مرحله جدید",
                  assigneeType: "task_assignee_primary",
                  approvalAssigneeType: "task_assigner",
                  requiresApproval: false,
                  onApprove: "next",
                  onReject: "previous",
                },
              ])
            }
          >
            افزودن مرحله
          </Button>
        </section>

        <section className="project-settings-card">
          <div className="project-settings-card-title">
            <span>۰۳</span>
            <div>
              <h3>فیلدهای سفارشی</h3>
              <p>اطلاعاتی را تعریف کنید که در تسک‌های این پروژه ثبت می‌شود.</p>
            </div>
          </div>
          {fields.length === 0 && (
            <p className="project-settings-empty-inline">
              فیلد سفارشی تعریف نشده است؛ این بخش اختیاری است.
            </p>
          )}
          {fields.map((field, index) => (
            <div
              className="project-custom-field module-form-grid"
              key={field.id}
            >
              <label>
                عنوان فیلد
                <Input
                  required
                  maxLength={100}
                  value={field.label}
                  onChange={(event) =>
                    setFields((rows) =>
                      rows.map((row, i) =>
                        i === index
                          ? { ...row, label: event.target.value }
                          : row,
                      ),
                    )
                  }
                />
              </label>
              <label>
                نوع فیلد
                <select
                  aria-label="نوع فیلد"
                  value={field.type}
                  onChange={(event) =>
                    setFields((rows) =>
                      rows.map((row, i) =>
                        i === index
                          ? {
                              ...row,
                              type: event.target.value,
                              options:
                                event.target.value === "select"
                                  ? ["گزینه اول"]
                                  : undefined,
                            }
                          : row,
                      ),
                    )
                  }
                >
                  {Object.entries({
                    text: "متن",
                    number: "عدد",
                    date: "تاریخ",
                    select: "انتخاب",
                  }).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="module-checkbox">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(event) =>
                    setFields((rows) =>
                      rows.map((row, i) =>
                        i === index
                          ? { ...row, required: event.target.checked }
                          : row,
                      ),
                    )
                  }
                />
                اجباری
              </label>
              {field.type === "select" && (
                <label>
                  گزینه‌ها، جدا با ویرگول
                  <Input
                    value={field.options?.join(",") || ""}
                    onChange={(event) =>
                      setFields((rows) =>
                        rows.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                options: event.target.value
                                  .split(",")
                                  .map((value) => value.trim()),
                              }
                            : row,
                        ),
                      )
                    }
                  />
                </label>
              )}
              <Button
                type="button"
                variant="ghost"
                onPress={() =>
                  setFields((rows) => rows.filter((_, i) => i !== index))
                }
              >
                برداشتن فیلد
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            isDisabled={fields.length >= 20}
            onPress={() =>
              setFields((rows) => [
                ...rows,
                {
                  id: "field_" + crypto.randomUUID().slice(0, 8),
                  label: "فیلد جدید",
                  type: "text",
                  required: false,
                },
              ])
            }
          >
            افزودن فیلد
          </Button>
        </section>
        <div className="project-settings-save">
          <span>تغییرات مشخصات، گردش‌کار و فیلدها با هم ذخیره می‌شوند.</span>
          <Button
            type="submit"
            variant="primary"
            isDisabled={state.busy || invalidDates}
            isPending={state.busy}
          >
            ذخیره پروژه و قالب
          </Button>
        </div>
      </form>

      <section className="project-settings-card project-settings-access">
        <div className="project-settings-card-title">
          <span>۰۴</span>
          <div>
            <h3>دسترسی اعضای پروژه</h3>
            <p>
              اعضای مجاز را به پروژه اضافه کنید یا دسترسی صریح آن‌ها را بردارید.
            </p>
          </div>
        </div>
        <p className="workspace-caption">
          مالک، مدیر سازمان و مسئول پروژه از نقش خود دسترسی دارند. برداشتن موارد
          زیر فقط دسترسی صریح پروژه را لغو می‌کند.
        </p>
        <form
          className="project-settings-grant"
          onSubmit={(event) => {
            event.preventDefault();
            void state.act(async () => {
              await api(`/projects/${id}/members`, {
                method: "POST",
                body: JSON.stringify({ userId: grant }),
              });
              setGrant("");
            }, "دسترسی پروژه اعطا شد.");
          }}
        >
          <MemberPicker
            api={api}
            label="عضو یا مهمان پروژه"
            required
            value={grant}
            onChange={setGrant}
            includeGuests
          />
          <Button
            type="submit"
            variant="outline"
            isDisabled={state.busy || !grant}
          >
            اعطای دسترسی پروژه
          </Button>
        </form>
        <div className="project-settings-members">
          {state.data.members.length ? (
            state.data.members.map((member) => (
              <div key={member.userId}>
                <span>{member.user.fullName}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  isDisabled={state.busy}
                  onPress={() =>
                    void state.act(async () => {
                      await api(
                        `/projects/${id}/members/${encodeURIComponent(member.userId)}`,
                        { method: "DELETE" },
                      );
                    }, "دسترسی صریح پروژه برداشته شد.")
                  }
                >
                  برداشتن دسترسی
                </Button>
              </div>
            ))
          ) : (
            <p>هنوز دسترسی صریحی برای این پروژه ثبت نشده است.</p>
          )}
        </div>
      </section>
    </>
  );
}
