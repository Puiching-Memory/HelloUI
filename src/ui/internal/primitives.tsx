import React from 'react'
import {
  Button as AButton,
  Card as ACard,
  Checkbox as ACheckbox,
  Input as AInput,
  InputNumber as AInputNumber,
  Radio as ARadio,
  Select as ASelect,
  Slider as ASlider,
} from 'antd'
import type {
  ButtonHTMLAttributes,
  ChangeEvent,
  ComponentProps,
  FC,
  MouseEventHandler,
  ReactElement,
  ReactNode,
} from 'react'

type CardProps = ComponentProps<typeof ACard>
type AntInputProps = ComponentProps<typeof AInput>
type AntTextAreaProps = ComponentProps<typeof AInput.TextArea>
type AntInputNumberProps = ComponentProps<typeof AInputNumber>
type AntCheckboxProps = ComponentProps<typeof ACheckbox>
type AntRadioGroupProps = ComponentProps<typeof ARadio.Group>
type AntRadioProps = ComponentProps<typeof ARadio>
type AntSelectProps = ComponentProps<typeof ASelect>
type AntSliderSingleProps = Extract<ComponentProps<typeof ASlider>, { range?: false | undefined }>

type InputChangeData = { value: string }
type SpinButtonChangeData = { value: number | null }
type OptionSelectData = {
  optionText: string
  optionValue: string
  selectedOptions: string[]
}
type CheckboxChangeData = { checked: boolean }
type RadioChangeData = { value: string | number }
type SliderChangeData = { value: number }

type ButtonProps = Omit<ComponentProps<typeof AButton>, 'type' | 'size'> & {
  appearance?: 'primary' | 'secondary' | 'subtle'
  size?: 'small' | 'medium' | 'large'
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type']
}

type InputProps = Omit<AntInputProps, 'onChange' | 'prefix' | 'suffix' | 'value'> & {
  contentBefore?: ReactNode
  contentAfter?: ReactNode
  value?: string
  onChange?: (event: ChangeEvent<HTMLInputElement>, data: InputChangeData) => void
}

type TextAreaProps = Omit<AntTextAreaProps, 'onChange' | 'value'> & {
  value?: string
  onChange?: (event: ChangeEvent<HTMLTextAreaElement>, data: InputChangeData) => void
}

type SpinButtonProps = Omit<AntInputNumberProps, 'onChange'> & {
  onChange?: (_event: undefined, data: SpinButtonChangeData) => void
}

type OptionProps = React.OptionHTMLAttributes<HTMLOptionElement> & {
  text?: string
}

type DropdownProps = Omit<AntSelectProps, 'onChange' | 'value' | 'options' | 'children'> & {
  children?: ReactNode
  selectedOptions?: string[]
  value?: string
  onChange?: (_event: undefined, data: InputChangeData) => void
  onOptionSelect?: (_event: undefined, data: OptionSelectData) => void
}

type CheckboxProps = Omit<AntCheckboxProps, 'onChange'> & {
  label?: ReactNode
  onChange?: (event: ChangeEvent<HTMLInputElement>, data: CheckboxChangeData) => void
}

type RadioGroupProps = Omit<AntRadioGroupProps, 'onChange'> & {
  onChange?: (event: ComponentProps<typeof ARadio.Group>['onChange'] extends infer T ? T extends (...args: infer U) => unknown ? U[0] : never : never, data: RadioChangeData) => void
}

type RadioProps = AntRadioProps & {
  label?: ReactNode
}

type SliderProps = Omit<AntSliderSingleProps, 'onChange' | 'value'> & {
  value?: number
  onChange?: (_event: undefined, data: SliderChangeData) => void
}

function mapAppearance(appearance?: ButtonProps['appearance']) {
  if (appearance === 'primary') return { type: 'primary' as const }
  if (appearance === 'subtle') return { type: 'text' as const }
  return { type: 'default' as const }
}

function mapSize(size?: ButtonProps['size']) {
  if (size === 'small') return { size: 'small' as const }
  if (size === 'large') return { size: 'large' as const }
  return {}
}

function normalizeOptionChildren(children: ReactNode): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = []

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    const optionChild = child as ReactElement<OptionProps>
    const value = String(optionChild.props.value ?? optionChild.props.text ?? optionChild.props.children ?? '')
    const label = String(optionChild.props.text ?? optionChild.props.children ?? value)
    options.push({ value, label })
  })

  return options
}

const CompatTextArea: FC<TextAreaProps> = ({ onChange, value, ...rest }) => (
  <AInput.TextArea value={value ?? ''} onChange={(event) => onChange?.(event, { value: event.target.value })} {...rest} />
)

type CompatInputComponent = FC<InputProps> & {
  TextArea: FC<TextAreaProps>
}

export const Card: FC<CardProps> = ({ style, children, ...props }) => (
  <ACard
    style={{ borderRadius: 12, boxShadow: '0 6px 22px rgba(var(--shadow-rgb), 0.04)', ...style }}
    styles={{ body: { padding: 16 } }}
    {...props}
  >
    {children}
  </ACard>
)

export const Button: FC<ButtonProps> = ({ icon, children, appearance, size, style, type = 'button', ...rest }) => (
  <AButton icon={icon} htmlType={type} {...mapAppearance(appearance)} {...mapSize(size)} style={style} {...rest}>
    {children}
  </AButton>
)

const InputRoot: CompatInputComponent = ({ contentBefore, contentAfter, onChange, value, style, className, ...rest }) => (
  <AInput
    value={value ?? ''}
    onChange={(event) => onChange?.(event, { value: event.target.value })}
    prefix={contentBefore}
    suffix={contentAfter}
    style={style}
    className={className}
    {...rest}
  />
)

InputRoot.TextArea = CompatTextArea

export const Input = InputRoot

export const SpinButton: FC<SpinButtonProps> = ({ onChange, value, style, min, max, step, ...rest }) => (
  <AInputNumber
    value={value ?? 0}
    onChange={(nextValue) => {
      const resolvedValue = typeof nextValue === 'number' ? nextValue : nextValue == null ? null : Number(nextValue)
      onChange?.(undefined, { value: Number.isNaN(resolvedValue as number) ? null : resolvedValue })
    }}
    min={min}
    max={max}
    step={step}
    style={{ width: '100%', ...style }}
    {...rest}
  />
)

export const Dropdown: FC<DropdownProps> = ({ children, selectedOptions, onOptionSelect, onChange, value, style, ...rest }) => {
  const options = normalizeOptionChildren(children)
  const resolvedValue = selectedOptions?.[0] ?? value ?? options[0]?.value ?? ''

  return (
    <ASelect
      value={String(resolvedValue)}
      onChange={(nextValue, option) => {
        const optionRecord = Array.isArray(option) ? option[0] : option
        const optionText = String((optionRecord as { label?: ReactNode } | undefined)?.label ?? nextValue)
        const next = String(nextValue)
        onOptionSelect?.(undefined, { optionText, optionValue: next, selectedOptions: [next] })
        onChange?.(undefined, { value: next })
      }}
      options={options}
      style={{ width: '100%', ...style }}
      {...rest}
    />
  )
}

export const Option: FC<OptionProps> = ({ children, ...rest }) => <option {...rest}>{children}</option>

export const Checkbox: FC<CheckboxProps> = ({ label, checked, onChange, children, style, ...rest }) => (
  <ACheckbox checked={!!checked} onChange={(event) => onChange?.(event as unknown as ChangeEvent<HTMLInputElement>, { checked: event.target.checked })} style={style} {...rest}>
    {label ?? children}
  </ACheckbox>
)

export const RadioGroup: FC<RadioGroupProps> = ({ value, onChange, children, style, ...rest }) => (
  <ARadio.Group
    value={value}
    onChange={(event) => onChange?.(event, { value: event.target.value })}
    style={style}
    {...rest}
  >
    {children}
  </ARadio.Group>
)

export const Radio: FC<RadioProps> = ({ label, value, style, ...rest }) => (
  <ARadio value={value} style={style} {...rest}>
    {label}
  </ARadio>
)

export const Slider: FC<SliderProps> = ({ value, min = 0, max = 100, step, onChange, style, ...rest }) => (
  <ASlider
    value={Number(value ?? min)}
    min={min}
    max={max}
    step={step}
    onChange={(nextValue) => {
      if (typeof nextValue === 'number') {
        onChange?.(undefined, { value: nextValue })
      }
    }}
    style={{ width: '100%', margin: '4px 0', ...style }}
    {...rest}
  />
)

export type {
  CheckboxChangeData,
  InputChangeData,
  MouseEventHandler,
  OptionSelectData,
  SliderChangeData,
  SpinButtonChangeData,
}
