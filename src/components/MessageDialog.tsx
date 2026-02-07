import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Body1,
  Button,
} from '@fluentui/react-components'
import { useState, useCallback } from 'react'

interface MessageDialogProps {
  open: boolean
  title?: string
  message: string
  onClose: () => void
}

export function MessageDialog({ open, title = '提示', message, onClose }: MessageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface>
        <DialogTitle>{title}</DialogTitle>
        <DialogBody>
          <DialogContent>
            <Body1 style={{ whiteSpace: 'pre-line' }}>{message}</Body1>
          </DialogContent>
        </DialogBody>
        <DialogActions>
          <Button appearance="primary" onClick={onClose}>
            确定
          </Button>
        </DialogActions>
      </DialogSurface>
    </Dialog>
  )
}

/**
 * 管理消息对话框状态的自定义 hook
 */
export function useMessageDialog() {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState<{ title: string; message: string }>({ title: '提示', message: '' })

  const showMessage = useCallback((title: string, message: string) => {
    setContent({ title, message })
    setOpen(true)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  return {
    open,
    title: content.title,
    message: content.message,
    showMessage,
    close,
  }
}
