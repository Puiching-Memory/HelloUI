import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Body1,
  Button,
} from '@/ui/components'
import { useState, useCallback } from 'react'

interface MessageDialogProps {
  open: boolean
  title?: string
  message: string
  onClose: () => void
  onConfirm?: () => void
  confirmLabel?: string
  cancelLabel?: string
}

export function MessageDialog({ 
  open, 
  title = '提示', 
  message, 
  onClose,
  onConfirm,
  confirmLabel = '确定',
  cancelLabel = '取消'
}: MessageDialogProps) {
  const hasConfirm = !!onConfirm

  return (
    <Dialog open={open} onOpenChange={(_: any, data: any) => !data.open && onClose()}>
      <DialogSurface>
        <DialogTitle>{title}</DialogTitle>
        <DialogBody>
          <DialogContent>
            <Body1 style={{ whiteSpace: 'pre-line' }}>{message}</Body1>
          </DialogContent>
        </DialogBody>
        <DialogActions>
          {hasConfirm && (
            <Button appearance="secondary" onClick={onClose}>
              {cancelLabel}
            </Button>
          )}
          <Button 
            appearance="primary" 
            onClick={hasConfirm ? () => { onClose(); onConfirm(); } : onClose}
          >
            {confirmLabel}
          </Button>
        </DialogActions>
      </DialogSurface>
    </Dialog>
  )
}

export function useMessageDialog() {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState<{ title: string; message: string }>({ title: '提示', message: '' })
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

