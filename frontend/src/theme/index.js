// Central design tokens for the whole app.
// Change colors here and every screen follows.

export const colors = {
  primary: '#1E6B47', // rice-field green
  primaryDark: '#154D33',
  primaryLight: '#E3F1E9',
  accent: '#D99A1E', // golden grain
  accentLight: '#FBF1DC',

  bg: '#F6F4EE',
  card: '#FFFFFF',
  text: '#1D2621',
  textSecondary: '#4F5852',
  textMuted: '#7A817C',
  border: '#E4E1D8',
  divider: '#EFEDE6',

  success: '#1F7A45',
  successLight: '#E3F3E8',
  warning: '#9A6200',
  warningLight: '#FCF0D6',
  danger: '#C2392F',
  dangerLight: '#FBE8E6',
  info: '#215F9E',
  infoLight: '#E5EFFA',

  white: '#FFFFFF',

  // Chart colors (validated for color-blind safety)
  chartRetail: '#1E7A4C',
  chartWholesale: '#2A78D6',
  chartTrack: '#EFEDE6',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

export const font = {
  h1: { fontSize: 26, fontWeight: '800', color: colors.text },
  h2: { fontSize: 20, fontWeight: '800', color: colors.text },
  h3: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.text },
  small: { fontSize: 12, color: colors.textMuted },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
};

// Shared look for stack headers and bottom tabs.
export const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerShadowVisible: false,
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' },
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: colors.bg },
};

export const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
  tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.white, fontSize: 10, fontWeight: '700' },
};

export const shadow = {
  shadowColor: '#1D2621',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};
