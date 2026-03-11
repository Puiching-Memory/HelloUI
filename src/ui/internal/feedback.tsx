import { Alert, Progress as AProgress, Spin, Tag as ATag, Tooltip as ATooltip } from 'antd'
import type { ComponentProps, FC, HTMLAttributes, ReactNode } from 'react'

type ProgressBarProps = ComponentProps<typeof AProgress> & {
  value?: number
  max?: number
}

type SpinnerProps = {
  label?: ReactNode
  size?: 'tiny' | 'small' | 'medium' | 'large'
}

type BadgeProps = ComponentProps<typeof ATag> & {
  appearance?: 'filled' | 'outline' | 'tint'
  color?: 'danger' | 'success' | 'warning' | 'informative' | string
  icon?: ReactNode
}

type TooltipProps = Omit<ComponentProps<typeof ATooltip>, 'title'> & {
  content?: ReactNode
  title?: ReactNode
  relationship?: unknown
}

type MessageIntent = 'error' | 'success' | 'warning' | 'info'
type MessageBarProps = Omit<ComponentProps<typeof Alert>, 'type' | 'message'> & {
  intent?: MessageIntent
  children?: ReactNode
}

export const ProgressBar: FC<ProgressBarProps> = ({ value = 0, max = 1, style, ...rest }) => (
  <AProgress
    percent={Math.round((Number(value) / Number(max)) * 100)}
    showInfo={false}
    style={{ margin: 0, ...style }}
    {...rest}
  />
)

export const Spinner: FC<SpinnerProps> = ({ label, size }) => (
  <Spin size={size === 'tiny' || size === 'small' ? 'small' : size === 'large' ? 'large' : 'default'}>
    {label ? <span style={{ marginLeft: 8 }}>{label}</span> : null}
  </Spin>
)

export const Badge: FC<BadgeProps> = ({ appearance, color, icon, children, style, ...rest }) => {
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

export const Tooltip: FC<TooltipProps> = ({ content, title, children, relationship: _relationship, ...rest }) => (
  <ATooltip title={content ?? title} {...rest}>
    {children}
  </ATooltip>
)

export const MessageBar: FC<MessageBarProps> = ({ intent, style, children, ...props }) => (
  <Alert
    type={intent === 'error' ? 'error' : intent === 'success' ? 'success' : intent === 'warning' ? 'warning' : 'info'}
    showIcon
    style={{ borderRadius: 8, ...style }}
    message={children}
    {...props}
  />
)

export const MessageBarBody: FC<HTMLAttributes<HTMLDivElement>> = ({ style, children, ...props }) => (
  <div style={{ marginTop: 4, ...style }} {...props}>
    {children}
  </div>
)
