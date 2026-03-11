import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'

export function renderIntoDocument(element: ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  act(() => {
    root.render(element)
  })

  return {
    container,
    unmount() {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}
