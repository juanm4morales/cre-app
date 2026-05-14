import { Dialog, DialogPanel, DialogTitle, DialogBackdrop } from '@headlessui/react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="modal-backdrop w-full" />
      <div className="modal-backdrop" style={{ background: 'transparent' }}>
        <DialogPanel className="modal">
          <DialogTitle className="modal-header" as="div">
            <h3>{title}</h3>
          </DialogTitle>
          <p className="modal-body">{message}</p>
          <div className="modal-actions">
            <button className="button button-ghost" type="button" onClick={onClose}>
              {cancelLabel}
            </button>
            <button className="button" type="button" onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export default ConfirmDialog;
