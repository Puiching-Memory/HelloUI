import { createLightTheme, createDarkTheme, type BrandVariants, type Theme } from '@/ui/components';

// ---------------------------------------------------------------------------
// 色板定义
// ---------------------------------------------------------------------------

interface ColorPalette {
  base: string; mantle: string; crust: string;
  surface0: string; surface1: string; surface2: string;
  overlay0: string; overlay1: string; overlay2: string;
  text: string; subtext1: string; subtext0: string;
  blue: string; sapphire: string;
}

const frappePalette: ColorPalette = {
  base: '#303446', mantle: '#292c3c', crust: '#232634',
  surface0: '#414559', surface1: '#51576d', surface2: '#626880',
  overlay0: '#737994', overlay1: '#838ba7', overlay2: '#949cbb',
  text: '#c6d0f5', subtext1: '#b5bfe2', subtext0: '#a5adce',
  blue: '#8caaee', sapphire: '#85c1dc',
};

const lattePalette: ColorPalette = {
  base: '#eff1f5', mantle: '#e6e9ef', crust: '#dce0e8',
  surface0: '#ccd0da', surface1: '#bcc0cc', surface2: '#acb0be',
  overlay0: '#9ca0b0', overlay1: '#8c8fa1', overlay2: '#7c7f93',
  text: '#4c4f69', subtext1: '#5c5f77', subtext0: '#6c6f85',
  blue: '#1e66f5', sapphire: '#209fb5',
};

// ---------------------------------------------------------------------------
// 品牌色变体
// ---------------------------------------------------------------------------

const frappeBrand: BrandVariants = {
  10: '#1a1f2e', 20: '#2a3450', 30: '#3a4972', 40: '#4a5e94',
  50: '#5a73b6', 60: '#6a88d8', 70: '#8caaee', 80: '#a5c0f5',
  90: '#bed6fc', 100: '#d7ecff', 110: '#f0f8ff',
  120: '#ffffff', 130: '#ffffff', 140: '#ffffff', 150: '#ffffff', 160: '#ffffff',
};

const latteBrand: BrandVariants = {
  10: '#0a1a3d', 20: '#0f2a5a', 30: '#143a77', 40: '#194a94',
  50: '#1e5ab1', 60: '#1e66f5', 70: '#4a85f7', 80: '#76a4f9',
  90: '#a2c3fb', 100: '#cee2fd', 110: '#eaf1ff',
  120: '#ffffff', 130: '#ffffff', 140: '#ffffff', 150: '#ffffff', 160: '#ffffff',
};

// ---------------------------------------------------------------------------
// 将色板应用到主题
// ---------------------------------------------------------------------------

function applyPalette(theme: Theme, palette: ColorPalette): Theme {
  theme.colorNeutralForeground1 = palette.text;
  theme.colorNeutralForeground2 = palette.subtext1;
  theme.colorNeutralForeground3 = palette.subtext0;
  theme.colorNeutralForeground4 = palette.overlay2;

  theme.colorNeutralBackground1 = palette.base;
  theme.colorNeutralBackground2 = palette.mantle;
  theme.colorNeutralBackground3 = palette.crust;
  theme.colorNeutralBackground4 = palette.surface0;
  theme.colorNeutralBackground5 = palette.surface1;
  theme.colorNeutralBackground6 = palette.surface2;

  theme.colorNeutralStroke1 = palette.overlay0;
  theme.colorNeutralStroke2 = palette.surface0;
  theme.colorNeutralStrokeAccessible = palette.overlay1;

  theme.colorBrandForeground1 = palette.blue;
  theme.colorBrandForeground2 = palette.sapphire;
  theme.colorBrandBackground = palette.blue;
  theme.colorBrandBackground2 = palette.surface0;
  theme.colorBrandStroke1 = palette.blue;
  theme.colorBrandStroke2 = palette.sapphire;

  return theme;
}

// ---------------------------------------------------------------------------
// 导出主题
// ---------------------------------------------------------------------------

export const catppuccinDarkTheme: Theme = applyPalette(createDarkTheme(frappeBrand), frappePalette);
export const catppuccinLatteTheme: Theme = applyPalette(createLightTheme(latteBrand), lattePalette);
