// ========== COLORS ==========
export const colors = {
  // Surfaces (Spotify-style dark layers)
  bg: '#121212',           // Main background
  surface: '#181818',      // Cards, panels
  surfaceLight: '#282828', // Elevated elements, hover states
  surfaceHover: '#333333', // Hover on interactive elements

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#6A6A6A',
  textDisabled: '#404040',

  // Accent (Spotify Green - functional only)
  accent: '#1DB954',
  accentHover: '#1ED760',
  accentMuted: 'rgba(29,185,84,0.1)',
  accentBorder: 'rgba(29,185,84,0.3)',

  // Semantic
  error: '#F3727F',
  errorBg: 'rgba(243,114,127,0.1)',
  errorBorder: 'rgba(243,114,127,0.2)',
  warning: '#FFA42B',
  warningBg: 'rgba(255,164,43,0.1)',
  warningBorder: 'rgba(255,164,43,0.2)',
  info: '#539DF5',
  infoBg: 'rgba(83,157,245,0.1)',
  infoBorder: 'rgba(83,157,245,0.2)',

  // Borders
  border: 'rgba(255,255,255,0.1)',
  borderLight: 'rgba(255,255,255,0.06)',
  borderFocus: 'rgba(255,255,255,0.3)',

  // Stage colors
  stage1: '#A855F7',       // Purple for Stage 1
  stage1Bg: 'rgba(168,85,247,0.1)',
  stage1Border: 'rgba(168,85,247,0.3)',
  stage2: '#539DF5',       // Blue for Stage 2
  stage2Bg: 'rgba(83,157,245,0.1)',
  stage2Border: 'rgba(83,157,245,0.3)',
}

// ========== TYPOGRAPHY ==========
export const typography = {
  fontFamily: "'Noto Serif KR', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
  monoFamily: "'SF Mono', 'Fira Code', 'Fira Mono', monospace",

  // Sizes
  xs: '10px',    // Micro labels
  sm: '12px',    // Secondary text
  base: '14px',  // Body text
  md: '16px',    // Buttons, inputs
  lg: '20px',    // Headings
  xl: '24px',    // Page titles
  timer: '72px', // Timer display

  // Weights
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,

  // Letter spacing
  tight: '-0.02em',
  normal_spacing: '0',
  wide: '0.05em',
  wider: '0.1em',
  label: '0.15em',  // Uppercase labels
}

// ========== SPACING ==========
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
}

// ========== RADIUS ==========
export const radius = {
  sm: 6,     // Small elements, badges
  md: 8,     // Cards, buttons
  lg: 12,    // Panels, modals
  xl: 16,    // Large panels
  pill: 500, // Pill buttons (Spotify style)
  full: '50%', // Circular
}

// ========== SHADOWS ==========
export const shadows = {
  sm: '0 2px 8px rgba(0,0,0,0.3)',
  md: '0 4px 16px rgba(0,0,0,0.4)',
  lg: '0 8px 32px rgba(0,0,0,0.5)',
  accent: '0 4px 16px rgba(29,185,84,0.3)',
  error: '0 4px 16px rgba(243,114,127,0.3)',
}

// ========== TRANSITIONS ==========
export const transitions = {
  fast: 'all 0.15s ease',
  normal: 'all 0.2s ease',
  slow: 'all 0.3s ease',
}
