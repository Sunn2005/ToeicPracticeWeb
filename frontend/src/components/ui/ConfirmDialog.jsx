import { useLanguage } from "../../i18n/LanguageContext";
import Button from "./Button";
import Modal from "./Modal";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}) {
  const { t } = useLanguage();

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel || t("uiCancel")}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel || t("uiConfirm")}
          </Button>
        </>
      }
    >
      {description}
    </Modal>
  );
}
