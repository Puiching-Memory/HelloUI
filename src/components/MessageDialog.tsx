import { useCallback, useState } from 'react'
import {
  Body1,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  type DialogOpenChangeData,
} from '@/ui/components'

interface MessageDialogProps {
  open: boolean
  title?: string
  message: string
  onClose: () => void
  onConfirm?: () => void
  confirmLabel?: string
  cancelLabel?: string
}

interface MessageDialogContent {
  title: string
  message: string
}

export interface UseMessageDialogResult {
  close: () => void
  confirmAction?: () => void
  message: string
  open: boolean
  showMessage: (title: string, message: string, onConfirm?: () => void) => void
  title: string
}

export function MessageDialog({
  open,
  title = '提示',
  message,
  onClose,
  onConfirm,
  confirmLabel = '确定',
  cancelLabel = '取消',
}: MessageDialogProps) {
  const hasConfirm = !!onConfirm

  const handleOpenChange = (_event: unknown, data: DialogOpenChangeData) => {
    if (!data.open) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogSurface>
        <DialogTitle>{title}</DialogTitle>
        <DialogBody>
          <DialogContent>
            <Body1 style={{ whiteSpace: 'pre-line' }}>{message}</Body1>
          </DialogContent>
        </DialogBody>
        <DialogActions>
          {hasConfirm ? (
            <Button appearance="secondary" onClick={onClose}>
              {cancelLabel}
            </Button>
          ) : null}
          <Button appearance="primary" onClick={hasConfirm ? () => {
            onClose()
            onConfirm?.()
          } : onClose}>
            {confirmLabel}
          </Button>
        </DialogActions>
      </DialogSurface>
    </Dialog>
  )
}

export function useMessageDialog(): UseMessageDialogResult {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState<MessageDialogContent>({ title: '提示', message: '' })
  const [confirmAction, setConfirmAction] = useState<(() => void) | undefined>(undefined)

  const showMessage = useCallback((title: string, message: string, onConfirm?: () => void) => {
    setContent({ title, message })
    setConfirmAction(() => onConfirm)
    setOpen(true)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  return {
    open,
    title: content.title,
    message: content.message,
    showMessage,
    close,
    confirmAction,
  }
}
