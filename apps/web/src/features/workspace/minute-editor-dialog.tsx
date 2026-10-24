import { useEffect, useRef, useState } from "react";
import {
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  TextField,
} from "@heroui/react";
import { FileText, LayoutTemplate, Save } from "lucide-react";
import JalaliDateField from "./jalali-date-field";
import MinuteRichEditor, { initialMinuteDocument } from "./minute-rich-editor";
import type { MinuteDocument } from "./minute-rich-editor";
import type { Minute } from "./minute-types";
import { minuteText } from "./minute-types";
import type { Request } from "./use-module";
import { workspaceToday } from "./dates";
import { TaskMessage } from "./hero-task-fields";

const suggestedContent = (): MinuteDocument => ({
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "دستور جلسه" }],
    },
    { type: "paragraph" },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "موضوع‌ها و گفتگوها" }],
    },
    { type: "paragraph" },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "تصمیم‌ها" }],
    },
    { type: "paragraph" },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "اقدام‌ها، مسئولان و موعدها" }],
    },
    { type: "paragraph" },
  ],
});

export default function MinuteEditorDialog({
  api,
  minute,
  onClose,
  onDone,
}: {
  api: Request;
  minute: Minute | null;
  onClose: () => void;
  onDone: (minute: Minute) => void;
}) {
  const [title, setTitle] = useState(minute?.title || "");
  const [date, setDate] = useState(
    minute?.date.slice(0, 10) || workspaceToday(),
  );
  const [attendees, setAttendees] = useState(minute?.attendees || "");
  const [content, setContent] = useState<MinuteDocument>(() =>
    initialMinuteDocument(minute),
  );
  const [plain, setPlain] = useState(() =>
    minuteText(initialMinuteDocument(minute)),
  );
  const [editorRevision, setEditorRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const lock = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const requestClose = () => {
    if (lock.current || busy) return;
    if (dirty && !window.confirm("تغییرات ذخیره نشده‌اند. فرم بسته شود؟"))
      return;
    onClose();
  };
  const useTemplate = () => {
    const next = suggestedContent();
    setContent(next);
    setPlain("");
    setEditorRevision((value) => value + 1);
    setDirty(true);
  };
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (lock.current) return;
    if (!title.trim() || !date || !plain.trim()) {
      setError("عنوان، تاریخ و متن صورت‌جلسه را تکمیل کنید.");
      return;
    }
    if (JSON.stringify(content).length > 120000) {
      setError("متن صورت‌جلسه بیش از اندازه طولانی است.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    void api<Minute>(
      "/minutes" + (minute ? "/" + encodeURIComponent(minute.id) : ""),
      {
        method: minute ? "PATCH" : "POST",
        body: JSON.stringify({
          title: title.trim(),
          date,
          attendees: attendees.trim(),
          content,
        }),
      },
    )
      .then((row) => {
        if (mounted.current) onDone(row);
      })
      .catch((reason) => {
        if (mounted.current)
          setError(
            reason instanceof Error
              ? reason.message
              : "ذخیره صورت‌جلسه انجام نشد.",
          );
      })
      .finally(() => {
        lock.current = false;
        if (mounted.current) setBusy(false);
      });
  };
  return (
    <Modal.Backdrop
      isOpen
      isDismissable={!busy}
      isKeyboardDismissDisabled={busy}
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog className="minute-modal minute-editor-modal" dir="rtl">
          <Modal.CloseTrigger
            aria-label="بستن فرم صورت‌جلسه"
            isDisabled={busy}
          />
          <Modal.Header>
            <Modal.Icon>
              <FileText size={22} />
            </Modal.Icon>
            <Modal.Heading>
              {minute ? "ویرایش صورت‌جلسه" : "صورت‌جلسه جدید"}
            </Modal.Heading>
            <Description>
              مشخصات جلسه را ثبت کنید و متن کامل آن را با عنوان، فهرست و جدول
              بنویسید.
            </Description>
          </Modal.Header>
          <Form className="minute-create-form" onSubmit={save}>
            <Modal.Body>
              {error && <TaskMessage error message={error} />}
              <div className="minute-form-section">
                <span>۰۱</span>
                <div>
                  <strong>مشخصات جلسه</strong>
                  <small>این اطلاعات در فهرست و جست‌وجو استفاده می‌شود.</small>
                </div>
              </div>
              <div className="minute-meta-grid">
                <TextField
                  fullWidth
                  name="title"
                  isRequired
                  isDisabled={busy}
                  value={title}
                  onChange={(value) => {
                    setTitle(value);
                    setDirty(true);
                  }}
                  autoFocus
                >
                  <Label>عنوان صورت‌جلسه</Label>
                  <Input
                    maxLength={200}
                    placeholder="مثلاً جلسه برنامه‌ریزی محصول"
                  />
                  <FieldError />
                </TextField>
                <JalaliDateField
                  label="تاریخ جلسه (شمسی)"
                  required
                  disabled={busy}
                  value={date}
                  onChange={(value) => {
                    setDate(value);
                    setDirty(true);
                  }}
                />
                <TextField
                  fullWidth
                  isDisabled={busy}
                  value={attendees}
                  onChange={(value) => {
                    setAttendees(value);
                    setDirty(true);
                  }}
                >
                  <Label>حاضران</Label>
                  <Input
                    maxLength={5000}
                    placeholder="نام افراد حاضر در جلسه"
                  />
                </TextField>
              </div>
              <div className="minute-form-section minute-content-heading">
                <span>۰۲</span>
                <div>
                  <strong>متن کامل صورت‌جلسه</strong>
                  <small>
                    دستور جلسه، گفتگوها، تصمیم‌ها و اقدامات را در یک سند ثبت
                    کنید.
                  </small>
                </div>
                {!minute && !plain.trim() && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onPress={useTemplate}
                  >
                    <LayoutTemplate size={15} />
                    درج ساختار پیشنهادی
                  </Button>
                )}
              </div>
              <MinuteRichEditor
                key={editorRevision}
                content={content}
                onChange={(next, text) => {
                  setContent(next);
                  setPlain(text);
                  setDirty(true);
                }}
              />
              <div className="minute-editor-footnote">
                <span>
                  {new Intl.NumberFormat("fa").format(plain.length)} نویسه
                </span>
                <span>
                  پیوست‌ها پس از ذخیره از جزئیات صورت‌جلسه اضافه می‌شوند.
                </span>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button
                type="button"
                variant="outline"
                isDisabled={busy}
                onPress={requestClose}
              >
                انصراف
              </Button>
              <Button
                type="submit"
                isDisabled={busy || !title.trim() || !date || !plain.trim()}
                isPending={busy}
              >
                <Save size={16} />
                {busy
                  ? "در حال ذخیره…"
                  : minute
                    ? "ذخیره تغییرات"
                    : "ثبت صورت‌جلسه"}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
