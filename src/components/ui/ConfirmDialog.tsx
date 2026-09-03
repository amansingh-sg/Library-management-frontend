import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// Thin wrapper around Modal for the common "are you sure?" case - a yes/no prompt
// before a destructive or irreversible action (set `danger` to render the confirm
// button in red).
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  danger,
  isLoading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{description}</p>
    </Modal>
  )
}
