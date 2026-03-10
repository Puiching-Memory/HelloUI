/**
 * Ant Design 6.x 兼容层
 *
 * 保留原有 API 签名，内部改用 antd 组件实现。
 * 页面代码无需修改 import 路径即可平滑迁移。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { createContext, useContext, useState } from 'react'
import {
  Button as AButton,
  Card as ACard,
  Checkbox as ACheckbox,
  Input as AInput,
  InputNumber as AInputNumber,
  Modal,
  Progress as AProgress,
  Radio as ARadioGroup,
  Select as ASelect,
  Slider as ASlider,
  Spin,
  Tag as ATag,
  Tooltip as ATooltip,
  Typography,
  Alert,
} from 'antd'
import type { CSSProperties, FC, ReactNode } from 'react'

// ---------------------------------------------------------------------------
// makeStyles 兼容 — 保留 CSS-in-JS
// ---------------------------------------------------------------------------

const unitlessProps = new Set([
  'fontWeight',
  'lineHeight',
  'opacity',
  'zIndex',
  'flex',
  'flexGrow',
  'flexShrink',
  'order',
  'zoom',
])

const globalStyleId = '__fluent_compat_styles__'
let classSeed = 0

function ensureStyleSheet() {
  let style = document.getElementById(globalStyleId) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = globalStyleId
    document.head.appendChild(style)
  }
  return style
}

function toKebabCase(input: string) {
  if (input.startsWith('--')) return input
  return input.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

function toCssValue(prop: string, value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'number') return unitlessProps.has(prop) ? String(value) : `${value}px`
  if (Array.isArray(value)) return value.map((v) => toCssValue(prop, v)).join(' ')
  return String(value)
}

function serializeStyle(selector: string, styleObj: Record<string, unknown>): string {
  let cssBody = ''
  let nestedCss = ''
  for (const [rawKey, rawValue] of Object.entries(styleObj)) {
    if (rawValue == null) continue
    if (typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      if (rawKey.startsWith('@')) {
        nestedCss += `${rawKey}{${serializeStyle(selector, rawValue as Record<string, unknown>)}}`
        continue
      }
      if (rawKey.startsWith(':') || rawKey.startsWith('::')) {
        nestedCss += serializeStyle(`${selector}${rawKey}`, rawValue as Record<string, unknown>)
        continue
      }
      if (rawKey.includes('&')) {
        nestedCss += serializeStyle(rawKey.replace(/&/g, selector), rawValue as Record<string, unknown>)
        continue
      }
      nestedCss += serializeStyle(`${selector} ${rawKey}`, rawValue as Record<string, unknown>)
      continue
    }
    const key = toKebabCase(rawKey)
    const value = toCssValue(rawKey, rawValue)
    if (!value) continue
    cssBody += `${key}:${value};`
  }
  const cssRule = cssBody ? `${selector}{${cssBody}}` : ''
  return cssRule + nestedCss
}

export function makeStyles<K extends string>(styles: Record<K, CSSProperties | Record<string, unknown>>) {
  const classMap = {} as Record<K, string>
  if (typeof document !== 'undefined') {
    const styleEl = ensureStyleSheet()
    let css = ''
    for (const [slot, slotStyle] of Object.entries(styles) as [K, Record<string, unknown>][]) {
      const className = `fc_${slot}_${classSeed++}`
      classMap[slot] = className
      css += serializeStyle(`.${className}`, slotStyle)
    }
    styleEl.appendChild(document.createTextNode(css))
  } else {
    for (const slot of Object.keys(styles) as K[]) {
      classMap[slot] = `fc_${slot}_${classSeed++}`
    }
  }
  return () => classMap
}

// ---------------------------------------------------------------------------
// tokens — design-token 代理
// ---------------------------------------------------------------------------

const tokenValues: Record<string, string> = {
  borderRadiusSmall: '4px',
  borderRadiusMedium: '8px',
  borderRadiusLarge: '12px',
  colorBrandBackground2: 'var(--secondary)',
  colorBrandForeground1: 'var(--primary)',
  colorBrandForeground2: 'var(--primary)',
  colorBrandStroke1: 'var(--primary)',
  colorBrandStroke2: 'var(--primary)',
  colorNeutralBackground1: 'var(--background)',
  colorNeutralBackground1Hover: 'var(--secondary)',
  colorNeutralBackground1Selected: 'var(--secondary)',
  colorNeutralBackground2: 'var(--secondary)',
  colorNeutralBackground3: 'var(--muted)',
  colorNeutralForeground1: 'var(--foreground)',
  colorNeutralForeground2: 'var(--muted-foreground)',
  colorNeutralForeground3: 'var(--muted-foreground)',
  colorNeutralStroke1: 'var(--border)',
  colorNeutralStroke2: 'var(--border)',
  colorPaletteBlueForeground2: 'var(--app-info)',
  colorPaletteGreenForeground1: 'var(--app-success)',
  colorPaletteRedForeground1: 'var(--app-error)',
  colorPaletteRedForeground2: 'var(--app-error)',
  colorPaletteYellowForeground1: 'var(--app-warning)',
  fontSizeBase100: '12px',
  fontSizeBase200: '13px',
  fontSizeBase300: '14px',
  fontSizeBase400: '16px',
  fontSizeBase500: '20px',
  fontWeightSemibold: '600',
  shadow8: '0 4px 14px rgba(var(--shadow-rgb),0.08)',
  shadow16: '0 10px 24px rgba(var(--shadow-rgb),0.12)',
  shadow28: '0 24px 48px rgba(var(--shadow-rgb),0.18)',
  spacingHorizontalL: '16px',
  spacingHorizontalM: '12px',
  spacingHorizontalS: '8px',
  spacingHorizontalXL: '24px',
  spacingHorizontalXS: '6px',
  spacingHorizontalXXS: '4px',
  spacingVerticalL: '16px',
  spacingVerticalM: '12px',
  spacingVerticalS: '8px',
  spacingVerticalXL: '24px',
  spacingVerticalXS: '6px',
  spacingVerticalXXL: '32px',
  spacingVerticalXXS: '4px',
}

export const tokens = new Proxy(tokenValues, {
  get(target, key: string) {
    if (key in target) return target[key]
    return 'var(--foreground)'
  },
}) as Record<string, string>

// ---------------------------------------------------------------------------
// Theme 类型
// ---------------------------------------------------------------------------

export type BrandVariants = Record<number, string>
export type Theme = Record<string, string | number>

function baseTheme(brand: BrandVariants, _isDark: boolean): Theme {
  return {
    colorNeutralForeground1: 'var(--foreground)',
    colorNeutralForeground2: 'var(--muted-foreground)',
    colorNeutralForeground3: 'var(--muted-foreground)',
    colorNeutralBackground1: 'var(--background)',
    colorNeutralBackground2: 'var(--secondary)',
    colorNeutralBackground3: 'var(--muted)',
    colorNeutralStroke1: 'var(--border)',
    colorNeutralStroke2: 'var(--border)',
    colorBrandForeground1: brand[70] ?? 'var(--primary)',
    colorBrandForeground2: brand[80] ?? 'var(--primary)',
    colorBrandBackground: brand[60] ?? 'var(--primary)',
    colorBrandBackground2: 'var(--secondary)',
    colorBrandStroke1: brand[60] ?? 'var(--primary)',
    colorBrandStroke2: brand[70] ?? 'var(--primary)',
  }
}

export function createLightTheme(brand: BrandVariants): Theme {
  return baseTheme(brand, false)
}
export function createDarkTheme(brand: BrandVariants): Theme {
  return baseTheme(brand, true)
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

const { Title: ATitle, Paragraph, Text: AText } = Typography

export const Text: FC<any> = ({ block, weight, style, children, ...props }) => (
  <AText
    style={{
      display: block ? 'block' : undefined,
      fontWeight: weight === 'semibold' ? 600 : style?.fontWeight,
      ...style,
    }}
    {...props}
  >
    {children}
  </AText>
)

export const Body1: FC<any> = ({ block, style, children, ...props }) => (
  <Paragraph style={{ margin: 0, display: block ? 'block' : 'inline-block', fontSize: 14, ...style }} {...props}>
    {children}
  </Paragraph>
)
export const Body2: FC<any> = ({ block, style, children, ...props }) => (
  <Paragraph style={{ margin: 0, display: block ? 'block' : 'inline-block', fontSize: 13, ...style }} {...props}>
    {children}
  </Paragraph>
)
export const Caption1: FC<any> = ({ style, children, ...props }) => (
  <AText type="secondary" style={{ fontSize: 12, ...style }} {...props}>
    {children}
  </AText>
)
export const Title1: FC<any> = ({ style, children, ...props }) => (
  <ATitle level={1} style={{ margin: 0, fontSize: 32, ...style }} {...props}>
    {children}
  </ATitle>
)
export const Title2: FC<any> = ({ style, children, ...props }) => (
  <ATitle level={2} style={{ margin: 0, fontSize: 22, ...style }} {...props}>
    {children}
  </ATitle>
)
export const Title3: FC<any> = ({ style, children, ...props }) => (
  <ATitle level={3} style={{ margin: 0, fontSize: 18, ...style }} {...props}>
    {children}
  </ATitle>
)

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export const Card: FC<any> = ({ style, children, ...props }) => (
  <ACard
    style={{ borderRadius: 12, boxShadow: '0 6px 22px rgba(var(--shadow-rgb), 0.04)', ...style }}
    styles={{ body: { padding: 16 } }}
    {...props}
  >
    {children}
  </ACard>
)

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

function mapAppearance(appearance?: string) {
  if (appearance === 'primary') return { type: 'primary' as const }
  if (appearance === 'subtle') return { type: 'text' as const }
  if (appearance === 'secondary') return { type: 'default' as const }
  return { type: 'default' as const }
}

function mapSize(size?: string) {
  if (size === 'small') return { size: 'small' as const }
  if (size === 'large') return { size: 'large' as const }
  return {}
}

export const Button: FC<any> = ({ icon, children, appearance, size, style, type = 'button', ...rest }) => (
  <AButton icon={icon} htmlType={type} {...mapAppearance(appearance)} {...mapSize(size)} style={style} {...rest}>
    {children}
  </AButton>
)

// ---------------------------------------------------------------------------
// Input / SpinButton
// ---------------------------------------------------------------------------

export const Input: FC<any> = ({ contentBefore, contentAfter, onChange, value, style, className, ...rest }) => (
  <AInput
    value={value ?? ''}
    onChange={(e) => onChange?.(e, { value: e.target.value })}
    prefix={contentBefore}
    suffix={contentAfter}
    style={style}
    className={className}
    {...rest}
  />
)

export const SpinButton: FC<any> = ({ onChange, value, style, min, max, step, ...rest }) => (
  <AInputNumber
    value={value ?? 0}
    onChange={(v) => onChange?.(undefined, { value: v })}
    min={min}
    max={max}
    step={step}
    style={{ width: '100%', ...style }}
    {...rest}
  />
)

// ---------------------------------------------------------------------------
// Dropdown / Option
// ---------------------------------------------------------------------------

function normalizeOptionChildren(children: ReactNode): Array<{ value: string; label: string }> {
  const opts: Array<{ value: string; label: string }> = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    const cp = child.props as any
    const val = String(cp.value ?? cp.text ?? cp.children ?? '')
    const label = String(cp.text ?? cp.children ?? val)
    opts.push({ value: val, label })
  })
  return opts
}

export const Dropdown: FC<any> = ({ children, selectedOptions, onOptionSelect, onChange, value, style, ...rest }) => {
  const options = normalizeOptionChildren(children)
  const resolvedValue = selectedOptions?.[0] ?? value ?? options[0]?.value ?? ''
  return (
    <ASelect
      value={String(resolvedValue)}
      onChange={(val: string, option: any) => {
        const optionText = option?.label ?? val
        onOptionSelect?.(undefined, { optionValue: val, optionText, selectedOptions: [val] })
        onChange?.(undefined, { value: val })
      }}
      options={options}
      style={{ width: '100%', ...style }}
      {...rest}
    />
  )
}
export const Option: FC<any> = ({ children, ...rest }) => <option {...rest}>{children}</option>

// ---------------------------------------------------------------------------
// Checkbox
// ---------------------------------------------------------------------------

export const Checkbox: FC<any> = ({ label, checked, onChange, children, style, ...rest }) => (
  <ACheckbox checked={!!checked} onChange={(e) => onChange?.(e, { checked: e.target.checked })} style={style} {...rest}>
    {label ?? children}
  </ACheckbox>
)

// ---------------------------------------------------------------------------
// RadioGroup / Radio
// ---------------------------------------------------------------------------

export const RadioGroup: FC<any> = ({ value, onChange, children, style, ...rest }) => (
  <ARadioGroup.Group value={value} onChange={(e) => onChange?.(e, { value: e.target.value })} style={style} {...rest}>
    {children}
  </ARadioGroup.Group>
)

export const Radio: FC<any> = ({ label, value, style, ...rest }) => (
  <ARadioGroup value={value} style={style} {...rest}>
    {label}
  </ARadioGroup>
)

// ---------------------------------------------------------------------------
// Slider / ProgressBar / Spinner
// ---------------------------------------------------------------------------

export const Slider: FC<any> = ({ value, min = 0, max = 100, step, onChange, style, ...rest }) => (
  <ASlider
    value={Number(value ?? min)}
    min={min}
    max={max}
    step={step}
    onChange={(v: number) => onChange?.(undefined, { value: v })}
    style={{ width: '100%', margin: '4px 0', ...style }}
    {...rest}
  />
)

export const ProgressBar: FC<any> = ({ value = 0, max = 1, style, ...rest }) => (
  <AProgress
    percent={Math.round((Number(value) / Number(max)) * 100)}
    showInfo={false}
    style={{ margin: 0, ...style }}
    {...rest}
  />
)

export const Spinner: FC<any> = ({ label, size }) => (
  <Spin size={size === 'tiny' || size === 'small' ? 'small' : size === 'large' ? 'large' : 'default'}>
    {label ? <span style={{ marginLeft: 8 }}>{label}</span> : null}
  </Spin>
)

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

export const Badge: FC<any> = ({ appearance, color, icon, children, style, ...rest }) => {
  const tagColor =
    appearance === 'filled'
      ? color === 'danger'
        ? 'error'
        : color === 'success'
          ? 'success'
          : color === 'warning'
            ? 'warning'
            : 'processing'
      : undefined
  return (
    <ATag
      color={tagColor}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        borderRadius: 999,
        fontSize: 12,
        ...(appearance === 'outline' ? { background: 'transparent', border: '1px solid var(--border)' } : {}),
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
    </ATag>
  )
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

export const Tooltip: FC<any> = ({ content, children, relationship: _, ...rest }) => (
  <ATooltip title={content} {...rest}>
    {children}
  </ATooltip>
)

// ---------------------------------------------------------------------------
// MessageBar
// ---------------------------------------------------------------------------

export const MessageBar: FC<any> = ({ intent, style, children, ...props }) => (
  <Alert
    type={intent === 'error' ? 'error' : intent === 'success' ? 'success' : intent === 'warning' ? 'warning' : 'info'}
    showIcon
    style={{ borderRadius: 8, ...style }}
    message={children}
    {...props}
  />
)
export const MessageBarBody: FC<any> = ({ style, children, ...props }) => (
  <div style={{ marginTop: 4, ...style }} {...props}>
    {children}
  </div>
)

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

type OpenChangeHandler = (ev: unknown, data: { open: boolean }) => void

function useOpenState(externalOpen: boolean | undefined, onOpenChange?: OpenChangeHandler) {
  const [inner, setInner] = useState(false)
  const controlled = typeof externalOpen === 'boolean'
  const open = controlled ? !!externalOpen : inner
  const setOpen = (next: boolean) => {
    if (!controlled) setInner(next)
    onOpenChange?.(undefined, { open: next })
  }
  return { open, setOpen }
}

const DialogContext = createContext<{ open: boolean; setOpen: (next: boolean) => void } | null>(null)

export const Dialog: FC<any> = ({ open, onOpenChange, children }) => {
  const state = useOpenState(open, onOpenChange)
  return <DialogContext.Provider value={state}>{children}</DialogContext.Provider>
}

export const DialogTrigger: FC<any> = ({ children }) => {
  const ctx = useContext(DialogContext)
  if (!ctx) return <>{children}</>
  const handleClick = (e: any) => {
    e?.stopPropagation?.()
    ctx.setOpen(!ctx.open)
  }
  if (typeof children === 'function') return <>{children({ onClick: handleClick })}</>
  if (React.isValidElement(children)) {
    const prev = (children.props as any).onClick
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: any) => {
        prev?.(e)
        handleClick(e)
      },
    })
  }
  return <>{children}</>
}

export const DialogSurface: FC<any> = ({ children, style, ...rest }) => {
  const ctx = useContext(DialogContext)
  if (!ctx?.open) return null
  return (
    <Modal
      open={ctx.open}
      onCancel={() => ctx.setOpen(false)}
      footer={null}
      centered
      width="auto"
      styles={{
        content: {
          minWidth: 360,
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
          ...style,
        },
      }}
      {...rest}
    >
      {children}
    </Modal>
  )
}

export const DialogTitle: FC<any> = ({ style, children, ...props }) => (
  <ATitle level={4} style={{ margin: 0, fontSize: 20, ...style }} {...props}>
    {children}
  </ATitle>
)
export const DialogBody: FC<any> = ({ style, children, ...props }) => (
  <div style={{ marginTop: 12, ...style }} {...props}>
    {children}
  </div>
)
export const DialogContent: FC<any> = ({ style, children, ...props }) => (
  <div style={{ marginTop: 8, ...style }} {...props}>
    {children}
  </div>
)
export const DialogActions: FC<any> = ({ style, children, ...props }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14, ...style }} {...props}>
    {children}
  </div>
)

// ---------------------------------------------------------------------------
// Accordion
// ---------------------------------------------------------------------------

type AccordionCtxType = { openValues: Set<string>; toggle: (value: string) => void }
const AccordionCtx = createContext<AccordionCtxType | null>(null)
const AccordionItemCtx = createContext<{ value: string } | null>(null)

export const Accordion: FC<any> = ({ children, style, ...props }) => {
  const [openValues, setOpenValues] = useState<Set<string>>(new Set())
  const toggle = (value: string) => {
    setOpenValues((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }
  return (
    <AccordionCtx.Provider value={{ openValues, toggle }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }} {...props}>
        {children}
      </div>
    </AccordionCtx.Provider>
  )
}
export const AccordionItem: FC<any> = ({ value, children, style, ...props }) => (
  <AccordionItemCtx.Provider value={{ value: String(value) }}>
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, ...style }} {...props}>
      {children}
    </div>
  </AccordionItemCtx.Provider>
)
export const AccordionHeader: FC<any> = ({ icon, children, style, ...props }) => {
  const item = useContext(AccordionItemCtx)
  const acc = useContext(AccordionCtx)
  return (
    <AButton
      type="text"
      onClick={() => item && acc?.toggle(item.value)}
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
export const AccordionPanel: FC<any> = ({ style, children, ...props }) => {
  const item = useContext(AccordionItemCtx)
  const acc = useContext(AccordionCtx)
  const open = item ? acc?.openValues.has(item.value) : true
  if (!open) return null
  return (
    <div style={{ padding: 12, ...style }} {...props}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const Table: FC<any> = ({ style, children, ...props }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', ...style }} {...props}>
    {children}
  </table>
)
export const TableHeader: FC<any> = ({ children, ...props }) => <thead {...props}>{children}</thead>
export const TableBody: FC<any> = ({ children, ...props }) => <tbody {...props}>{children}</tbody>
export const TableRow: FC<any> = ({ style, children, ...props }) => (
  <tr style={{ borderBottom: '1px solid var(--border)', ...style }} {...props}>
    {children}
  </tr>
)
export const TableHeaderCell: FC<any> = ({ style, children, ...props }) => (
  <th
    style={{
      textAlign: 'left',
      fontWeight: 620,
      padding: '10px 12px',
      fontSize: 13,
      color: 'var(--muted-foreground)',
      ...style,
    }}
    {...props}
  >
    {children}
  </th>
)
export const TableCell: FC<any> = ({ style, children, ...props }) => (
  <td style={{ padding: '10px 12px', ...style }} {...props}>
    {children}
  </td>
)
export const TableCellLayout: FC<any> = ({ media, truncate, children, style, ...props }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, ...style }} {...props}>
    {media ? <span style={{ display: 'inline-flex', alignItems: 'center' }}>{media}</span> : null}
    <span
      style={
        truncate
          ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }
          : { minWidth: 0 }
      }
    >
      {children}
    </span>
  </div>
)

// ---------------------------------------------------------------------------
// Field
// ---------------------------------------------------------------------------

export const Field: FC<any> = ({ label, children, style, hint, required, ...props }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }} {...props}>
    {label ? (
      <label style={{ fontSize: 13, fontWeight: 500 }}>
        {label}
        {required ? <span style={{ color: 'var(--app-error)', marginLeft: 2 }}>*</span> : null}
      </label>
    ) : null}
    {children}
    {hint ? <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{hint}</span> : null}
  </div>
)
