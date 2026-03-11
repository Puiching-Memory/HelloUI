import { act } from 'react'
import { MessageDialog, useMessageDialog } from './MessageDialog'
import { renderIntoDocument } from '@/test/render'

function getButtonByText(text: string) {
  return Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.trim() === text) ?? null
}

describe('MessageDialog', () => {
  it('runs confirm and close callbacks when confirming', () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    const view = renderIntoDocument(
      <MessageDialog open title="测试" message="确认内容" onClose={onClose} onConfirm={onConfirm} />,
    )

    const confirmButton = getButtonByText('确定')

    expect(confirmButton).not.toBeNull()

    act(() => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    view.unmount()
  })

  it('opens and closes through useMessageDialog state', () => {
    const closeSpy = vi.fn()

    function Harness() {
      const dialog = useMessageDialog()

      return (
        <>
          <button onClick={() => dialog.showMessage('标题', '内容', closeSpy)}>show</button>
          <MessageDialog
            open={dialog.open}
            title={dialog.title}
            message={dialog.message}
            onClose={dialog.close}
            onConfirm={dialog.confirmAction}
          />
        </>
      )
    }

    const view = renderIntoDocument(<Harness />)
    const showButton = getButtonByText('show')

    act(() => {
      showButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(document.body.textContent).toContain('标题')
    expect(document.body.textContent).toContain('内容')

    const cancelButton = getButtonByText('取消')
    expect(cancelButton).not.toBeNull()

    act(() => {
      cancelButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(document.body.textContent).not.toContain('标题')
    expect(closeSpy).not.toHaveBeenCalled()
    view.unmount()
  })
})
