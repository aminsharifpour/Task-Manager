import { Button, Chip, Description, Modal, Spinner } from "@heroui/react";
import { Archive, ArchiveRestore, Paperclip, Pencil } from "lucide-react";
import MinuteRichEditor, { initialMinuteDocument } from "./minute-rich-editor";
import type { Minute } from "./minute-types";
import { displayDate } from "./dates";
import { TaskMessage } from "./hero-task-fields";
import { useModule } from "./use-module";
import type { Request } from "./use-module";

export default function MinuteDetailDialog({
  api,
  id,
  manager,
  onClose,
  onEdit,
  onFiles,
  onArchive,
}: {
  api: Request;
  id: string;
  manager: boolean;
  onClose: () => void;
  onEdit: (minute: Minute) => void;
  onFiles: (minute: Minute) => void;
  onArchive: (minute: Minute) => void;
}) {
  const state = useModule<Minute | null>(
    api,
    "/minutes/" + encodeURIComponent(id),
    null,
  );
  const minute = state.data;
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog className="minute-modal minute-detail-modal" dir="rtl">
          <Modal.CloseTrigger aria-label="بستن جزئیات صورت‌جلسه" />
          <Modal.Header>
            <Modal.Heading>{minute?.title || "جزئیات صورت‌جلسه"}</Modal.Heading>
            {minute && (
              <Description>
                جلسه در {displayDate(minute.date)} برگزار شده است.
              </Description>
            )}
          </Modal.Header>
          <Modal.Body>
            {state.error ? (
              <TaskMessage error message={state.error} />
            ) : state.loading ? (
              <Spinner size="sm" />
            ) : (
              minute && (
                <>
                  <div className="minute-detail-summary">
                    <div>
                      <span>تاریخ جلسه</span>
                      <strong>{displayDate(minute.date)}</strong>
                    </div>
                    <div>
                      <span>حاضران</span>
                      <strong>{minute.attendees || "ثبت نشده"}</strong>
                    </div>
                    <div>
                      <span>وضعیت</span>
                      <Chip
                        size="sm"
                        variant="soft"
                        color={minute.archivedAt ? "warning" : "success"}
                      >
                        {minute.archivedAt ? "آرشیوشده" : "فعال"}
                      </Chip>
                    </div>
                  </div>
                  <section className="minute-detail-document">
                    <div className="minute-detail-document-head">
                      <strong>متن صورت‌جلسه</strong>
                      <span>شرح، تصمیم‌ها و اقدامات جلسه</span>
                    </div>
                    <MinuteRichEditor
                      key={minute.id}
                      content={initialMinuteDocument(minute)}
                      readOnly
                    />
                  </section>
                </>
              )
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline" onPress={onClose}>
              بستن
            </Button>
            {minute && (
              <>
                <Button variant="outline" onPress={() => onFiles(minute)}>
                  <Paperclip size={16} />
                  پیوست‌ها
                </Button>
                {manager && (
                  <>
                    <Button variant="outline" onPress={() => onArchive(minute)}>
                      {minute.archivedAt ? (
                        <ArchiveRestore size={16} />
                      ) : (
                        <Archive size={16} />
                      )}{" "}
                      {minute.archivedAt
                        ? "بازگردانی از آرشیو"
                        : "انتقال به آرشیو"}
                    </Button>
                    <Button onPress={() => onEdit(minute)}>
                      <Pencil size={16} />
                      ویرایش
                    </Button>
                  </>
                )}
              </>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
