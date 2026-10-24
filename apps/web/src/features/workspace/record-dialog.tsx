import { useState } from "react";
import type { ReactNode } from "react";
import { Button, Description, Modal } from "@heroui/react";
import "./record-dialog.css";

type RecordDialogProps = {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
  dirty?: boolean;
  closeLabel?: string;
  variant?: "default" | "task";
  footerActions?: ReactNode;
};

/**
 * Shared overlay for row details and related actions.
 * HeroUI owns the portal, focus trap, scroll lock and focus restoration.
 * Every dismissal route uses the same saving/unsaved-changes guard.
 */
export default function RecordDialog({
  title,
  description,
  onClose,
  children,
  busy = false,
  dirty = false,
  closeLabel = "بستن",
  variant = "default",
  footerActions,
}: RecordDialogProps) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const requestClose = () => {
    if (busy) return;
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  return (
    <Modal.Backdrop
      isOpen
      isDismissable={!busy}
      isKeyboardDismissDisabled={busy}
      onOpenChange={(open) => { if (!open) requestClose(); }}
    >
      <Modal.Container size={variant === "task" ? "cover" : "lg"} placement="center" scroll="inside">
        <Modal.Dialog className={`workspace-record-dialog${variant === "task" ? " workspace-record-dialog--task" : ""}`} dir="rtl">
          <Modal.CloseTrigger
            className="workspace-record-dialog-close"
            aria-label={closeLabel}
            isDisabled={busy}
          />
          <Modal.Header className="workspace-record-dialog-header">
            <Modal.Heading>{title}</Modal.Heading>
            {description && <Description>{description}</Description>}
          </Modal.Header>
          <Modal.Body className="workspace-record-dialog-body" aria-busy={busy}>
            <div className="workspace-panel workspace-record-content">{children}</div>
          </Modal.Body>
          <Modal.Footer className="workspace-record-dialog-footer">
            {busy && <span role="status">در حال انجام عملیات…</span>}
            {footerActions}
            <Button type="button" variant="outline" isDisabled={busy} onPress={requestClose}>
              {closeLabel}
            </Button>
          </Modal.Footer>

          {confirmDiscard && (
            <Modal.Backdrop
              isOpen
              isDismissable={!busy}
              isKeyboardDismissDisabled={busy}
              onOpenChange={(open) => { if (!open && !busy) setConfirmDiscard(false); }}
            >
              <Modal.Container size="md" placement="center">
                <Modal.Dialog className="workspace-record-dialog workspace-record-confirm" dir="rtl">
                  <Modal.CloseTrigger
                    aria-label="ادامه ویرایش"
                    isDisabled={busy}
                  />
                  <Modal.Header className="workspace-record-dialog-header">
                    <Modal.Heading>بستن بدون ذخیره؟</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body className="workspace-record-dialog-body">
                    <Description>
                      تغییرات ذخیره‌نشده یا فایل انتخاب‌شده با بستن این پنجره کنار گذاشته می‌شود.
                      اطلاعاتی که قبلاً ذخیره کرده‌اید حذف نمی‌شود.
                    </Description>
                  </Modal.Body>
                  <Modal.Footer className="workspace-record-dialog-footer">
                    <Button
                      type="button"
                      variant="outline"
                      isDisabled={busy}
                      onPress={() => setConfirmDiscard(false)}
                    >
                      ادامه ویرایش
                    </Button>
                    <Button
                      type="button"
                      variant="danger-soft"
                      isDisabled={busy}
                      onPress={() => {
                        if (busy) return;
                        setConfirmDiscard(false);
                        onClose();
                      }}
                    >
                      بستن بدون ذخیره
                    </Button>
                  </Modal.Footer>
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
