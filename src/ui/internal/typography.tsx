import { Typography } from 'antd'
import type { ComponentProps, CSSProperties, FC } from 'react'

const { Title: ATitle, Paragraph, Text: AText } = Typography

type TextProps = ComponentProps<typeof AText> & {
  block?: boolean
  weight?: 'semibold' | CSSProperties['fontWeight']
}

type ParagraphProps = ComponentProps<typeof Paragraph> & {
  block?: boolean
}

type TitleProps = ComponentProps<typeof ATitle>

export const Text: FC<TextProps> = ({ block, weight, style, children, ...props }) => (
  <AText
    style={{
      display: block ? 'block' : undefined,
      fontWeight: weight === 'semibold' ? 600 : weight ?? style?.fontWeight,
      ...style,
    }}
    {...props}
  >
    {children}
  </AText>
)

export const Body1: FC<ParagraphProps> = ({ block, style, children, ...props }) => (
  <Paragraph style={{ margin: 0, display: block ? 'block' : 'inline-block', fontSize: 14, ...style }} {...props}>
    {children}
  </Paragraph>
)

export const Body2: FC<ParagraphProps> = ({ block, style, children, ...props }) => (
  <Paragraph style={{ margin: 0, display: block ? 'block' : 'inline-block', fontSize: 13, ...style }} {...props}>
    {children}
  </Paragraph>
)

export const Caption1: FC<ComponentProps<typeof AText>> = ({ style, children, ...props }) => (
  <AText type="secondary" style={{ fontSize: 12, ...style }} {...props}>
    {children}
  </AText>
)

export const Title1: FC<TitleProps> = ({ style, children, ...props }) => (
  <ATitle level={1} style={{ margin: 0, fontSize: 32, ...style }} {...props}>
    {children}
  </ATitle>
)

export const Title2: FC<TitleProps> = ({ style, children, ...props }) => (
  <ATitle level={2} style={{ margin: 0, fontSize: 22, ...style }} {...props}>
    {children}
  </ATitle>
)

export const Title3: FC<TitleProps> = ({ style, children, ...props }) => (
  <ATitle level={3} style={{ margin: 0, fontSize: 18, ...style }} {...props}>
    {children}
  </ATitle>
)
