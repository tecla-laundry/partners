/**
 * Theme configuration for the Laundry Partner Dashboard.
 * Single source for colors, radius, and shadows — used by Tailwind and components.
 * Aesthetic: Laundry Fresh & Professional (sage, navy, warm neutrals, sky accents).
 */
export const themeConfig = {
  colors: {
    sage: {
      DEFAULT: '#10B981',
      50: '#ECFDF5',
      100: '#D1FAE5',
      200: '#A7F3D0',
      300: '#6EE7B7',
      400: '#34D399',
      500: '#10B981',
      600: '#059669',
      700: '#047857',
      800: '#065F46',
      900: '#064E3B',
    },
    navy: {
      DEFAULT: '#0F172A',
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
    },
    sky: '#64748B',
  },
  radius: {
    card: '0.75rem',   // 12px — rounded-xl
    panel: '1rem',     // 16px — generous rounded
    button: '0.5rem',
  },
  shadow: {
    card: '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
    cardHover: '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
  },
} as const
