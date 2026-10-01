export const colors = {
  bgTop: "#1B1640",
  bgBottom: "#08071A",
  surface: "rgba(255,255,255,0.06)",
  surfaceStrong: "rgba(255,255,255,0.10)",
  border: "rgba(255,255,255,0.12)",
  text: "#F4F2FF",
  textSoft: "#B9B4D9",
  textMuted: "#7F7AA6",
  accent: "#A78BFA",
  accentDeep: "#7C3AED",
  glow: "#C4B5FD",
  teal: "#5EEAD4",
  tealDeep: "#14B8A6",
  success: "#4ADE80",
  danger: "#F87171",
  warning: "#FBBF24",
} as const;

export const radius = { sm: 12, md: 18, lg: 24, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const type = {
  hero: { fontSize: 34, fontWeight: "600" as const, color: colors.text, letterSpacing: 0.2 },
  title: { fontSize: 24, fontWeight: "600" as const, color: colors.text },
  heading: { fontSize: 18, fontWeight: "600" as const, color: colors.text },
  body: { fontSize: 15, color: colors.textSoft, lineHeight: 22 },
  small: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  label: { fontSize: 12, color: colors.textMuted, letterSpacing: 0.8, textTransform: "uppercase" as const },
} as const;
