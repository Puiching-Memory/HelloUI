/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import React, {
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useState,
} from 'react';

type AnyProps = {
  children?: React.ReactNode | ((props: AnyProps) => React.ReactNode);
  onChange?: (ev: unknown, data: unknown) => void;
  onOptionSelect?: (ev: unknown, data: unknown) => void;
  onOpenChange?: (ev: unknown, data: unknown) => void;
  onTabSelect?: (ev: unknown, data: unknown) => void;
  onDismiss?: (ev: unknown, data: unknown) => void;
  onClick?: (ev: unknown) => void;
  [key: string]: unknown;
};
type StyleMap = Record<string, React.CSSProperties | Record<string, unknown>>;

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
]);

const globalStyleId = '__fluent_compat_styles__';
let classSeed = 0;

function ensureStyleSheet() {
  let style = document.getElementById(globalStyleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = globalStyleId;
    document.head.appendChild(style);
  }
  return style;
}

function toKebabCase(input: string) {
  if (input.startsWith('--')) return input;
  return input.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function toCssValue(prop: string, value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number') {
    return unitlessProps.has(prop) ? String(value) : `${value}px`;
  }
  if (Array.isArray(value)) {
    return value.map((v) => toCssValue(prop, v)).join(' ');
  }
  return String(value);
}

function serializeStyle(selector: string, styleObj: Record<string, unknown>): string {
  let cssBody = '';
  let nestedCss = '';

  for (const [rawKey, rawValue] of Object.entries(styleObj)) {
    if (rawValue == null) continue;

    if (typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      if (rawKey.startsWith('@')) {
        nestedCss += `${rawKey}{${serializeStyle(selector, rawValue)}}`;
        continue;
      }

      if (rawKey.startsWith(':') || rawKey.startsWith('::')) {
        nestedCss += serializeStyle(`${selector}${rawKey}`, rawValue);
        continue;
      }

      if (rawKey.includes('&')) {
        nestedCss += serializeStyle(rawKey.replace(/&/g, selector), rawValue);
        continue;
      }

      nestedCss += serializeStyle(`${selector} ${rawKey}`, rawValue);
      continue;
    }

    const key = toKebabCase(rawKey);
    const value = toCssValue(rawKey, rawValue);
    if (!value) continue;
    cssBody += `${key}:${value};`;
  }

  const cssRule = cssBody ? `${selector}{${cssBody}}` : '';
  return cssRule + nestedCss;
}

export function makeStyles(styles: StyleMap) {
  const classMap: Record<string, string> = {};
  if (typeof document !== 'undefined') {
    const styleEl = ensureStyleSheet();
    let css = '';
    for (const [slot, slotStyle] of Object.entries(styles)) {
      const className = `fc_${slot}_${classSeed++}`;
      classMap[slot] = className;
      css += serializeStyle(`.${className}`, slotStyle as Record<string, unknown>);
    }
    styleEl.appendChild(document.createTextNode(css));
  } else {
    for (const slot of Object.keys(styles)) {
      classMap[slot] = `fc_${slot}_${classSeed++}`;
    }
  }
  return () => classMap;
}

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
  colorPaletteBlueForeground2: '#2563eb',
  colorPaletteGreenForeground1: '#15803d',
  colorPaletteRedForeground1: '#dc2626',
  colorPaletteRedForeground2: '#b91c1c',
  colorPaletteYellowForeground1: '#ca8a04',
  fontSizeBase100: '12px',
  fontSizeBase200: '13px',
  fontSizeBase300: '14px',
  fontSizeBase400: '16px',
  fontSizeBase500: '20px',
  fontWeightSemibold: '600',
  shadow8: '0 4px 14px rgba(0,0,0,0.08)',
  shadow16: '0 10px 24px rgba(0,0,0,0.12)',
  shadow28: '0 24px 48px rgba(0,0,0,0.18)',
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
};

export const tokens = new Proxy(tokenValues, {
  get(target, key: string) {
    if (key in target) return target[key];
    return 'var(--foreground)';
  },
}) as Record<string, string>;

export type BrandVariants = Record<number, string>;
export type Theme = Record<string, string | number>;

function baseTheme(brand: BrandVariants, isDark: boolean): Theme {
  return {
    colorNeutralForeground1: isDark ? '#fafafa' : '#0a0a0a',
    colorNeutralForeground2: isDark ? '#d4d4d4' : '#404040',
    colorNeutralForeground3: isDark ? '#a3a3a3' : '#737373',
    colorNeutralBackground1: isDark ? '#171717' : '#fafafa',
    colorNeutralBackground2: isDark ? '#262626' : '#f5f5f5',
    colorNeutralBackground3: isDark ? '#303030' : '#ededed',
    colorNeutralStroke1: isDark ? '#404040' : '#d4d4d4',
    colorNeutralStroke2: isDark ? '#525252' : '#e5e5e5',
    colorBrandForeground1: brand[70] ?? '#2563eb',
    colorBrandForeground2: brand[80] ?? '#1d4ed8',
    colorBrandBackground: brand[60] ?? '#2563eb',
    colorBrandBackground2: isDark ? '#1f2937' : '#eff6ff',
    colorBrandStroke1: brand[60] ?? '#2563eb',
    colorBrandStroke2: brand[70] ?? '#1d4ed8',
  };
}

export function createLightTheme(brand: BrandVariants): Theme {
  return baseTheme(brand, false);
}

export function createDarkTheme(brand: BrandVariants): Theme {
  return baseTheme(brand, true);
}

function withIcon(children: React.ReactNode, icon?: React.ReactNode) {
  if (!icon) return children;
  return (
    <>
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>
      {children}
    </>
  );
}

const baseButtonStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--foreground)',
  borderRadius: 8,
  padding: '8px 14px',
  minHeight: 34,
  lineHeight: 1.2,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
  fontWeight: 520,
  transition: 'all 0.15s ease',
};

export const Text: React.FC<AnyProps> = ({ block, weight, style, ...props }) => (
  <span
    style={{
      display: block ? 'block' : 'inline',
      fontWeight: weight === 'semibold' ? 600 : style?.fontWeight,
      ...style,
    }}
    {...props}
  />
);

export const Body1: React.FC<AnyProps> = ({ block, style, ...props }) => (
  <p style={{ margin: 0, display: block ? 'block' : 'inline-block', fontSize: tokens.fontSizeBase300, ...style }} {...props} />
);
export const Body2: React.FC<AnyProps> = ({ block, style, ...props }) => (
  <p style={{ margin: 0, display: block ? 'block' : 'inline-block', fontSize: tokens.fontSizeBase200, ...style }} {...props} />
);
export const Caption1: React.FC<AnyProps> = ({ style, ...props }) => (
  <span style={{ fontSize: tokens.fontSizeBase100, color: tokens.colorNeutralForeground3, ...style }} {...props} />
);
export const Title1: React.FC<AnyProps> = ({ style, ...props }) => <h1 style={{ margin: 0, fontSize: 32, ...style }} {...props} />;
export const Title2: React.FC<AnyProps> = ({ style, ...props }) => <h2 style={{ margin: 0, fontSize: 22, ...style }} {...props} />;
export const Title3: React.FC<AnyProps> = ({ style, ...props }) => <h3 style={{ margin: 0, fontSize: 18, ...style }} {...props} />;

export const Card: React.FC<AnyProps> = ({ style, children, ...props }) => (
  <div
    style={{
      border: '1px solid var(--border)',
      background: 'var(--card)',
      borderRadius: 12,
      padding: 16,
      boxShadow: '0 6px 22px rgba(15, 23, 42, 0.04)',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const Divider: React.FC<AnyProps> = ({ style, ...props }) => (
  <hr style={{ border: 0, borderTop: '1px solid var(--border)', width: '100%', ...style }} {...props} />
);

export const Button: React.FC<AnyProps> = ({
  icon,
  children,
  appearance,
  size,
  style,
  type = 'button',
  ...rest
}) => {
  const resolved: React.CSSProperties = { ...baseButtonStyle, ...style };
  if (appearance === 'primary') {
    resolved.background = 'var(--primary)';
    resolved.color = 'var(--primary-foreground)';
    resolved.borderColor = 'var(--primary)';
  } else if (appearance === 'subtle') {
    resolved.background = 'color-mix(in srgb, var(--secondary) 58%, transparent)';
    resolved.borderColor = 'transparent';
  } else if (appearance === 'secondary') {
    resolved.background = 'var(--secondary)';
  }
  if (size === 'small') {
    resolved.padding = '6px 10px';
    resolved.minHeight = 28;
    resolved.fontSize = 12;
  } else if (size === 'large') {
    resolved.padding = '10px 16px';
    resolved.minHeight = 40;
  }

  return (
    <button type={type} style={resolved} {...rest}>
      {withIcon(children, icon)}
    </button>
  );
};

export const CompoundButton: React.FC<AnyProps> = ({ secondaryContent, children, icon, style, ...rest }) => (
  <button type="button" style={{ ...baseButtonStyle, flexDirection: 'column', alignItems: 'flex-start', ...style }} {...rest}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {icon}
      {children}
    </span>
    {secondaryContent ? <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{secondaryContent}</span> : null}
  </button>
);

export const MenuButton: React.FC<AnyProps> = ({ menuIcon, icon, children, ...rest }) => (
  <Button icon={icon} {...rest}>
    {children}
    {menuIcon ? <span style={{ marginLeft: 6 }}>{menuIcon}</span> : null}
  </Button>
);

export const SplitButton: React.FC<AnyProps> = ({ icon, children, ...rest }) => <Button icon={icon} {...rest}>{children}</Button>;
export const ToggleButton: React.FC<AnyProps> = ({ checked, onChange, ...rest }) => (
  <Button
    appearance={checked ? 'primary' : 'secondary'}
    onClick={(e: React.MouseEvent<HTMLButtonElement>) => onChange?.(e, { checked: !checked })}
    {...rest}
  />
);

export const Input: React.FC<AnyProps> = ({
  contentBefore,
  contentAfter,
  onChange,
  value,
  style,
  className,
  ...rest
}) => {
  const inputNode = (
    <input
      value={value ?? ''}
      onChange={(e) => onChange?.(e, { value: e.target.value })}
      style={{
        height: 38,
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '8px 12px',
        background: 'var(--card)',
        color: 'var(--foreground)',
        width: '100%',
        ...style,
      }}
      className={className}
      {...rest}
    />
  );

  if (!contentBefore && !contentAfter) return inputNode;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0 10px',
        background: 'var(--card)',
      }}
      className={className}
    >
      {contentBefore}
      {React.cloneElement(inputNode as React.ReactElement<unknown>, {
        style: { border: 0, padding: '8px 0', background: 'transparent', ...style },
      })}
      {contentAfter}
    </div>
  );
};

export const Textarea: React.FC<AnyProps> = ({ onChange, value, style, resize, ...rest }) => (
  <textarea
    value={value ?? ''}
    onChange={(e) => onChange?.(e, { value: e.target.value })}
    style={{
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '10px 12px',
      background: 'var(--card)',
      color: 'var(--foreground)',
      width: '100%',
      resize: resize ?? 'vertical',
      ...style,
    }}
    {...rest}
  />
);

export const SpinButton: React.FC<AnyProps> = ({ onChange, value, style, ...rest }) => (
  <input
    type="number"
    value={value ?? 0}
    onChange={(e) => onChange?.(e, { value: Number(e.target.value) })}
    style={{
      height: 38,
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '8px 12px',
      background: 'var(--card)',
      color: 'var(--foreground)',
      width: '100%',
      ...style,
    }}
    {...rest}
  />
);

function normalizeOptionChildren(children: React.ReactNode): Array<{ value: string; label: string }> {
  const opts: Array<{ value: string; label: string }> = [];
  React.Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const cp = child.props as AnyProps;
    const value = String(cp.value ?? cp.text ?? cp.children ?? '');
    const label = String(cp.text ?? cp.children ?? value);
    opts.push({ value, label });
  });
  return opts;
}

function SelectLike({
  children,
  selectedOptions,
  onOptionSelect,
  onChange,
  value,
  style,
  ...rest
}: AnyProps) {
  const options = normalizeOptionChildren(children);
  const resolvedValue = selectedOptions?.[0] ?? value ?? options[0]?.value ?? '';
  return (
    <select
      value={String(resolvedValue)}
      onChange={(e) => {
        const optionValue = e.target.value;
        const optionText = e.target.selectedOptions?.[0]?.text ?? optionValue;
        onOptionSelect?.(e, { optionValue, optionText, selectedOptions: [optionValue] });
        onChange?.(e, { value: optionValue });
      }}
      style={{
        height: 38,
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '8px 12px',
        background: 'var(--card)',
        color: 'var(--foreground)',
        width: '100%',
        ...style,
      }}
      {...rest}
    >
      {children}
    </select>
  );
}

export const Dropdown: React.FC<AnyProps> = (props) => <SelectLike {...props} />;
export const Combobox: React.FC<AnyProps> = (props) => <SelectLike {...props} />;
export const Select: React.FC<AnyProps> = (props) => <SelectLike {...props} />;
export const Option: React.FC<AnyProps> = ({ children, ...rest }) => <option {...rest}>{children}</option>;

export const Checkbox: React.FC<AnyProps> = ({ label, checked, onChange, children, style, ...rest }) => (
  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, ...style }}>
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onChange?.(e, { checked: e.target.checked })}
      {...rest}
    />
    <span>{label ?? children}</span>
  </label>
);

export const Switch: React.FC<AnyProps> = (props) => <Checkbox {...props} />;

const RadioGroupContext = createContext<{ value?: string; onChange?: (value: string) => void; name: string } | null>(null);

export const RadioGroup: React.FC<AnyProps> = ({ value, onChange, children, style, ...rest }) => {
  const name = useId();
  return (
    <RadioGroupContext.Provider
      value={{
        value,
        onChange: (next) => onChange?.(undefined, { value: next }),
        name,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }} {...rest}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
};

export const Radio: React.FC<AnyProps> = ({ label, value, onChange, checked, style, ...rest }) => {
  const ctx = useContext(RadioGroupContext);
  const isChecked = checked ?? (ctx ? String(ctx.value) === String(value) : false);
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, ...style }}>
      <input
        type="radio"
        value={value}
        checked={!!isChecked}
        name={ctx?.name}
        onChange={(e) => {
          ctx?.onChange?.(String(value));
          onChange?.(e, { checked: e.target.checked, value });
        }}
        {...rest}
      />
      <span>{label}</span>
    </label>
  );
};

export const Slider: React.FC<AnyProps> = ({ value, min = 0, max = 100, onChange, style, ...rest }) => (
  <input
    type="range"
    value={Number(value ?? min)}
    min={min}
    max={max}
    onChange={(e) => onChange?.(e, { value: Number(e.target.value) })}
    style={{ width: '100%', accentColor: 'var(--primary)', ...style }}
    {...rest}
  />
);

export const ProgressBar: React.FC<AnyProps> = ({ value = 0, max = 1, style, ...rest }) => (
  <progress value={value} max={max} style={{ width: '100%', ...style }} {...rest} />
);

const spinnerStyleId = '__fluent_compat_spinner__';
if (typeof document !== 'undefined' && !document.getElementById(spinnerStyleId)) {
  const s = document.createElement('style');
  s.id = spinnerStyleId;
  s.textContent = '@keyframes fc-spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(s);
}

export const Spinner: React.FC<AnyProps> = ({ label, style }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...style }}>
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: '50%',
        border: '2px solid var(--border)',
        borderTopColor: 'var(--primary)',
        animation: 'fc-spin 0.8s linear infinite',
      }}
    />
    {label ? <span>{label}</span> : null}
  </span>
);

export const Avatar: React.FC<AnyProps> = ({ name, icon, size = 32, shape, style, ...rest }) => {
  const initials = typeof name === 'string' ? name.slice(0, 2).toUpperCase() : '';
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: shape === 'square' ? 6 : 999,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--muted)',
        border: '1px solid var(--border)',
        fontSize: Math.max(12, Number(size) * 0.35),
        ...style,
      }}
      {...rest}
    >
      {icon ?? initials}
    </span>
  );
};

export const Badge: React.FC<AnyProps> = ({ appearance, color, icon, children, style, ...rest }) => {
  const resolved: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    padding: '2px 8px',
    fontSize: 12,
    border: '1px solid transparent',
    background: 'var(--secondary)',
    color: 'var(--foreground)',
    ...style,
  };
  if (appearance === 'outline') {
    resolved.background = 'transparent';
    resolved.borderColor = 'var(--border)';
  } else if (appearance === 'filled' || appearance === 'brand') {
    resolved.background = color === 'danger' ? '#dc2626' : 'var(--primary)';
    resolved.color = 'var(--primary-foreground)';
  } else if (appearance === 'tint') {
    resolved.background = 'var(--secondary)';
  }
  return (
    <span style={resolved} {...rest}>
      {icon}
      {children}
    </span>
  );
};

export const CounterBadge: React.FC<AnyProps> = ({ count = 0, showZero = true, ...rest }) => {
  if (!showZero && count === 0) return null;
  return <Badge {...rest}>{count}</Badge>;
};

export const PresenceBadge: React.FC<AnyProps> = ({ status = 'available', style, ...rest }) => {
  const color =
    status === 'busy' ? '#dc2626' : status === 'away' ? '#f59e0b' : status === 'offline' ? '#737373' : '#22c55e';
  return <span style={{ width: 10, height: 10, borderRadius: 999, background: color, display: 'inline-block', ...style }} {...rest} />;
};

export const Tooltip: React.FC<AnyProps> = ({ content, children }) => {
  if (!isValidElement(children)) return <>{children}</>;
  return React.cloneElement(children as React.ReactElement<unknown>, { title: typeof content === 'string' ? content : undefined });
};

export const MessageBar: React.FC<AnyProps> = ({ intent, style, ...props }) => {
  const colors: Record<string, string> = {
    info: '#2563eb',
    success: '#15803d',
    warning: '#ca8a04',
    error: '#b91c1c',
  };
  return (
    <div
      style={{
        border: `1px solid ${colors[intent] ?? 'var(--border)'}`,
        borderRadius: 8,
        padding: 10,
        background: 'var(--background)',
        ...style,
      }}
      {...props}
    />
  );
};
export const MessageBarTitle: React.FC<AnyProps> = ({ style, ...props }) => <div style={{ fontWeight: 600, ...style }} {...props} />;
export const MessageBarBody: React.FC<AnyProps> = ({ style, ...props }) => <div style={{ marginTop: 4, ...style }} {...props} />;

export const List: React.FC<AnyProps> = ({ style, ...props }) => <ul style={{ margin: 0, paddingLeft: 20, ...style }} {...props} />;
export const ListItem: React.FC<AnyProps> = ({ style, ...props }) => <li style={{ marginBottom: 6, ...style }} {...props} />;

const TabListContext = createContext<{ selectedValue?: string; setSelectedValue?: (v: string) => void } | null>(null);
export const TabList: React.FC<AnyProps> = ({ selectedValue, onTabSelect, children, style, ...rest }) => (
  <TabListContext.Provider value={{ selectedValue, setSelectedValue: (v) => onTabSelect?.(undefined, { value: v }) }}>
    <div style={{ display: 'flex', gap: 8, ...style }} {...rest}>
      {children}
    </div>
  </TabListContext.Provider>
);

export const Tab: React.FC<AnyProps> = ({ value, icon, children, style, onClick, ...rest }) => {
  const ctx = useContext(TabListContext);
  const active = ctx?.selectedValue === value;
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick?.(e);
        if (value != null) ctx?.setSelectedValue?.(String(value));
      }}
      style={{
        ...baseButtonStyle,
        ...(active ? { background: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : {}),
        ...style,
      }}
      {...rest}
    >
      {withIcon(children, icon)}
    </button>
  );
};

const OverlayShell: React.FC<{ onClick?: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <div
    onClick={onClick}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.35)',
      zIndex: 1500,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}
  >
    {children}
  </div>
);

type OpenChangeHandler = ((ev: unknown, data: { open: boolean }) => void) | undefined;

function useOpenState(externalOpen: boolean | undefined, onOpenChange: OpenChangeHandler) {
  const [inner, setInner] = useState(false);
  const controlled = typeof externalOpen === 'boolean';
  const open = controlled ? !!externalOpen : inner;
  const setOpen = (next: boolean) => {
    if (!controlled) setInner(next);
    onOpenChange?.(undefined, { open: next });
  };
  return { open, setOpen };
}

const DialogContext = createContext<{ open: boolean; setOpen: (next: boolean) => void } | null>(null);

export const Dialog: React.FC<AnyProps> = ({ open, onOpenChange, children }) => {
  const state = useOpenState(open, onOpenChange);
  return <DialogContext.Provider value={state}>{children}</DialogContext.Provider>;
};

export const DialogTrigger: React.FC<AnyProps> = ({ children }) => {
  const ctx = useContext(DialogContext);
  if (!ctx) return <>{children}</>;
  const onClick = (e: unknown) => {
    e?.stopPropagation?.();
    ctx.setOpen(!ctx.open);
  };
  if (typeof children === 'function') {
    return <>{children({ onClick })}</>;
  }
  if (isValidElement(children)) {
    const prev = (children.props as AnyProps).onClick;
    return React.cloneElement(children as React.ReactElement<unknown>, {
      onClick: (e: unknown) => {
        prev?.(e);
        onClick(e);
      },
    });
  }
  return <>{children}</>;
};

export const DialogSurface: React.FC<AnyProps> = ({ children, style, ...rest }) => {
  const ctx = useContext(DialogContext);
  if (!ctx?.open) return null;
  return (
    <OverlayShell onClick={() => ctx.setOpen(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          minWidth: 360,
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'var(--card)',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 20,
          boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
          ...style,
        }}
        {...rest}
      >
        {children}
      </div>
    </OverlayShell>
  );
};

export const DialogTitle: React.FC<AnyProps> = ({ style, ...props }) => <h3 style={{ margin: 0, fontSize: 20, ...style }} {...props} />;
export const DialogBody: React.FC<AnyProps> = ({ style, ...props }) => <div style={{ marginTop: 12, ...style }} {...props} />;
export const DialogContent: React.FC<AnyProps> = ({ style, ...props }) => <div style={{ marginTop: 8, ...style }} {...props} />;
export const DialogActions: React.FC<AnyProps> = ({ style, ...props }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14, ...style }} {...props} />
);

const PopoverContext = createContext<{ open: boolean; setOpen: (next: boolean) => void } | null>(null);
export const Popover: React.FC<AnyProps> = ({ open, onOpenChange, children }) => {
  const state = useOpenState(open, onOpenChange);
  return <PopoverContext.Provider value={state}>{children}</PopoverContext.Provider>;
};
export const PopoverTrigger: React.FC<AnyProps> = ({ children }) => {
  const ctx = useContext(PopoverContext);
  if (!ctx) return <>{children}</>;
  if (typeof children === 'function') return <>{children({ onClick: () => ctx.setOpen(!ctx.open) })}</>;
  if (!isValidElement(children)) return <>{children}</>;
  const prev = (children.props as AnyProps).onClick;
  return React.cloneElement(children as React.ReactElement<unknown>, {
    onClick: (e: unknown) => {
      prev?.(e);
      ctx.setOpen(!ctx.open);
    },
  });
};
export const PopoverSurface: React.FC<AnyProps> = ({ style, ...props }) => {
  const ctx = useContext(PopoverContext);
  if (!ctx?.open) return null;
  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 1400,
        background: 'var(--background)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 12px 24px rgba(0,0,0,0.16)',
        padding: 10,
        ...style,
      }}
      {...props}
    />
  );
};

const MenuContext = createContext<{ open: boolean; setOpen: (next: boolean) => void } | null>(null);
export const Menu: React.FC<AnyProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  return <MenuContext.Provider value={{ open, setOpen }}>{children}</MenuContext.Provider>;
};
export const MenuTrigger: React.FC<AnyProps> = ({ children }) => {
  const ctx = useContext(MenuContext);
  if (!ctx) return <>{children}</>;
  const triggerProps = { onClick: () => ctx.setOpen(!ctx.open) };
  if (typeof children === 'function') return <>{children(triggerProps)}</>;
  if (isValidElement(children)) {
    const prev = (children.props as AnyProps).onClick;
    return React.cloneElement(children as React.ReactElement<unknown>, {
      onClick: (e: unknown) => {
        prev?.(e);
        triggerProps.onClick();
      },
    });
  }
  return <>{children}</>;
};
export const MenuPopover: React.FC<AnyProps> = ({ style, ...props }) => {
  const ctx = useContext(MenuContext);
  if (!ctx?.open) return null;
  return <div style={{ position: 'relative', zIndex: 1300, ...style }} {...props} />;
};
export const MenuList: React.FC<AnyProps> = ({ style, ...props }) => (
  <div
    style={{
      border: '1px solid var(--border)',
      borderRadius: 8,
      background: 'var(--background)',
      padding: 6,
      minWidth: 140,
      boxShadow: '0 12px 24px rgba(0,0,0,0.16)',
      ...style,
    }}
    {...props}
  />
);
export const MenuItem: React.FC<AnyProps> = ({ icon, children, style, ...props }) => (
  <button type="button" style={{ ...baseButtonStyle, width: '100%', justifyContent: 'flex-start', border: 0, ...style }} {...props}>
    {withIcon(children, icon)}
  </button>
);
export const MenuDivider: React.FC<AnyProps> = (props) => <Divider {...props} />;

export const Breadcrumb: React.FC<AnyProps> = ({ style, ...props }) => (
  <nav style={{ display: 'flex', alignItems: 'center', gap: 8, ...style }} {...props} />
);
export const BreadcrumbItem: React.FC<AnyProps> = ({ style, ...props }) => <span style={{ display: 'inline-flex', ...style }} {...props} />;
export const BreadcrumbButton: React.FC<AnyProps> = ({ icon, children, current, style, ...props }) => (
  <button
    type="button"
    style={{
      border: 0,
      background: 'transparent',
      color: current ? 'var(--foreground)' : 'var(--muted-foreground)',
      fontWeight: current ? 600 : 400,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      ...style,
    }}
    {...props}
  >
    {withIcon(children, icon)}
  </button>
);
export const Link: React.FC<AnyProps> = ({ style, disabled, ...props }) => (
  <a
    style={{
      color: disabled ? 'var(--muted-foreground)' : 'var(--primary)',
      pointerEvents: disabled ? 'none' : 'auto',
      textDecoration: 'none',
      ...style,
    }}
    {...props}
  />
);

type AccordionCtxType = { openValues: Set<string>; toggle: (value: string) => void };
const AccordionContext = createContext<AccordionCtxType | null>(null);
const AccordionItemContext = createContext<{ value: string } | null>(null);

export const Accordion: React.FC<AnyProps> = ({ children, style, ...props }) => {
  const [openValues, setOpenValues] = useState<Set<string>>(new Set());
  const toggle = (value: string) => {
    setOpenValues((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };
  return (
    <AccordionContext.Provider value={{ openValues, toggle }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
};
export const AccordionItem: React.FC<AnyProps> = ({ value, children, style, ...props }) => (
  <AccordionItemContext.Provider value={{ value: String(value) }}>
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, ...style }} {...props}>
      {children}
    </div>
  </AccordionItemContext.Provider>
);
export const AccordionHeader: React.FC<AnyProps> = ({ icon, children, style, ...props }) => {
  const item = useContext(AccordionItemContext);
  const acc = useContext(AccordionContext);
  return (
    <button
      type="button"
      onClick={() => item && acc?.toggle(item.value)}
      style={{ ...baseButtonStyle, width: '100%', justifyContent: 'space-between', border: 0, ...style }}
      {...props}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{icon}{children}</span>
    </button>
  );
};
export const AccordionPanel: React.FC<AnyProps> = ({ style, ...props }) => {
  const item = useContext(AccordionItemContext);
  const acc = useContext(AccordionContext);
  const open = item ? acc?.openValues.has(item.value) : true;
  if (!open) return null;
  return <div style={{ padding: 12, ...style }} {...props} />;
};

export const Skeleton: React.FC<AnyProps> = ({ style, ...props }) => <div style={{ display: 'grid', gap: 8, ...style }} {...props} />;
export const SkeletonItem: React.FC<AnyProps> = ({ size = 16, shape, style, ...props }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: shape === 'circle' ? 999 : 4,
      background: 'linear-gradient(90deg, var(--muted), var(--secondary), var(--muted))',
      ...style,
    }}
    {...props}
  />
);

export const Tag: React.FC<AnyProps> = ({ children, style, ...props }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      border: '1px solid var(--border)',
      borderRadius: 999,
      padding: '4px 10px',
      fontSize: 12,
      ...style,
    }}
    {...props}
  >
    {children}
  </span>
);
export const InteractionTag: React.FC<AnyProps> = (props) => <Tag {...props} />;
export const TagGroup: React.FC<AnyProps> = ({ style, ...props }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, ...style }} {...props} />
);

export const Rating: React.FC<AnyProps> = ({ value = 0, max = 5, onChange, style }) => (
  <div style={{ display: 'inline-flex', gap: 4, ...style }}>
    {Array.from({ length: max }).map((_, i) => {
      const n = i + 1;
      return (
        <button
          key={n}
          type="button"
          style={{ border: 0, background: 'transparent', cursor: 'pointer', color: n <= value ? '#f59e0b' : '#d4d4d4' }}
          onClick={(e) => onChange?.(e, { value: n })}
        >
          ★
        </button>
      );
    })}
  </div>
);
export const RatingDisplay: React.FC<AnyProps> = ({ value = 0 }) => <Rating value={value} onChange={undefined} />;

type ToastEntry = { id: string; node: React.ReactNode; intent?: string };
const toastBus = new Map<string, Set<(entries: ToastEntry[]) => void>>();
const toastStore = new Map<string, ToastEntry[]>();

function notifyToaster(id: string) {
  const listeners = toastBus.get(id);
  const entries = toastStore.get(id) ?? [];
  listeners?.forEach((fn) => fn(entries));
}

export function useToastController(toasterId = 'default') {
  return {
    dispatchToast(node: React.ReactNode, opts?: AnyProps) {
      const entry: ToastEntry = { id: `toast_${Date.now()}_${Math.random()}`, node, intent: opts?.intent };
      const entries = [...(toastStore.get(toasterId) ?? []), entry];
      toastStore.set(toasterId, entries);
      notifyToaster(toasterId);
      setTimeout(() => {
        const next = (toastStore.get(toasterId) ?? []).filter((t) => t.id !== entry.id);
        toastStore.set(toasterId, next);
        notifyToaster(toasterId);
      }, 3500);
    },
  };
}

export const Toaster: React.FC<AnyProps> = ({ toasterId = 'default' }) => {
  const [entries, setEntries] = useState<ToastEntry[]>(toastStore.get(toasterId) ?? []);
  useEffect(() => {
    const set = toastBus.get(toasterId) ?? new Set<(entries: ToastEntry[]) => void>();
    set.add(setEntries);
    toastBus.set(toasterId, set);
    return () => {
      set.delete(setEntries);
    };
  }, [toasterId]);

  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 2000, display: 'grid', gap: 8 }}>
      {entries.map((entry) => (
        <div key={entry.id}>{entry.node}</div>
      ))}
    </div>
  );
};

export const Toast: React.FC<AnyProps> = ({ style, ...props }) => (
  <div
    style={{
      background: 'var(--background)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      minWidth: 240,
      boxShadow: '0 12px 24px rgba(0,0,0,0.14)',
      padding: 10,
      ...style,
    }}
    {...props}
  />
);
export const ToastTitle: React.FC<AnyProps> = ({ style, ...props }) => <div style={{ fontWeight: 600, ...style }} {...props} />;
export const ToastBody: React.FC<AnyProps> = ({ style, ...props }) => <div style={{ marginTop: 4, ...style }} {...props} />;
export const ToastFooter: React.FC<AnyProps> = ({ style, ...props }) => <div style={{ marginTop: 8, ...style }} {...props} />;

export const Toolbar: React.FC<AnyProps> = ({ style, ...props }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...style }} {...props} />
);
export const ToolbarGroup: React.FC<AnyProps> = ({ style, ...props }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...style }} {...props} />
);
export const ToolbarButton: React.FC<AnyProps> = (props) => <Button {...props} />;
export const ToolbarDivider: React.FC<AnyProps> = ({ style, ...props }) => (
  <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', ...style }} {...props} />
);

const DrawerContext = createContext<{ open: boolean; setOpen: (next: boolean) => void } | null>(null);
export const Drawer: React.FC<AnyProps> = ({ open, onOpenChange, children }) => {
  const state = useOpenState(open, onOpenChange);
  if (!state.open) return null;
  return (
    <DrawerContext.Provider value={state}>
      <OverlayShell onClick={() => state.setOpen(false)}>
        <aside
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 360,
            maxWidth: '90vw',
            height: '100%',
            marginLeft: 'auto',
            background: 'var(--background)',
            borderLeft: '1px solid var(--border)',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </aside>
      </OverlayShell>
    </DrawerContext.Provider>
  );
};
export const DrawerHeader: React.FC<AnyProps> = ({ style, ...props }) => <div style={{ padding: 12, borderBottom: '1px solid var(--border)', ...style }} {...props} />;
export const DrawerHeaderTitle: React.FC<AnyProps> = ({ action, children, style, ...props }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, ...style }} {...props}>
    <strong>{children}</strong>
    {action}
  </div>
);
export const DrawerBody: React.FC<AnyProps> = ({ style, ...props }) => <div style={{ padding: 12, overflow: 'auto', ...style }} {...props} />;

export const Table: React.FC<AnyProps> = ({ style, ...props }) => <table style={{ width: '100%', borderCollapse: 'collapse', ...style }} {...props} />;
export const TableHeader: React.FC<AnyProps> = ({ ...props }) => <thead {...props} />;
export const TableBody: React.FC<AnyProps> = ({ ...props }) => <tbody {...props} />;
export const TableRow: React.FC<AnyProps> = ({ style, ...props }) => <tr style={{ borderBottom: '1px solid var(--border)', ...style }} {...props} />;
export const TableHeaderCell: React.FC<AnyProps> = ({ style, ...props }) => (
  <th style={{ textAlign: 'left', fontWeight: 620, padding: '10px 12px', fontSize: 13, color: 'var(--muted-foreground)', ...style }} {...props} />
);
export const TableCell: React.FC<AnyProps> = ({ style, ...props }) => <td style={{ padding: '10px 12px', ...style }} {...props} />;
export const TableCellLayout: React.FC<AnyProps> = ({
  media,
  truncate,
  children,
  style,
  ...props
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, ...style }} {...props}>
    {media ? <span style={{ display: 'inline-flex', alignItems: 'center' }}>{media}</span> : null}
    <span
      style={
        truncate
          ? {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flex: 1,
          }
          : { minWidth: 0 }
      }
    >
      {children}
    </span>
  </div>
);

export const Field: React.FC<AnyProps> = ({ label, children, style, ...props }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }} {...props}>
    {label ? <label style={{ fontSize: 13, fontWeight: 500 }}>{label}</label> : null}
    {children}
  </div>
);

