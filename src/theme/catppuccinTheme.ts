import { createLightTheme, createDarkTheme, BrandVariants, Theme } from '@fluentui/react-components';

// Catppuccin Frappé 配色方案
const catppuccinColors = {
  // 基础颜色
  base: '#303446',        // 基础背景
  mantle: '#292c3c',      // 次背景
  crust: '#232634',       // 最暗背景
  
  // 表面颜色
  surface0: '#414559',
  surface1: '#51576d',
  surface2: '#626880',
  
  // 覆盖层
  overlay0: '#737994',
  overlay1: '#838ba7',
  overlay2: '#949cbb',
  
  // 文本颜色
  text: '#c6d0f5',        // 主要文本
  subtext1: '#b5bfe2',    // 次要文本
  subtext0: '#a5adce',    // 更次要文本
  
  // 品牌色（使用蓝色）
  blue: '#8caaee',
  sapphire: '#85c1dc',
  sky: '#99d1db',
  teal: '#81c8be',
  green: '#a6d189',
  yellow: '#e5c890',
  peach: '#ef9f76',
  maroon: '#ea999c',
  red: '#e78284',
  mauve: '#ca9ee6',
  pink: '#f4b8e4',
  flamingo: '#eebebe',
  rosewater: '#f2d5cf',
  lavender: '#babbf1',
};

// 创建品牌色变体（基于蓝色）
const brandColors: BrandVariants = {
  10: '#1a1f2e',  // 最暗
  20: '#2a3450',
  30: '#3a4972',
  40: '#4a5e94',
  50: '#5a73b6',
  60: '#6a88d8',  // 主品牌色
  70: '#8caaee',  // catppuccin blue
  80: '#a5c0f5',
  90: '#bed6fc',
  100: '#d7ecff',
  110: '#f0f8ff', // 最亮
  120: '#ffffff',
  130: '#ffffff',
  140: '#ffffff',
  150: '#ffffff',
  160: '#ffffff',
};

// 创建深色主题（主要使用 Catppuccin 配色）
export const catppuccinDarkTheme: Theme = createDarkTheme(brandColors);

// 覆盖主题颜色以使用 Catppuccin 配色
catppuccinDarkTheme.colorNeutralForeground1 = catppuccinColors.text;
catppuccinDarkTheme.colorNeutralForeground2 = catppuccinColors.subtext1;
catppuccinDarkTheme.colorNeutralForeground3 = catppuccinColors.subtext0;
catppuccinDarkTheme.colorNeutralForeground4 = catppuccinColors.overlay2;

catppuccinDarkTheme.colorNeutralBackground1 = catppuccinColors.base;
catppuccinDarkTheme.colorNeutralBackground2 = catppuccinColors.mantle;
catppuccinDarkTheme.colorNeutralBackground3 = catppuccinColors.crust;
catppuccinDarkTheme.colorNeutralBackground4 = catppuccinColors.surface0;
catppuccinDarkTheme.colorNeutralBackground5 = catppuccinColors.surface1;
catppuccinDarkTheme.colorNeutralBackground6 = catppuccinColors.surface2;

catppuccinDarkTheme.colorNeutralStroke1 = catppuccinColors.overlay0;
catppuccinDarkTheme.colorNeutralStroke2 = catppuccinColors.surface0;
catppuccinDarkTheme.colorNeutralStrokeAccessible = catppuccinColors.overlay1;

// 品牌色
catppuccinDarkTheme.colorBrandForeground1 = catppuccinColors.blue;
catppuccinDarkTheme.colorBrandForeground2 = catppuccinColors.sapphire;
catppuccinDarkTheme.colorBrandBackground = catppuccinColors.blue;
catppuccinDarkTheme.colorBrandBackground2 = catppuccinColors.surface0;
catppuccinDarkTheme.colorBrandStroke1 = catppuccinColors.blue;
catppuccinDarkTheme.colorBrandStroke2 = catppuccinColors.sapphire;

// 创建浅色主题（基于 Catppuccin 的浅色变体）
export const catppuccinLightTheme: Theme = createLightTheme(brandColors);

// 浅色主题使用较亮的 Catppuccin 颜色
catppuccinLightTheme.colorNeutralForeground1 = '#4c4f69';  // 深色文本
catppuccinLightTheme.colorNeutralForeground2 = '#5c5f77';
catppuccinLightTheme.colorNeutralForeground3 = '#6c6f85';
catppuccinLightTheme.colorNeutralForeground4 = '#7c7f93';

catppuccinLightTheme.colorNeutralBackground1 = '#eff1f5';  // 浅色背景
catppuccinLightTheme.colorNeutralBackground2 = '#e6e9ef';
catppuccinLightTheme.colorNeutralBackground3 = '#dce0e8';
catppuccinLightTheme.colorNeutralBackground4 = '#d2d6e0';
catppuccinLightTheme.colorNeutralBackground5 = '#c8ccd8';
catppuccinLightTheme.colorNeutralBackground6 = '#bec2d0';

catppuccinLightTheme.colorNeutralStroke1 = '#bcc0cc';
catppuccinLightTheme.colorNeutralStroke2 = '#acb0be';
catppuccinLightTheme.colorNeutralStrokeAccessible = '#9ca0b0';

// 品牌色（浅色主题）
catppuccinLightTheme.colorBrandForeground1 = catppuccinColors.blue;
catppuccinLightTheme.colorBrandForeground2 = catppuccinColors.sapphire;
catppuccinLightTheme.colorBrandBackground = catppuccinColors.blue;
catppuccinLightTheme.colorBrandBackground2 = '#e6e9ef';
catppuccinLightTheme.colorBrandStroke1 = catppuccinColors.blue;
catppuccinLightTheme.colorBrandStroke2 = catppuccinColors.sapphire;

// Catppuccin Latte 配色方案
const latteColors = {
  // 基础颜色
  base: '#eff1f5',        // Base
  mantle: '#e6e9ef',      // Mantle
  crust: '#dce0e8',       // Crust
  
  // 表面颜色
  surface0: '#ccd0da',    // Surface0
  surface1: '#bcc0cc',    // Surface1
  surface2: '#acb0be',    // Surface2
  
  // 覆盖层
  overlay0: '#9ca0b0',    // Overlay0
  overlay1: '#8c8fa1',    // Overlay1
  overlay2: '#7c7f93',    // Overlay2
  
  // 文本颜色
  text: '#4c4f69',        // Text
  subtext1: '#5c5f77',    // Subtext1
  subtext0: '#6c6f85',    // Subtext0
  
  // 品牌色
  blue: '#1e66f5',        // Blue
  sapphire: '#209fb5',    // Sapphire
  sky: '#04a5e5',         // Sky
  teal: '#179299',        // Teal
  green: '#40a02b',       // Green
  yellow: '#df8e1d',      // Yellow
  peach: '#fe640b',       // Peach
  maroon: '#e64553',      // Maroon
  red: '#d20f39',         // Red
  mauve: '#8839ef',       // Mauve
  pink: '#ea76cb',        // Pink
  flamingo: '#dd7878',    // Flamingo
  rosewater: '#dc8a78',   // Rosewater
  lavender: '#7287fd',    // Lavender
};

// 创建 Latte 品牌色变体（基于蓝色）
const latteBrandColors: BrandVariants = {
  10: '#0a1a3d',  // 最暗
  20: '#0f2a5a',
  30: '#143a77',
  40: '#194a94',
  50: '#1e5ab1',
  60: '#1e66f5',  // 主品牌色 (Latte Blue)
  70: '#4a85f7',
  80: '#76a4f9',
  90: '#a2c3fb',
  100: '#cee2fd',
  110: '#eaf1ff', // 最亮
  120: '#ffffff',
  130: '#ffffff',
  140: '#ffffff',
  150: '#ffffff',
  160: '#ffffff',
};

// 创建 Latte 主题（浅色主题）
export const catppuccinLatteTheme: Theme = createLightTheme(latteBrandColors);

// Latte 主题颜色配置
catppuccinLatteTheme.colorNeutralForeground1 = latteColors.text;
catppuccinLatteTheme.colorNeutralForeground2 = latteColors.subtext1;
catppuccinLatteTheme.colorNeutralForeground3 = latteColors.subtext0;
catppuccinLatteTheme.colorNeutralForeground4 = latteColors.overlay2;

catppuccinLatteTheme.colorNeutralBackground1 = latteColors.base;
catppuccinLatteTheme.colorNeutralBackground2 = latteColors.mantle;
catppuccinLatteTheme.colorNeutralBackground3 = latteColors.crust;
catppuccinLatteTheme.colorNeutralBackground4 = latteColors.surface0;
catppuccinLatteTheme.colorNeutralBackground5 = latteColors.surface1;
catppuccinLatteTheme.colorNeutralBackground6 = latteColors.surface2;

catppuccinLatteTheme.colorNeutralStroke1 = latteColors.overlay0;
catppuccinLatteTheme.colorNeutralStroke2 = latteColors.surface0;
catppuccinLatteTheme.colorNeutralStrokeAccessible = latteColors.overlay1;

// 品牌色（Latte 主题）
catppuccinLatteTheme.colorBrandForeground1 = latteColors.blue;
catppuccinLatteTheme.colorBrandForeground2 = latteColors.sapphire;
catppuccinLatteTheme.colorBrandBackground = latteColors.blue;
catppuccinLatteTheme.colorBrandBackground2 = latteColors.surface0;
catppuccinLatteTheme.colorBrandStroke1 = latteColors.blue;
catppuccinLatteTheme.colorBrandStroke2 = latteColors.sapphire;

// Catppuccin Latte 深色变体配色方案（基于 Latte 配色创建深色版本）
const latteDarkColors = {
  // 基础颜色（深色背景）
  base: '#1e1e2e',        // 深色基础背景
  mantle: '#181825',      // 深色次背景
  crust: '#11111b',       // 最暗背景
  
  // 表面颜色（深色表面）
  surface0: '#313244',    // 深色表面0
  surface1: '#45475a',    // 深色表面1
  surface2: '#585b70',    // 深色表面2
  
  // 覆盖层（深色覆盖）
  overlay0: '#6c7086',    // 深色覆盖0
  overlay1: '#7f849c',    // 深色覆盖1
  overlay2: '#9399b2',    // 深色覆盖2
  
  // 文本颜色（浅色文本，与 Latte 的深色文本相反）
  text: '#cdd6f4',        // 浅色主要文本
  subtext1: '#bac2de',    // 浅色次要文本
  subtext0: '#a6adc8',    // 浅色更次要文本
  
  // 品牌色（保持 Latte 的品牌色，但调整亮度以适应深色背景）
  blue: '#89b4fa',        // 调整后的蓝色（更亮以适应深色背景）
  sapphire: '#74c7ec',    // 调整后的蓝绿色
  sky: '#89dceb',         // 调整后的天空蓝
  teal: '#94e2d5',        // 调整后的青绿色
  green: '#a6e3a1',       // 调整后的绿色
  yellow: '#f9e2af',      // 调整后的黄色
  peach: '#fab387',       // 调整后的桃色
  maroon: '#eba0ac',      // 调整后的栗色
  red: '#f38ba8',         // 调整后的红色
  mauve: '#cba6f7',       // 调整后的淡紫色
  pink: '#f5c2e7',        // 调整后的粉色
  flamingo: '#f2cdcd',    // 调整后的火烈鸟色
  rosewater: '#f5e0dc',   // 调整后的玫瑰水色
  lavender: '#b4befe',    // 调整后的薰衣草色
};

// 创建 Latte 深色品牌色变体（基于蓝色，适合深色背景）
const latteDarkBrandColors: BrandVariants = {
  10: '#0a1a3d',  // 最暗
  20: '#1e3a5f',
  30: '#325a81',
  40: '#467aa3',
  50: '#5a9ac5',
  60: '#6ba5e8',  // 主品牌色（调整后的 Latte Blue）
  70: '#89b4fa',  // Latte 深色蓝色
  80: '#a5c5fb',
  90: '#c1d6fc',
  100: '#dde7fd',
  110: '#f0f4ff', // 最亮
  120: '#ffffff',
  130: '#ffffff',
  140: '#ffffff',
  150: '#ffffff',
  160: '#ffffff',
};

// 创建 Latte 深色主题
export const catppuccinLatteDarkTheme: Theme = createDarkTheme(latteDarkBrandColors);

// Latte 深色主题颜色配置
catppuccinLatteDarkTheme.colorNeutralForeground1 = latteDarkColors.text;
catppuccinLatteDarkTheme.colorNeutralForeground2 = latteDarkColors.subtext1;
catppuccinLatteDarkTheme.colorNeutralForeground3 = latteDarkColors.subtext0;
catppuccinLatteDarkTheme.colorNeutralForeground4 = latteDarkColors.overlay2;

catppuccinLatteDarkTheme.colorNeutralBackground1 = latteDarkColors.base;
catppuccinLatteDarkTheme.colorNeutralBackground2 = latteDarkColors.mantle;
catppuccinLatteDarkTheme.colorNeutralBackground3 = latteDarkColors.crust;
catppuccinLatteDarkTheme.colorNeutralBackground4 = latteDarkColors.surface0;
catppuccinLatteDarkTheme.colorNeutralBackground5 = latteDarkColors.surface1;
catppuccinLatteDarkTheme.colorNeutralBackground6 = latteDarkColors.surface2;

catppuccinLatteDarkTheme.colorNeutralStroke1 = latteDarkColors.overlay0;
catppuccinLatteDarkTheme.colorNeutralStroke2 = latteDarkColors.surface0;
catppuccinLatteDarkTheme.colorNeutralStrokeAccessible = latteDarkColors.overlay1;

// 品牌色（Latte 深色主题）
catppuccinLatteDarkTheme.colorBrandForeground1 = latteDarkColors.blue;
catppuccinLatteDarkTheme.colorBrandForeground2 = latteDarkColors.sapphire;
catppuccinLatteDarkTheme.colorBrandBackground = latteDarkColors.blue;
catppuccinLatteDarkTheme.colorBrandBackground2 = latteDarkColors.surface0;
catppuccinLatteDarkTheme.colorBrandStroke1 = latteDarkColors.blue;
catppuccinLatteDarkTheme.colorBrandStroke2 = latteDarkColors.sapphire;

