import type { CSSProperties, ComponentType, FC } from 'react'

export type IconProps = {
  fontSize?: number | string
  style?: CSSProperties
  className?: string
}

function parseFontSize(fontSize?: number | string): number | undefined {
  if (typeof fontSize === 'number') return fontSize
  if (typeof fontSize === 'string') {
    const parsed = Number.parseFloat(fontSize)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

export function createIcon<P extends object>(Icon: ComponentType<P>): FC<IconProps & Omit<P, keyof IconProps>> {
  const WrappedIcon: FC<IconProps & Omit<P, keyof IconProps>> = ({ fontSize, style, ...props }) => {
    const size = parseFontSize(fontSize) ?? 16
    return <Icon {...(props as P)} style={{ fontSize: size, ...style }} />
  }

  WrappedIcon.displayName = `CompatIcon(${Icon.displayName ?? Icon.name ?? 'Anonymous'})`

  return WrappedIcon
}
