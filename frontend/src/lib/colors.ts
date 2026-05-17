export const colors = {
  canvas: '#FFFFFF',
  surface: '#F5F5F7',
  primary: '#111111',
  secondary: '#6E6E73',
  accent: {
    blue: '#0066FF',
    orange: '#FF6B00',
    yellow: '#FFC700',
    red: '#FF2A3A',
    teal: '#14B8A6',
  },
} as const

export const modelColors = {
  chronos: colors.accent.blue,
  timesfm: colors.accent.teal,
  ets: colors.accent.orange,
  theta: colors.accent.yellow,
  seasonalNaive: colors.accent.red,
} as const

export const modelColorMap: Record<string, string> = {
  'Chronos-2': colors.accent.blue,
  TimesFM: colors.accent.teal,
  AutoETS: colors.accent.orange,
  AutoTheta: colors.accent.yellow,
  SeasonalNaive: colors.accent.red,
}
