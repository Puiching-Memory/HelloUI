import type { CSSProperties } from 'react'

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
  return input.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
}

function toCssValue(prop: string, value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'number') return unitlessProps.has(prop) ? String(value) : `${value}px`
  if (Array.isArray(value)) return value.map((item) => toCssValue(prop, item)).join(' ')
  return String(value)
}

function serializeStyle(selector: string, styleObj: Record<string, unknown>): string {
  let cssBody = ''
  let nestedCss = ''

  for (const [rawKey, rawValue] of Object.entries(styleObj)) {
    if (rawValue == null) continue

    if (typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      const nestedStyle = rawValue as Record<string, unknown>
      if (rawKey.startsWith('@')) {
        nestedCss += `${rawKey}{${serializeStyle(selector, nestedStyle)}}`
        continue
      }
      if (rawKey.startsWith(':') || rawKey.startsWith('::')) {
        nestedCss += serializeStyle(`${selector}${rawKey}`, nestedStyle)
        continue
      }
      if (rawKey.includes('&')) {
        nestedCss += serializeStyle(rawKey.replace(/&/g, selector), nestedStyle)
        continue
      }
      nestedCss += serializeStyle(`${selector} ${rawKey}`, nestedStyle)
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
