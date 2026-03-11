import React, { createContext, useContext, useState } from 'react'
import { Button as AButton, Modal } from 'antd'
import { Typography } from 'antd'
import type { ComponentProps, FC, MouseEvent, MouseEventHandler, ReactElement, ReactNode } from 'react'

const { Title: ATitle } = Typography

export type DialogOpenChangeData = { open: boolean }
export type DialogOpenChangeHandler = (_event: unknown, data: DialogOpenChangeData) => void

type DialogProps = {
  open?: boolean
  onOpenChange?: DialogOpenChangeHandler
  children?: ReactNode
}

type DialogTriggerRenderProps = {
  onClick: MouseEventHandler<HTMLElement>
}

type DialogTriggerProps = {
  children: ReactNode | ((props: DialogTriggerRenderProps) => ReactNode)
  disableButtonEnhancement?: boolean
}

type DialogSurfaceProps = Omit<ComponentProps<typeof Modal>, 'open' | 'onCancel' | 'footer'>

type AccordionProps = React.HTMLAttributes<HTMLDivElement>
type AccordionItemProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string
}
type AccordionHeaderProps = ComponentProps<typeof AButton> & {
  icon?: ReactNode
}

function useOpenState(externalOpen: boolean | undefined, onOpenChange?: DialogOpenChangeHandler) {
  const [innerOpen, setInnerOpen] = useState(false)
  const controlled = typeof externalOpen === 'boolean'
  const open = controlled ? externalOpen : innerOpen

  const setOpen = (nextOpen: boolean) => {
    if (!controlled) setInnerOpen(nextOpen)
    onOpenChange?.(undefined, { open: nextOpen })
  }

  return { open, setOpen }
}

const DialogContext = createContext<{ open: boolean; setOpen: (next: boolean) => void } | null>(null)

export const Dialog: FC<DialogProps> = ({ open, onOpenChange, children }) => {
  const state = useOpenState(open, onOpenChange)
  return <DialogContext.Provider value={state}>{children}</DialogContext.Provider>
}

export const DialogTrigger: FC<DialogTriggerProps> = ({ children }) => {
  const context = useContext(DialogContext)
  if (!context) return <>{children}</>

  const handleClick: MouseEventHandler<HTMLElement> = (event) => {
    event.stopPropagation()
    context.setOpen(!context.open)
  }

  if (typeof children === 'function') {
    return <>{children({ onClick: handleClick })}</>
  }

  if (React.isValidElement(children)) {
    const element = children as ReactElement<{ onClick?: MouseEventHandler<HTMLElement> }>
    const previousClick = element.props.onClick
    return React.cloneElement(element, {
      onClick: (event: MouseEvent<HTMLElement>) => {
        previousClick?.(event)
        handleClick(event)
      },
    })
  }

  return <>{children}</>
}

export const DialogSurface: FC<DialogSurfaceProps> = ({ children, style, ...rest }) => {
  const context = useContext(DialogContext)
  if (!context?.open) return null

  return (
    <Modal
      open={context.open}
      onCancel={() => context.setOpen(false)}
      footer={null}
      centered
      width="auto"
      modalRender={(modalNode) => (
        <div style={{ minWidth: 360, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto', ...style }}>{modalNode}</div>
      )}
      {...rest}
    >
      {children}
    </Modal>
  )
}

export const DialogTitle: FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ style, children, ...props }) => (
  <ATitle level={4} style={{ margin: 0, fontSize: 20, ...style }} {...props}>
    {children}
  </ATitle>
)

export const DialogBody: FC<React.HTMLAttributes<HTMLDivElement>> = ({ style, children, ...props }) => (
  <div style={{ marginTop: 12, ...style }} {...props}>
    {children}
  </div>
)

export const DialogContent: FC<React.HTMLAttributes<HTMLDivElement>> = ({ style, children, ...props }) => (
  <div style={{ marginTop: 8, ...style }} {...props}>
    {children}
  </div>
)

export const DialogActions: FC<React.HTMLAttributes<HTMLDivElement>> = ({ style, children, ...props }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14, ...style }} {...props}>
    {children}
  </div>
)

type AccordionContextValue = {
  openValues: Set<string>
  toggle: (value: string) => void
}

const AccordionContext = createContext<AccordionContextValue | null>(null)
const AccordionItemContext = createContext<{ value: string } | null>(null)

export const Accordion: FC<AccordionProps> = ({ children, style, ...props }) => {
  const [openValues, setOpenValues] = useState<Set<string>>(new Set())

  const toggle = (value: string) => {
    setOpenValues((currentValues) => {
      const nextValues = new Set(currentValues)
      if (nextValues.has(value)) nextValues.delete(value)
      else nextValues.add(value)
      return nextValues
    })
  }

  return (
    <AccordionContext.Provider value={{ openValues, toggle }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  )
}

export const AccordionItem: FC<AccordionItemProps> = ({ value, children, style, ...props }) => (
  <AccordionItemContext.Provider value={{ value: String(value) }}>
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, ...style }} {...props}>
      {children}
    </div>
  </AccordionItemContext.Provider>
)

export const AccordionHeader: FC<AccordionHeaderProps> = ({ icon, children, style, ...props }) => {
  const item = useContext(AccordionItemContext)
  const accordion = useContext(AccordionContext)

  return (
    <AButton
      type="text"
      onClick={() => item && accordion?.toggle(item.value)}
      style={{ width: '100%', justifyContent: 'space-between', border: 0, ...style }}
      {...props}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {icon}
        {children}
      </span>
    </AButton>
  )
}

export const AccordionPanel: FC<React.HTMLAttributes<HTMLDivElement>> = ({ style, children, ...props }) => {
  const item = useContext(AccordionItemContext)
  const accordion = useContext(AccordionContext)
  const open = item ? accordion?.openValues.has(item.value) : true
  if (!open) return null

  return (
    <div style={{ padding: 12, ...style }} {...props}>
      {children}
    </div>
  )
}
