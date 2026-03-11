export type BrandVariants = Record<number, string>
export type Theme = Record<string, string | number>

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

function baseTheme(brand: BrandVariants): Theme {
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
  return baseTheme(brand)
}

export function createDarkTheme(brand: BrandVariants): Theme {
  return baseTheme(brand)
}
