export const colors = {
  bg: '#F7F8FA',            // app canvas
  surface: '#FFFFFF',       // cards, sheets
  surfaceMuted: '#F1F3F6',
  border: '#E4E7EC',

  ink: '#101828',           // primary text
  inkSecondary: '#475467',  // secondary text
  inkTertiary: '#667085',   // lightest allowed for text

  primary: '#2F54EB',       // buttons, links, active tab
  primaryPressed: '#2442C4',
  primarySoft: '#EEF2FF',

  success: '#067647',
  successSoft: '#E7F6EC',  // settled / received
  danger:  '#B42318',
  dangerSoft:  '#FDECEA',  // you owe
  warning: '#B54708',
  warningSoft: '#FFF4E0',  // awaiting confirmation
  accent:  '#D5F36B',       // brand highlight only
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const type = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const },
  title:   { fontSize: 20, lineHeight: 28, fontWeight: '600' as const },
  body:    { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  label:   { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
};
