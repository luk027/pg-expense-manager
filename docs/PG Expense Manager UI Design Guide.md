# PG Expense Manager: UI Design Guide

A modern, professional UI direction for iOS and Android, with design tokens, best practices and screen layouts.

## 1. Design direction: calm fintech

The earlier neo-brutalist direction is replaced by a clean, calm, fintech-style system. Hard offset shadows do not render on Android, and heavy borders feel playful rather than trustworthy on a screen full of rupee amounts. The brand blue and lime are kept, but used sparingly.

Principles:

1. **One look on both platforms.** Use custom components for cards, buttons and inputs. Respect platform behaviour only where users feel it: back gestures, haptics, keyboard types, date pickers, safe areas and the status bar.
2. **Numbers are the hero.** Big, tabular, high-contrast amounts. Everything else stays quiet.
3. **Colour means something.** Blue for actions, green for settled and received, red for owed, amber for awaiting confirmation. Nothing decorative.
4. **Soft elevation, not borders.** Use 1px hairline borders plus very soft shadows.
5. **Fewer, larger tap targets.** Minimum 48dp, 16px screen padding and an 8-point spacing grid.

## 2. Design tokens

Keep one `tokens.ts` as the single source of truth. Feed it into `tailwind.config.js` (if using NativeWind) and into any StyleSheet code, so the two never drift.

```ts
// tokens.ts
export const colors = {
  bg: '#F7F8FA',            // app canvas
  surface: '#FFFFFF',       // cards, sheets
  surfaceMuted: '#F1F3F6',
  border: '#E4E7EC',

  ink: '#101828',           // primary text
  inkSecondary: '#475467',  // secondary text (AA)
  inkTertiary: '#667085',   // lightest allowed for real text

  primary: '#2F54EB',       // buttons, links, active tab
  primaryPressed: '#2442C4',
  primarySoft: '#EEF2FF',

  success: '#067647', successSoft: '#E7F6EC',  // settled / received
  danger:  '#B42318', dangerSoft:  '#FDECEA',  // you owe
  warning: '#B54708', warningSoft: '#FFF4E0',  // awaiting confirmation
  accent:  '#D5F36B',       // brand highlight only, always with dark text
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

export const type = {
  display: { size: 32, line: 40, weight: '700' }, // balance hero
  title:   { size: 20, line: 28, weight: '600' },
  body:    { size: 16, line: 24, weight: '400' },
  label:   { size: 14, line: 20, weight: '500' },
  caption: { size: 12, line: 16, weight: '500' },
};
```

Changes from the earlier spec:

- Text colours on tinted backgrounds are darker so they pass contrast.
- Lime is no longer used as a large surface.
- The type, spacing and radius scales are smaller and consistent.
- One value per token: no conflicting hex codes, border widths or radii.

## 3. Cross-platform best practices

- **Safe areas:** use `react-native-safe-area-context` on every screen, including bottom insets for the tab bar. Notches and gesture bars are where cross-platform UIs break.
- **Shadows:** use `shadowColor`, `shadowOffset`, `shadowOpacity` and `shadowRadius` on iOS and a low `elevation` (1 to 3) on Android, wrapped in one `Card` component. Do not scatter shadow styles around the code.
- **Fonts:** load Inter or Plus Jakarta Sans with `expo-font`, and define each weight as its own font family name. Use `fontVariant: ['tabular-nums']` on every amount.
- **Touch feedback:** use `Pressable` with a pressed style on every touchable, and `expo-haptics` for key actions (mark water delivered, mark payment sent, confirm).
- **Bottom sheets:** use a gesture-friendly sheet (`@gorhom/bottom-sheet`) for add-expense and payment flows where possible.
- **Device testing:** test on a small Android (360dp wide), a large iPhone, and with the largest system font size. Layouts must wrap, not clip.

## 4. Money-specific UX

- Show amounts in Indian grouping, such as ₹1,24,800, using `Intl.NumberFormat('en-IN')`. Store integer paise, and show decimals only when non-zero.
- Say it in words: "You owe ₹X" or "You get ₹X", not just signs and colours.
- Make confirmations explicit: full-amount payment, collector confirmation, and reversal with a reason.
- Status pills use an icon plus text, never colour alone.
- Each screen has one obvious primary action.

## 5. Accessibility and states

- Text contrast of at least 4.5:1. Add `accessibilityLabel` to icon buttons. Support dynamic type.
- Design loading skeletons, empty states ("No expenses this month. Add the first one."), offline and error states, and pull-to-refresh. These make an app feel professional more than visual style does.
- Use optimistic updates for water taps with an undo, backed by server-side idempotency.

## 6. Motion

Keep motion subtle: 150 to 250ms, using `react-native-reanimated` for list changes, sheets and number transitions. Respect the system "reduce motion" setting.

## 7. Screen layouts

### Home

- Greeting row with the room name.
- Hero card: "You owe ₹X" (or "You get ₹X"), settlement due date, and one Pay button.
- Two-up cards: this month's room expenses and rent status.
- Roommate payment status list with small avatars and status pills.
- Quick actions as a 2x2 grid: Add expense, Water delivery, Payments, Report.

### Calendar

- Month grid with small category-coloured dots.
- Horizontal filter chip row (All, Water, Groceries, Electricity and so on).
- The selected date's expenses listed below. Water shows, for example, "2 deliveries, ₹80".

### Expenses

- List grouped by date, with a floating add button and a sticky month switcher.

### Settlement

- Statement-style card: rent, previous-month expenses, carried forward, your share, paid, remaining.
- Progress bar for collected vs. pending.
- Payment history below.

### Room

- List rows with section headers: roommates, rent and services, categories, notifications, activity history.

### Bottom tabs

Home, Calendar, Expenses, Settlement and Room, with labels always shown and an active pill indicator.

## 8. Component set to build first

| Component | Purpose |
| --- | --- |
| `Card` | Single place for surface, border and platform shadow |
| `Button` | Primary, secondary, destructive, disabled and loading states |
| `Badge` | Status pills with icon plus text (settled, owes, awaiting, collector) |
| `Amount` | Tabular, Indian-grouped currency with colour by meaning |

## 9. Recommended libraries

- Styling: NativeWind v4 (using the tokens above) or plain StyleSheet fed by `tokens.ts`.
- Motion and gestures: `react-native-reanimated`, `react-native-gesture-handler`.
- Sheets: `@gorhom/bottom-sheet`.
- Feedback: `expo-haptics`.
- Icons: `lucide-react-native`.
- Lists: `@shopify/flash-list`.
- Calendar: `react-native-calendars` or a custom grid.
- Navigation: `expo-router`.

## 10. Next steps

1. Mock up Home, Add Expense and Settlement to confirm the direction.
2. Write `tokens.ts` and the four base components.
3. Build screens on top of them, with loading, empty and error states from the start.
