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
  },
} as const

export const modelColors = {
  chronos: colors.accent.blue,
  ets: colors.accent.orange,
  theta: colors.accent.yellow,
  seasonalNaive: colors.accent.red,
} as const

export const modelColorMap: Record<string, string> = {
  'Chronos-Bolt': colors.accent.blue,
  AutoETS: colors.accent.orange,
  AutoTheta: colors.accent.yellow,
  SeasonalNaive: colors.accent.red,
}
