import { createTheme, MantineColorsTuple, rem } from '@mantine/core';

// Primary cyan-blue color for dark mode (200, 100%, 55% = #0dc2ff)
const cyan: MantineColorsTuple = [
  '#e6f9ff',
  '#b3edff',
  '#80e1ff',
  '#4dd5ff',
  '#1ac9ff',
  '#0dc2ff', // Base - vibrant cyan-blue (200, 100%, 55%)
  '#0a9bcc',
  '#087499',
  '#054d66',
  '#032633',
];

// Accent purple (270, 80%, 60% = #a64dff)
const purple: MantineColorsTuple = [
  '#f5e6ff',
  '#e6b3ff',
  '#d780ff',
  '#c84dff',
  '#b81aff',
  '#a64dff', // Base - purple highlight (270, 80%, 60%)
  '#8533cc',
  '#642699',
  '#421a66',
  '#210d33',
];

// Destructive red (0, 85%, 60% = #f23d3d)
const red: MantineColorsTuple = [
  '#ffe6e6',
  '#ffb3b3',
  '#ff8080',
  '#ff4d4d',
  '#ff1a1a',
  '#f23d3d', // Base - vivid red (0, 85%, 60%)
  '#c23030',
  '#912424',
  '#611818',
  '#300c0c',
];

// Success green (150, 80%, 45% = #17cc8c)
const green: MantineColorsTuple = [
  '#e6fff5',
  '#b3ffe0',
  '#80ffcc',
  '#4dffb8',
  '#1affa3',
  '#17cc8c', // Base - success green (150, 80%, 45%)
  '#129966',
  '#0d664d',
  '#093340',
  '#041a20',
];

// Warning yellow/orange (40, 95%, 55% = #ffc414)
const yellow: MantineColorsTuple = [
  '#fffae6',
  '#fff0b3',
  '#ffe680',
  '#ffdc4d',
  '#ffd21a',
  '#ffc414', // Base - warning yellow (40, 95%, 55%)
  '#cc9d10',
  '#99760c',
  '#664e08',
  '#332704',
];

// Orange (25, 100%, 60% = #ff8533)
const orange: MantineColorsTuple = [
  '#ffede6',
  '#ffccb3',
  '#ffaa80',
  '#ff884d',
  '#ff661a',
  '#ff8533', // Base - vibrant orange (25, 100%, 60%)
  '#cc6a29',
  '#99501f',
  '#663515',
  '#331b0a',
];

// Info blue (same as cyan primary)
const blue: MantineColorsTuple = cyan;

// Dark theme colors
const dark: MantineColorsTuple = [
  '#f0f3f7', // lightest - for text on dark backgrounds (220, 20%, 95%)
  '#d4dbe6', // (220, 20%, 85%)
  '#a8b7cc', // (220, 20%, 70%)
  '#8c9cb3', // (220, 15%, 55%)
  '#4d5d75', // muted foreground
  '#293447', // secondary surfaces (230, 20%, 16%)
  '#1f2a3d', // input backgrounds (230, 18%, 18%)
  '#1a2433', // card surfaces (230, 22%, 11%)
  '#14192b', // sidebar background (230, 25%, 9%)
  '#0f1421', // deep background (230, 25%, 7%)
];

export const mantineTheme = createTheme({
  primaryColor: 'cyan',
  colors: {
    cyan,
    purple,
    red,
    green,
    yellow,
    orange,
    blue,
    dark,
  },

  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  headings: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  },

  defaultRadius: 'md',
  cursorType: 'pointer',

  // Default to dark mode
  defaultGradient: {
    from: 'cyan',
    to: 'purple',
    deg: 135,
  },

  spacing: {
    xs: rem(8),
    sm: rem(12),
    md: rem(16),
    lg: rem(24),
    xl: rem(32),
  },

  components: {
    Button: {
      defaultProps: {
        radius: 'md',
      },
      vars: (_theme: any, props: any) => {
        const variant = props?.variant;

        if (variant === 'filled') {
          return { root: { '--button-hover': cyan[6] } };
        }

        if (variant === 'light') {
          return { root: { '--button-hover': `${cyan[5]}20` } };
        }

        // subtle, outline, and other variants
        return { root: { '--button-hover': `${orange[5]}20` } };
      },
    },
    ActionIcon: {
      vars: (_theme: any, props: any) => {
        const variant = props?.variant;

        if (variant === 'light') {
          return { root: { '--ai-hover': `${cyan[5]}20` } };
        }

        // subtle and other variants
        return { root: { '--ai-hover': `${orange[5]}20` } };
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    Select: {
      defaultProps: {
        radius: 'md',
      },
    },
    Modal: {
      defaultProps: {
        radius: 'md',
      },
    },
    Tooltip: {
      defaultProps: {
        openDelay: 200,
      },
    },
  },

  other: {
    // CAD-specific colors (using actual HSL values)
    colors: {
      // Main surfaces
      background: 'hsl(230, 25%, 7%)',
      foreground: 'hsl(220, 20%, 95%)',
      card: 'hsl(230, 22%, 11%)',
      popover: 'hsl(230, 25%, 10%)',

      // Sidebar
      sidebarBackground: 'hsl(230, 25%, 9%)',
      sidebarForeground: 'hsl(220, 20%, 85%)',
      sidebarBorder: 'hsl(230, 18%, 20%)',

      // CAD-specific
      cadToolbar: 'hsl(230, 22%, 12%)',
      cadToolbarForeground: 'hsl(220, 20%, 80%)',
      cadActive: 'hsl(200, 100%, 55%)',
      cadActiveForeground: 'hsl(230, 25%, 7%)',
      cadCanvas: 'hsl(230, 28%, 5%)',
      cadGrid: 'hsl(230, 20%, 12%)',
      cadDivider: 'hsl(230, 18%, 25%)',
      cadHeader: 'hsl(230, 25%, 8%)',
      cadHeaderForeground: 'hsl(220, 20%, 95%)',

      // Secondary/muted
      secondary: 'hsl(230, 20%, 16%)',
      secondaryForeground: 'hsl(220, 20%, 90%)',
      muted: 'hsl(230, 18%, 14%)',
      mutedForeground: 'hsl(220, 15%, 55%)',

      // Borders and inputs
      border: 'hsl(230, 18%, 22%)',
      input: 'hsl(230, 18%, 18%)',

      // Status colors
      success: 'hsl(150, 80%, 45%)',
      warning: 'hsl(40, 95%, 55%)',
      info: 'hsl(200, 100%, 55%)',
      error: 'hsl(0, 85%, 60%)',

      // Gradients
      gradientStart: 'hsl(200, 100%, 55%)',
      gradientMid: 'hsl(260, 80%, 55%)',
      gradientEnd: 'hsl(320, 80%, 55%)',
    },

    // Gradient utilities
    gradients: {
      border: 'linear-gradient(90deg, hsl(200, 100%, 55%) 0%, hsl(260, 80%, 55%) 50%, hsl(320, 80%, 55%) 100%)',
      text: 'linear-gradient(135deg, hsl(200, 100%, 55%) 0%, hsl(260, 80%, 55%) 50%, hsl(320, 80%, 55%) 100%)',
      background: 'linear-gradient(135deg, hsl(200, 100%, 55%) 0%, hsl(260, 80%, 55%) 50%, hsl(320, 80%, 55%) 100%)',
    },
  },
});
