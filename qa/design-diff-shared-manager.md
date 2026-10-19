# Design-to-code diff A: foundations, shared (S-_) and manager (M-_) boards

Design: claude.ai Design canvas VUmQPdfi3GXbqPGm7QYSc2 (boards saved under `scratchpad/design/project/`).
Code: `C:\FieldMate\apps\mobile` (paths below are relative to it). This was a static read; nothing was run.

Notes on the method:

- `docs/04-ui-ux.md` is still the **pre-"Ink & Signal" draft** (blue `#2563EB` primary, system font, radius 8/12/16, 52dp buttons, "dark mode / custom fonts out of scope"). It does not describe the current design system. I marked something **ambiguous** only where docs/04 or an explicit code comment deliberately specifies the code's behaviour. Everything else that differs from the board is marked **likely-defect**.
- I compared sizes in px == dp. Status-bar chrome, sample names, dates and counts were ignored.
- Severity: **high** = visibly wrong structure, variant, copy or a whole-app token; **med** = a noticeable size, colour or type difference on one screen or component; **low** = a few px or a subtle tint.

---

## Foundations (Main.dc.html, DS-Components.dc.html → src/constants/theme.ts, src/constants/fonts.ts, shared components)

### Colour

- [med] [likely-defect] Ink 3 (tertiary text) — design: `#6B7079` (4.9:1) / code: `textTertiary: '#686D76'` — theme.ts:48. (`toneColors.neutral.dot` is already `#6B7079`, theme.ts:90.)
- [med] [likely-defect] In-progress status text — design: `#9A4A00` (Main status row + M-Dashboard/M-Tasks) / code: `IN_PROGRESS.text: '#944700'` and `warningText: '#944700'` — theme.ts:142, theme.ts:72.
- [med] [likely-defect] Strong input/control border — design: `#CFCBC1` (every input 1.5px border, sheet handle, pending stepper node, swatch outline) / code: has no such token. Inputs use `border #DEDBD3` (Input.tsx:163), the handle uses `border` (BottomSheet.tsx:95), and the stepper uses `borderStrong #B9B5AB` (WorkerJourney.tsx:127). `borderStrong` itself is a value the design never uses — theme.ts:55.
- [med] [likely-defect] On-ink text — design: `#F3F2EE` (splash, login hero, profile card, dark preview) / code: `textOnInverse: '#FFFFFF'` — theme.ts:50.
- [med] [likely-defect] Muted text on ink (inactive tab labels, splash tagline) — design: `#C9CCD1` / code: `textOnInverseMuted: '#A9ADB4'`, and the tab bar does not use it at all (it uses `textOnInverse` #FFFFFF) — theme.ts:51, TabBar.tsx:75, TabBar.tsx:137.
- [low] [likely-defect] Raised ink surface (role badge on profile) — design: `#2A2D33` / code: `surfaceInverseRaised: '#1E2126'` — theme.ts:43.
- [low] [likely-defect] Body/description ink — design: `#2B2F36` for description paragraphs, note text and info-box text / code: no token, so it renders as `textPrimary #0F1115` — TaskDetailView.tsx:418.
- [med] [likely-defect] Offline banner — design: bg `#3D2E00`, text `#FFE7A3` / code: `offline: '#3B2E06'`, `onOffline: '#FFD873'` — theme.ts:66-67.
- [low] [likely-defect] Toast emblems — design: success `#2E9E5B`, error `#E5484D` / code: `toneColors.success.dot #1F8A4C`, `error.dot #C8291C` — theme.ts:88-89 (used by Toast.tsx:61).
- [low] [likely-defect] The darker notice text colours have no tokens. Warning notice text is `#6B3400`, error alert text `#7A1810`, info notice text `#0A3D73`, and the emphasised stat number `#4A1F8C`. Code reuses `warningText #944700`, `errorText #B42318` and `infoText #0B5CAD` instead — theme.ts:70-79.
- [low] [ambiguous] Radio ring — design: unselected `2px #9A9EA5`, filled ink with a white check when selected / code: ring `textTertiary`, ink dot inside a ring. The `#9A9EA5` value only exists as the Cancelled outline — theme.ts:172, WorkerPicker.tsx:193-203, ChoiceList.tsx:98-108.
- [med] [ambiguous] Dark mode — design: a full dark palette (`#0C0D10 / #17191D / #2A2D33 / #F3F2EE / #FFC933`, plus dark status tints such as Accepted `#22284A/#A9B4FF`) / code: no dark theme at all. docs/04 §1 says "Out of scope: dark mode", but that doc predates this design — theme.ts (whole file).

### Type

- [high] [ambiguous] Weights above 600/700 — design uses 650 (every button label, card titles, row titles), 750 (worker signal button) and 800 (wordmark, avatar initials, count pill) / code: semibold 600 and bold 700 only, and `extrabold` resolves to 700. The code comment says this is deliberate ("scale tops out at 700"), but Geist 800 is published and the design loads it — theme.ts:177-189, fonts.ts:1-19.
- [med] [likely-defect] Display — design: 34/40, 700, letter-spacing **-0.8** / code: `hero` letterSpacing **-1** — theme.ts:193.
- [low] [likely-defect] Title 1 — design: letter-spacing **-0.6** / code: **-0.7** (`display`, `screenTitle`) — theme.ts:195-196. (The screen boards themselves use -0.7, so treat this as a choice between the two sources.)
- [low] [likely-defect] Title 2 — design: 22/28, 600, letter-spacing **-0.3** / code: **-0.4** — theme.ts:198-203.
- [low] [likely-defect] Headline — design: 18/24, 600, **no** letter-spacing / code: `cardTitle` letterSpacing **-0.2** — theme.ts:205.
- [low] [likely-defect] Mono — design: 13/18, 500, letter-spacing **0.4** / code: none — theme.ts:222.
- [med] [likely-defect] There is no token for the page-title size every tab and inbox board uses: **32/38, 700, -0.8** (Tasks, Notifications, Profile). Code uses `hero` 34/40/-1 for all of them — AppHeader.tsx:122, NotificationInbox.tsx:263.
- [med] [likely-defect] Section headers on screens — design: **20/700/-0.3** (dashboard) and **17/700** (detail sections) / code: `sectionTitle` 22/28 semibold (States.tsx:275) and `cardTitle` at 20 semibold (TaskDetailView.tsx:416).
- [low] [likely-defect] Button label — design: 17 (lg) / 16 (md), weight **650**, no letter-spacing / code: `button` 17/22 semibold **600** with letterSpacing **-0.2** — theme.ts:223-224.

### Spacing

- [low] [likely-defect] Button icon-to-label gap — design: **10** (lg, DS buttons) / code: `spacing.sm` **8** — Button.tsx:147.
- [low] [likely-defect] Tab bar inset — design: left/right **16**, bottom **28** / code: `tabBarInset = mdPlus` **20**, bottom `max(inset, 20)` — theme.ts:267, TabBar.tsx:39.
- Everything else matches: the 4/8/12/16/20/24/32/40/48 scale, gutter 20, section gap 28, touch target 48.

### Radii

- The token set matches (8 badge, 12 input, 14 button, 20 card, 28 sheet, pill).
- [med] [likely-defect] Radii the design uses that have no token, so the code substitutes a neighbour:
  - **24**: dialogs, tab bar, profile identity card, notification-permission card. Code uses 28, `radius.sheet` — ConfirmationDialog.tsx:119, TabBar.tsx:118, ProfileScreen.tsx:159.
  - **18**: tab item, stat tile, overflow menu. Code uses 20, `radius.card` — TabBar.tsx:128, StatCard.tsx:103, OverflowMenu.tsx:103.
  - **16**: toast, offline banner (12), compact list cards. Code uses 14 — Toast.tsx:118.
  - **36**: empty-state emblem. Code uses 28 — States.tsx:242.

### Elevation

- [med] [likely-defect] E1 card — design: `0 1px 2px rgba(15,17,21,.06), 0 2px 8px rgba(15,17,21,.06)` (tight, two-layer) / code: `0 4 16 @ .05` — theme.ts:286-292.
- [med] [likely-defect] E2 float — design: `0 6 20 @ .12` (tab-bar boards use `0 8 24 @ .25`) / code: `0 10 28 @ .14` — theme.ts:293-299.
- [low] [likely-defect] E3 modal — design: `0 16 48 @ .22` (the dialog boards use `.30`) / code: `0 20 48 @ .22` — theme.ts:300-306.
- [med] [likely-defect] E0 surfaces carry shadows in code. The design draws these as flat with a 1px `#DEDBD3` line: the stepper card, location card, note cards, the "Earlier" notification group, recently-completed items and stat tiles. Code puts `elevation.card` on every `Card` — Card.tsx:65, NotificationInbox.tsx:297-302, StatCard.tsx:107.

### Shared components (DS-Components)

- [high] [likely-defect] **Status badge size.** The design has three sizes: list 28h, 13/600, padding `0 10 0 8`, icon 16; detail 30h, 14/650, padding `0 12 0 10`; reference 32h, 14/600. Code has one: padding 8 on both sides plus 4 vertical (about 26h), caption 13, icon **14** — Badge.tsx:75-86.
- [med] [likely-defect] Disabled button label — design: `#6B7079` on `#DEDBD3` (the Request-changes board uses `#5B5F66`) / code: `textDisabled #8D9199`, which also has lower contrast — Button.tsx:149, theme.ts:49.
- [med] [likely-defect] Input height — design: **52** (DS inputs and every form board; login fields are 56) / code: `inputHeight: 56` everywhere — theme.ts:254, Input.tsx:161.
- [low] [likely-defect] Input focus ring — design: `0 0 0 4px rgba(255,194,26,.45)` / code: `RING_WIDTH = 3` — Input.tsx:146.
- [low] [likely-defect] Input error text — design: 14 / **500** / code: `secondary` 14 / 400 — Input.tsx:183.
- [low] [likely-defect] Input leading-icon gap — design: **10** / code: `marginRight: spacing.smPlus` **12** — Input.tsx:171.
- [med] [likely-defect] Bottom sheet:
  - handle: design **40**×5 `#CFCBC1`, margin-top 10 / code: **44**×5 `#DEDBD3`, margin-top 12 — BottomSheet.tsx:91-98.
  - close button: design **44** with an 18 icon / code: **48** with a 20 icon — BottomSheet.tsx:113-120, BottomSheet.tsx:70.
- [med] [likely-defect] Dialog (as used by every confirm board):
  - radius: design **24** / code **28** — ConfirmationDialog.tsx:119.
  - side inset: design **20** / code **24** — ConfirmationDialog.tsx:113.
  - emblem: design **48** / code **52** — ConfirmationDialog.tsx:125.
  - buttons: design **52** tall, gap 10 / code `Button lg` **56**, gap 12 — ConfirmationDialog.tsx:138.
  - The DS sheet shows two 48px side-by-side buttons, but every screen board stacks them, and the code follows the boards.
- [med] [likely-defect] Floating tab bar:
  - bar radius: design **24** / code **28**.
  - tab radius: design **18** / code **20**.
  - inactive label: design `#C9CCD1`, 12/600 / code `#FFFFFF`, 13 semibold.
  - active label: design 12/**700** / code 13 semibold (600).
  - shadow: design `0 8 24 @ .25` / code `elevation.floating`.
  - Code: TabBar.tsx:118, TabBar.tsx:122, TabBar.tsx:128, TabBar.tsx:134-139.
- [low] [ambiguous] Tab icons — design: outline stroke icons in both states / code: switches to the filled `activeIcon` when selected — (manager)/(tabs)/_layout.tsx:7-9, TabBar.tsx:73.
- [med] [likely-defect] Chips — design: unselected chips carry a 16px status-coloured icon (M-Tasks) / code: no icon. The code comment says "the chip itself no longer draws a status dot", and M-Tasks-Empty also draws them without icons, so this is **ambiguous** — FilterChips.tsx:18, FilterChips.tsx:59-75.
- [med] [likely-defect] Error state — design: a centred card with a 48 tinted emblem (`#FDE4E1`), title 15/650 "Couldn’t load", and a compact 44h outline "Try again" (radius 12, 14/650) / code: a left-aligned row with an icon, a red 14-semibold message and a full-width secondary md button — States.tsx:136-162, States.tsx:257-266.
- [low] [likely-defect] Skeleton bars — design: radius **6** (8 for the pill), heights 14/10/10/24 / code: radius 12 (`control`), heights 26/16/12 — States.tsx:217, States.tsx:225-227.
- [med] [likely-defect] Toast:
  - radius: design **16** / code **14**.
  - message: design **15/600** / code `bodyStrong` 16/24.
  - shadow: design `0 6 20 @ .18` (the Global board uses `0 10 30 @ .28`) / code `elevation.overlay`.
  - Code: Toast.tsx:118, Toast.tsx:120, Toast.tsx:129.
- [low] [likely-defect] Notification bell (DS + M-Dashboard):
  - size: design 48 / code **56**.
  - badge: design min 20, 12/700, offset top -2 right -4, ring `#F4F3EF` (page colour) / code: min **24**, 13 semibold, offset -4/-4, ring `surface #FFFFFF`.
  - icon: design 22 / code 24.
  - Code: NotificationBell.tsx:56-57, NotificationBell.tsx:65-86, NotificationBell.tsx:38.

---

## S-Splash → app/index.tsx + src/features/auth/SessionGate.tsx → src/components/SplashView.tsx

- [med] [likely-defect] Wordmark — design: **40/44, 800**, letter-spacing -1.2, `#F3F2EE` / code: **44/50**, 700, -1.4, `colors.background` — SplashView.tsx:118-124.
- [low] [likely-defect] Tagline — design: **16**, `#C9CCD1` / code: **17**, `textOnInverseMuted #A9ADB4` — SplashView.tsx:125-130.
- [low] [likely-defect] Rings — design: **5** rings (diameters 220–700), 1px `#FFC21A` at 12% opacity / code: **6** rings (adds 820) at `rgba(255,194,26,.14)` — SplashView.tsx:11, SplashView.tsx:116.
- [low] [likely-defect] Tile:
  - corner radius: design **32** / code `round(104*.28)=29`.
  - halo: design a 10px spread at **.14** / code padding 10 at **.18**.
  - glyph: design **56** / code 52.
  - Code: BrandMark.tsx:24, BrandMark.tsx:32, BrandMark.tsx:56.
- [low] [likely-defect] Loading dots — design: **8**px, gap **8**, 72 from the bottom / code: **9**px, gap **12**, paddingBottom 80 plus inset — SplashView.tsx:134-137.
- [low] [likely-defect] Tile-to-text gap — design: **22** / code: `marginBottom: spacing.lg` **24** — SplashView.tsx:109.

## S-Login → app/(auth)/login.tsx

- [med] [likely-defect] Hero headline — design: **36/40**, 700, -1, `#F3F2EE` / code: **40/46** (hero override), `#FFFFFF` — login.tsx:285.
- [med] [likely-defect] "FieldMate" eyebrow — design: **15**/700, letter-spacing **1.4** / code: `label` override **16/20**, semibold 600, letter-spacing 0.8 — login.tsx:284.
- [med] [likely-defect] Hero spacing:
  - gap: design **28** (tile → text block), with 10 between eyebrow and headline / code: one `gap: spacing.md` (16) for all.
  - side padding: design 24 / code `screenPadding+8` = **28**.
  - Code: login.tsx:275-280.
- [low] [likely-defect] Logo tile — design: **64**, radius 20, glyph 34 / code: `BrandMark size 72` — login.tsx:97.
- [low] [likely-defect] Decorative contour lines (4 yellow curves at 18% opacity behind the hero) are missing — login.tsx:95-122.
- [med] [likely-defect] Form sheet padding — design: `28 24 0` / code: paddingTop **32**, sides **28** — login.tsx:292-293.
- [med] [likely-defect] Login inputs — design: input text **17**, border `#CFCBC1`, padding 0 14 / code: `body` **16**, border `#DEDBD3`, padding 16 (shared Input) — Input.tsx:166, Input.tsx:174.
- [low] [likely-defect] Hint row gap — design: **10** / code: **8** — login.tsx:318.
- [low] [likely-defect] Sign-in button icon gap — design: 10 / code: 8 (Button) — Button.tsx:147.

## S-Login-Error → app/(auth)/login.tsx (formError state)

- [high] [likely-defect] Error title copy — design: "Email or password is incorrect" / code: shows the API message "Incorrect email or password." — login.tsx:246 (from apps/api/src/modules/auth/auth.service.ts:9).
- [high] [likely-defect] The password field is not marked invalid on wrong credentials. Design: 2px `#B42318` border plus a red lock icon / code: `error` is only passed for zod field errors, so the field stays neutral — login.tsx:195.
- [med] [likely-defect] Alert box:
  - text: design `#7A1810` / code `#B42318` (toneColors.error.text).
  - border: design **1.5px** / code **1px**.
  - padding: design `12 14` / code **16**.
  - icon: design 20 / code **22**.
  - title: design 15/700 / code bodyStrong 16/600.
  - Code: login.tsx:136, login.tsx:140, login.tsx:308-316.
- [med] [likely-defect] Compact brand row — design: **48** tile (radius 16) with gap **14**, hero padding `72 24 28` / code: **56** tile, gap 16, plus a `marginBottom: -24` hack — login.tsx:97, login.tsx:281-282.
- [low] [likely-defect] Form gap in the error state — design: **18** / code: 20 — login.tsx:301.
- [low] [likely-defect] Secondary error copy — design: "Enter an email like name@company.com" / "No connection. Try again when you’re online." / code: "Enter a valid email address." (packages/shared/src/schemas.ts:25) and "Couldn't connect. Check your connection and try again." (src/services/http.ts:20).

## S-SessionExpired → app/(auth)/login.tsx (sessionExpired notice)

- [low] [likely-defect] Notice text — design: `#0A3D73` / code: `infoText #0B5CAD`. Code also adds a 1px tint-coloured border the design doesn't have — login.tsx:136-150, login.tsx:268.
- [low] [likely-defect] Sign-in button — design: no trailing arrow in this state / code: shows `arrow-forward` whenever `formError` is null — login.tsx:228.
- [low] [likely-defect] The same compact-hero and notice padding differences as S-Login-Error.

## S-NotifPermission → src/features/notifications/NotificationPrompt.tsx (on the manager dashboard and the profile)

- [med] [likely-defect] Card outline — design: **2px** ink border, radius **24**, padding **18**, gap **14** / code: 1.5px, radius 20, padding 16, gap 16 — NotificationPrompt.tsx:83-90.
- [med] [likely-defect] "Not now" variant — design: transparent text button (no fill, no underline), 16/650 / code: `variant="tonal"` (grey fill) — NotificationPrompt.tsx:58.
- [low] [likely-defect] Button proportions — design: grid `1fr 1.4fr`, gap 10 / code: flex `1 : 1.6`, gap 12 — NotificationPrompt.tsx:103-105.
- [low] [likely-defect] Emblem — design: **48**, radius 14, icon stroke 2.2 / code: **52** — NotificationPrompt.tsx:93-94.
- [low] [likely-defect] Title — design: 18/24/**700** / code: `cardTitle` semibold 600, -0.2. Text gap: design 4 / code 2. Icon-to-text gap: design 14 / code 12 — NotificationPrompt.tsx:91, NotificationPrompt.tsx:100-101.

## S-Notifications → app/(manager)/notifications.tsx → src/features/notifications/NotificationInbox.tsx

- [med] [likely-defect] Page title — design: **32/38**, -0.8 / code: `hero` 34/40, -1 — NotificationInbox.tsx:263.
- [low] [likely-defect] "3 new" — design: **15/600** / code: `bodyStrong` 16 — NotificationInbox.tsx:264.
- [low] [likely-defect] "Mark all read" — design: **15/650**, underline offset 4, padding 0 12 / code: `bodyStrong` 16, padding 4 — NotificationInbox.tsx:270-274.
- [med] [likely-defect] Group gutter — design: the card groups sit at **12** from the screen edge (title and labels at 20) / code: everything at 20 — NotificationInbox.tsx:256.
- [med] [likely-defect] Rows:
  - icon-to-text gap: design **14** / code 12.
  - emblem: design **44** (radius 14) / code **48**.
  - unread title: design **16/21, 700** / code 17/24 semibold.
  - body: design **14/20** / code 15/21.
  - Code: NotificationInbox.tsx:284, NotificationInbox.tsx:305-306, NotificationInbox.tsx:314-315, NotificationInbox.tsx:319-325.
- [low] [likely-defect] Read rows — design: title **16/500**, `#2B2F36`, row divider `#E6E3DC` / code: 17/400 `textPrimary`, divider `#DEDBD3` — NotificationInbox.tsx:303, NotificationInbox.tsx:314.
- [low] [likely-defect] Unread-group divider — design: `#ECEAE4` / code: `colors.border #DEDBD3` — NotificationInbox.tsx:303.
- [low] [likely-defect] "Earlier" group — design: flat, 1px `#DEDBD3` border, transparent / code: also gets `elevation.card` on its last row — NotificationInbox.tsx:297-302.
- [low] [likely-defect] Section labels — design: **700** weight; "New" has padding-top 8, "Earlier" 16 / code: `label` semibold, paddingTop 20 for both — NotificationInbox.tsx:275-280.

## S-Notifications-Empty → src/features/notifications/NotificationInbox.tsx (ListEmptyComponent)

- [high] [likely-defect] Title copy — design: "**No notifications yet**" / code: "**Nothing yet**" — NotificationInbox.tsx:140.
- [med] [likely-defect] Empty emblem and type:
  - emblem: design **120**, radius 36, icon 56 at stroke 1.6 / code: 112, radius 28, icon 44.
  - title: design **24/30**, 700, -0.4 / code: 22/28.
  - spacing: design gap 16, side padding 40 / code: gap 12, side padding 24.
  - Code: States.tsx:112, States.tsx:232-255.
- [low] [likely-defect] Vertical position — design: centred in the free space (with 120 bottom padding) / code: the empty component has no `flex:1`, so it sits under the heading — States.tsx:232.

## S-Profile → app/(manager)/(tabs)/profile.tsx → src/features/auth/ProfileScreen.tsx

- [med] [likely-defect] Page title — design: **32/38**, -0.8 / code: `hero` 34/40 (AppHeader large) — AppHeader.tsx:122.
- [med] [likely-defect] Identity card — design: radius **24**, **no shadow** / code: radius 28, `elevation.floating` — ProfileScreen.tsx:159, ProfileScreen.tsx:161.
- [med] [likely-defect] Name — design: **24**/700, -0.4, `#F3F2EE` / code: 22/28 bold, `#FFFFFF` — ProfileScreen.tsx:164-168.
- [low] [likely-defect] Avatar initials — design: **26/800** / code: 24/700 (Avatar lg) — Avatar.tsx:29.
- [low] [likely-defect] Role badge:
  - fill: design `#2A2D33` / code `#1E2126`.
  - text: design `#F3F2EE` / code white.
  - icon: design 16 / code 14.
  - height: design 28 / code ~26.
  - Code: ProfileScreen.tsx:88, Badge.tsx:63.
- [low] [likely-defect] Detail rows:
  - label: design **13** / code 14.
  - value: design **16/600** / code 17.
  - icon gap: design **14** / code 12.
  - divider: design `#ECEAE4` full width / code `#DEDBD3` inset 16.
  - Code: ProfileScreen.tsx:176-180.
- [low] [likely-defect] Version line — design: Geist Mono 13 in `#6B7079` / code: `textSecondary #4A4F57` — ProfileScreen.tsx:181.
- [low] [likely-defect] Section gap — design: **24** / code: 20 — ProfileScreen.tsx:153.
- [low] [ambiguous] Extra element — code renders `NotificationPrompt` on the profile, which the design doesn't show — ProfileScreen.tsx:103.

## S-Global → app/_layout.tsx (OfflineBanner, ToastProvider)

- [med] [likely-defect] Offline banner:
  - copy: design "You’re offline" / code "You're offline. Some actions are unavailable." (straight apostrophe).
  - type: design 15/**700** / code 14 semibold.
  - icon: design 22 / code 18.
  - padding and gap: design `12 20`, gap 12, left-aligned / code `12 16`, gap 8, centred.
  - Code: OfflineBanner.tsx:6, OfflineBanner.tsx:14, OfflineBanner.tsx:23-32.
- [med] [likely-defect] The toast has no action slot. The design shows an "Undo" text action (`#FFC21A`, 15/700, 44h) on the success toast — Toast.tsx:27-31, Toast.tsx:85-94.
- [low] [ambiguous] Stacking — design: two toasts at once (gap 10) / code: one at a time, which docs/04 §3 specifies ("one at a time") — Toast.tsx:39.
- [low] [likely-defect] Toast position — design: inset **16** from the sides / code: `screenPadding` 20 — Toast.tsx:110-111.
- (Toast radius, type and emblem colours are listed under Foundations.)

---

## M-Dashboard → app/(manager)/(tabs)/index.tsx

- [high] [likely-defect] Greeting — design: **28/34**, 700, -0.7 (Title 1) / code: `AppHeader size="large"` uses `hero` **34/40**, -1 — AppHeader.tsx:122, index.tsx:72.
- [med] [likely-defect] Date eyebrow — design: **14/500** / code: 15/400 — AppHeader.tsx:120.
- [med] [likely-defect] Header actions:
  - avatar: design **48**, ink, initials 16/**800** / code: **56** (`me` override), 15/700.
  - bell: design 48 / code 56 (see Foundations).
  - Code: index.tsx:209, index.tsx:78.
- [med] [likely-defect] The avatar does not link to Profile. Design: an `<a>` to S-Profile / code: a plain `Avatar`, not pressable — index.tsx:78.
- [med] [likely-defect] Vertical rhythm — design: **22** between blocks / code: `spacing.section` **28** — index.tsx:210.
- [low] [likely-defect] Create task button — design: shadow `0 6 18 @ .18`, icon 22 / code: no shadow, icon 20 — index.tsx:87-92, Button.tsx:86.
- [med] [likely-defect] "Needs your attention" header:
  - title: design **20/700/-0.3** / code `sectionTitle` 22/28/600.
  - count pill: design **24**h, 13/**800**, padding 0 8, gap 10 / code 28h, 14/600, gap 8.
  - Code: States.tsx:274-286.
- [med] [likely-defect] Attention rows:
  - emblem: design **40** / code 44.
  - title: design **16/650** / code 17/600.
  - meta: design **13** with the status word at **700** / code caption overridden to 14/20, status semibold.
  - padding: design `14 14 14 16`, gap 12 / code min-height 72, padding 12/16.
  - Code: TaskRow.tsx:93-112.
- [low] [likely-defect] Row dividers — design: full-width `#ECEAE4` / code: `#DEDBD3` inset 16 — TaskRow.tsx:92.
- [low] [likely-defect] Row chevron — design: **`#6B7079`** (Ink 3) / code: `textSecondary #4A4F57` — TaskRow.tsx:63.
- [med] [likely-defect] Stat tiles:
  - surface: design white with a **1px `#DEDBD3` border**, radius **18**, **no shadow** / code: invisible 1.5px white border, radius 20, `elevation.card`.
  - size: design padding **14**, min-height **76** / code padding 16, min-height 88.
  - number: design **30/30**, 700, -1 / code `hero` 34/40.
  - label stack gap: design 6 / code 8.
  - Code: StatCard.tsx:96-115.
- [low] [likely-defect] Emphasised tile — design: number `#4A1F8C`, label weight 700 / code: number in `fill.text #6B2FBF`, label 600 — StatCard.tsx:62.
- [low] [likely-defect] Stat grid gap — design: **10** / code: `smPlus` 12 — index.tsx:212-213.
- [med] [likely-defect] Recently completed:
  - layout: design shows each task as its own compact card (1px `#DEDBD3` border, radius 16, padding `12 14`, emblem **36**/radius 10, title **15/600**) / code: reuses the grouped `RowGroup`/`TaskRow` with an E1 shadow.
  - section gap: design 10 / code 12.
  - Code: index.tsx:182-194, index.tsx:211.
- [low] [likely-defect] "View all" — design: **15/650** link / code: ghost md button, 16 — States.tsx:202-208.
- [low] [ambiguous] Extra: code puts a numeric badge on the **Tasks** tab (needs-attention count), which no tab-bar board shows — (manager)/(tabs)/_layout.tsx:22.

## M-Tasks → app/(manager)/(tabs)/tasks.tsx → src/features/tasks/TaskListScreen.tsx, src/components/TaskCard.tsx

- [med] [likely-defect] Title — design: **32/38**, -0.8 / code: `hero` 34/40, -1 — AppHeader.tsx:122.
- [med] [likely-defect] Create button — design: **48** circle, icon 22 / code: **56**, icon **28** — TaskListScreen.tsx:138-139, TaskListScreen.tsx:71.
- [low] [ambiguous] Chips:
  - padding: design `0 14` / code 16 (DS chips use 16) — FilterChips.tsx:96.
  - unselected chips: design shows a status icon on each / code shows none (see Foundations).
- [low] [likely-defect] Chip row padding — design: `4 20 12` / code: no vertical padding (only the 48 hit area) — FilterChips.tsx:85-89.
- [med] [likely-defect] List gutter — design: **16** / code: `screenPadding` 20 — TaskListScreen.tsx:147.
- [med] [likely-defect] Task card:
  - gap: design **10** / code 8 + 4.
  - title: design **17/23, 650** / code `cardTitle` 18/24, 600, -0.2.
  - updated-time: design 13/**400** / code caption 500.
  - Code: Card.tsx:63, TaskCard.tsx:105-108.
- [low] [likely-defect] Worker row:
  - divider: design 1px `#ECEAE4` / code 2×hairline `#DEDBD3`.
  - spacing: design padding-top 10 / code 12 + margin 4.
  - avatar: design 28, initials in ink / code 30, initials in the status colour.
  - Code: TaskCard.tsx:111-119, Avatar.tsx:27, Avatar.tsx:86.
- [low] [ambiguous] Extra: code shows the rejection reason quote on Rejected cards (`showRejection`); the board's Rejected card has none. docs/04 §3 specifies it — TaskListScreen.tsx:104, TaskCard.tsx:72-78.
- [low] [ambiguous] Refreshing indicator — design: a custom "Refreshing…" pill with a 28 white spinner disc / code: native `RefreshControl` — TaskListScreen.tsx:97-102.

## M-Tasks-Empty → src/features/tasks/TaskListScreen.tsx (ListEmptyComponent, AWAITING_REVIEW)

- Copy matches ("All caught up", the body, "Show all tasks").
- [med] [likely-defect] The yellow check badge is missing from the emblem (44 circle, `#FFC21A`, 4px `#F4F3EF` ring, bottom-right −8) — States.tsx:111-113.
- [med] [likely-defect] Emblem — design: 120 / radius 36 / icon 56 at stroke 1.6 / code: 112 / 28 / 44. Title: design 24/30 / code 22/28 — States.tsx:239-255.
- [med] [likely-defect] "Show all tasks" button — design: **48**h (md), padding 0 20, 16/650 / code: `Button` default **lg 56**, 17 — States.tsx:125-130.

## M-CreateTask → app/(manager)/tasks/new.tsx → src/features/tasks/TaskForm.tsx, src/features/location/LocationField.tsx

- [med] [likely-defect] Header title — design: **20/700/-0.3** / code: `sectionTitle` 22/28, **600**, -0.4 — AppHeader.tsx:121.
- [low] [likely-defect] Close icon — design: **24** / code: 26 — AppHeader.tsx:64.
- [low] [likely-defect] Form rhythm — design: gap **18**, padding-top 8 / code: gap 20, padding-top 4 — TaskForm.tsx:261.
- [med] [likely-defect] Text inputs — design: **52**h, border `#CFCBC1`; textarea padding `12 16`, line-height 23 / code: 56h, `#DEDBD3` (shared Input).
- [med] [likely-defect] "Assign to" select:
  - field: design **56**h, padding 0 14, gap 12 / code: min-height **64**, padding 16.
  - avatar: design **32** (13/700) / code: Avatar md **44**.
  - name: design **16/600** / code 17.
  - hint: design 13 / code 14.
  - chevron: design 20, `#4A4F57` / code 22, `textPrimary`.
  - Code: TaskForm.tsx:157, TaskForm.tsx:176, TaskForm.tsx:273-296.
- [high] [ambiguous] The location block is structured differently.
  - Design: one "**Site address**" input with a search icon inside it, an inline **176**h map (radius 16) with a "Drag to adjust" tooltip and a "**Use my location**" button, then "**Flat, floor, landmark · optional**".
  - Code: a "Customer location \*" label (14/**400**, with an asterisk), a "Search for a different address" button or search input, a separate multi-line "Address" input, a 168h map preview that opens a modal, a "Pin: lat, lng" caption with "Remove pin", and "Flat / floor / gate, landmark" with a helper line.
  - docs/04 §5 S-004 (and docs/07 §1) specify the code's structure and state "No location permission is requested; the app never uses the manager's own position", which contradicts "Use my location".
  - Code: LocationField.tsx:99-247.
- [low] [likely-defect] The "Customer location \*" label uses `typography.secondary` (400). Every other field label is 14/600, and no other label has an asterisk — LocationField.tsx:100, LocationField.tsx:256.
- [low] [likely-defect] Action bar — design: padding `12 20 34` / code: paddingTop 16 — ActionBar.tsx:64.

## M-WorkerPicker → src/features/assignments/WorkerPicker.tsx (in BottomSheet)

- [med] [likely-defect] Search placeholder — design: "**Search by name**" / code: "Search workers" — WorkerPicker.tsx:70.
- [low] [likely-defect] Search field — design: **52**h, padding 14, gap 10 / code: min 48, padding 16, gap 8 — WorkerPicker.tsx:158-167.
- [med] [likely-defect] Selected row — design: `#F4F3EF` fill, **no border** / code: adds a 1.5px ink border — WorkerPicker.tsx:187.
- [med] [likely-defect] Radio — design: **26** filled ink with a **white check** when selected; unselected is a 2px `#9A9EA5` ring / code: 24 ring with an ink dot — WorkerPicker.tsx:193-203, WorkerPicker.tsx:132-134.
- [low] [likely-defect] Rows:
  - subline: design shows **no** subline (name only) / code adds "Field worker".
  - avatar: design **40** (14/700) / code 44.
  - name: design **16/650** / code 17/600.
  - Code: WorkerPicker.tsx:120, WorkerPicker.tsx:128-130, WorkerPicker.tsx:190.
- [low] [likely-defect] Row inset — design: the list sits at **8** from the sheet edge, wider than the 20 content gutter / code: inside the 20 gutter — BottomSheet.tsx:121.
- [low] [likely-defect] Confirm button — design: a footer pinned to the sheet bottom, with a top divider `#ECEAE4` and padding `12 20 34` / code: an inline button with marginTop 16, no divider — WorkerPicker.tsx:145-152, WorkerPicker.tsx:205.
- [low] [likely-defect] Group label weight — design: **700** / code: `label` 600 — WorkerPicker.tsx:174.
- (Sheet handle and close button: see Foundations.)

## M-Discard → app/(manager)/tasks/new.tsx (ConfirmationDialog)

- [low] [likely-defect] Body copy — design: "“{task title}” hasn’t been created yet. Everything you entered will be lost." / code: "This task hasn’t been created yet. …" — new.tsx:59.
- Dialog geometry differences are under Foundations. Order (Discard above Keep editing), labels and the trash emblem match.

## M-EditTask → app/(manager)/tasks/[taskId]/edit.tsx → TaskForm.tsx

- [med] [likely-defect] Notice copy — design: "Kavya **is working on this.** Kavya is notified when you save." / code: "{first} is notified when you save." — edit.tsx:45.
- [med] [likely-defect] Notice styling:
  - icon: design a **wrench** (in-progress) / code `notifications-outline`.
  - text: design **`#6B3400`**, 14/20/**500** / code `warningText`, 400.
  - padding and gap: design `12 14`, gap 10 / code 16, gap 8.
  - Code: TaskForm.tsx:92, TaskForm.tsx:262-269.
- [high] [ambiguous] The inline "**Reassign**" tonal button (44h, `#ECEAE4`, 14/650) inside the "Assigned to" field is missing. The code comment says reassigning is deliberately its own action ("worker is shown but not changed here") — TaskForm.tsx:188-202.
- [low] [likely-defect] Assigned-to row — design: 56h, avatar 32 / code: 64h, avatar 44 — TaskForm.tsx:193, TaskForm.tsx:274.
- [med] [likely-defect] Header title — same as M-CreateTask: design 20/700 / code 22/600.

## M-Detail-Assigned → app/(manager)/tasks/[taskId]/index.tsx → src/features/tasks/TaskDetailView.tsx, WorkerJourney.tsx

- [high] [likely-defect] Detail status badge — design: **30**h, **14/650**, padding `0 12 0 10`, icon 16 / code: the small Badge (13, ~26h, icon 14) — TaskDetailView.tsx:72-75, Badge.tsx:75-86.
- [med] [likely-defect] Person row:
  - avatar: design **36** (13/700) / code: Avatar md **44**.
  - name: design **15/650** / code 17/600.
  - subline: design **13** / code 14.
  - gap: design 10 / code 12.
  - Code: TaskDetailView.tsx:87, TaskDetailView.tsx:386-389.
- [med] [likely-defect] Stepper card — design: flat, 1px `#DEDBD3` border / code: `Card` with an E1 shadow and no border — WorkerJourney.tsx:47, WorkerJourney.tsx:115.
- [med] [likely-defect] Stepper geometry:
  - node: design **32** / code **36**.
  - done check: design **15** / code 18.
  - pending ring: design `#CFCBC1` / code `#B9B5AB`.
  - label: design **12/15**, weights 700 next / 600 done / 500 pending; gap to node 8 / code: 13/16 at 500 and 600; gap 6.
  - Code: WorkerJourney.tsx:79, WorkerJourney.tsx:112, WorkerJourney.tsx:117, WorkerJourney.tsx:127, WorkerJourney.tsx:140-146.
- [med] [likely-defect] In-progress step and status icon — design: a **wrench** / code: `hammer-outline`. Ionicons `build-outline` is the wrench — WorkerJourney.tsx:33, theme.ts:141.
- [high] [likely-defect] Location card:
  - map: design has a map thumbnail on top / code has none.
  - text: design address **15/650** plus a 13 subline, with no pin icon / code: a pin icon plus address 17/600.
  - button: design an inline right-aligned "Open in Maps" (**44**h, radius 12, 1.5px ink, 14/650, no icon) / code: a separate full-row secondary md button (48h, 16, with an `open-outline` icon) below the text.
  - padding: design `14 16`, flat with border / code 20 with an E1 shadow.
  - Code: TaskDetailView.tsx:280-323, TaskDetailView.tsx:403-407.
- [med] [ambiguous] Extra sections — code always renders "Photos · 0 / No photos yet." and "Notes · 0 / No notes yet." (`showWork` defaults to true). The board shows neither before work starts. docs/04 §5 S-005 asks for the empty captions — TaskDetailView.tsx:155-168.
- [med] [likely-defect] Description:
  - heading: design **17/700** / code `cardTitle` at 20, semibold, min-height 48.
  - body: design `#2B2F36` / code `textPrimary`.
  - Code: TaskDetailView.tsx:409-418.
- [low] [ambiguous] Extra footnote "Created {date}" — not on any manager detail board — TaskDetailView.tsx:180-183.
- [low] [likely-defect] Spacing:
  - content gap: design **18** / code 20.
  - header-block gap: design **10** / code 12.
  - back icon: design 24 / code 26.
  - Code: TaskDetailView.tsx:383-384, AppHeader.tsx:64.

## M-Detail-OnTheWay → same files

- Subline "Set off 15 min ago" matches. All M-Detail-Assigned findings apply: badge size, person row, stepper card and geometry, location card, extra Photos/Notes sections, description styling.
- No other differences.

## M-Detail-InProgress → same files

- [high] [likely-defect] The work section is structured differently.
  - Design: one "**Work so far**" card (17/700 title, a "2 photos · 1 note" meta at 13/600, a 3-column 96h grid at radius 12, and notes as `#F4F3EF` bubbles with radius 14, padding `12 14`, text 15/22 and meta 13).
  - Code: separate "Photos · n" and "Notes · n" sections; notes are white shadowed `Card`s (radius 20) with body 16 and **mono** meta.
  - Code: TaskDetailView.tsx:155-168, TaskDetailView.tsx:206-247, TaskDetailView.tsx:421-425.
- [med] [likely-defect] Location — design: a **compact one-row** card (radius 16, padding `12 14`, pin 20, address 15/600, inline Open in Maps) placed **after** the work / code: the same tall LocationCard as every state — TaskDetailView.tsx:170.
- [low] [likely-defect] Photo thumbnails — design: radius **12** / code: `radius.action` 14 — PhotoGrid.tsx:117.
- [low] [likely-defect] Content gap on this board — design: **16** / code: 20.
- Badge, person row and stepper findings as in M-Detail-Assigned.

## M-Detail-Review → same files (primary === 'approve')

- [high] [likely-defect] There is no "Submitted work" card. Design: one E1 card titled "Submitted work" with a "4 photos · 2 notes" meta, the photo grid (102h), a "+N" overflow tile and note bubbles with a bold "edited" / code: separate Photos and Notes sections (see M-Detail-InProgress) — TaskDetailView.tsx:155-168.
- [med] [likely-defect] Open in Maps (Review, Rejected) — design: a **tonal** button (`#ECEAE4`) with a **trailing** external-link icon / code: a secondary outline with a leading `open-outline` — TaskDetailView.tsx:302-307.
- [med] [likely-defect] Action bar split — design: grid **1fr : 1.3fr**, gap 10; "Request changes" label **16** / code: equal `flex:1` columns, gap 12, both labels 17 — index.tsx:228, index.tsx:236-237, index.tsx:437, ActionBar.tsx:69.
- [low] [likely-defect] The "edited" marker — design: **600** weight / code: plain — TaskDetailView.tsx:218.
- Subline "Submitted 2 min ago · 1h 40m on site" matches. Badge, person row and stepper findings apply.

## M-ApproveConfirm → app/(manager)/tasks/[taskId]/index.tsx (ConfirmationDialog 'approve')

- Copy, icons and tone match the board.
- Only the dialog geometry differs (see Foundations: radius 24 vs 28, emblem 48 vs 52, buttons 52 vs 56).

## M-RequestChanges → app/(manager)/tasks/[taskId]/index.tsx (BottomSheet)

- [med] [likely-defect] Notice:
  - icon: design a wrench / code `hammer-outline`.
  - text: design **`#6B3400`**, 14/20/**500** / code `warningText #944700`, 400.
  - padding and gap: design `12 14`, gap 10 / code 16, gap 8.
  - Code: index.tsx:312, index.tsx:439-446.
- [low] [likely-defect] Counter — design: "0 / 1000" in Geist **13 regular `#4A4F57`** / code: `mono` in `textTertiary` — Input.tsx:185.
- [low] [likely-defect] Quick-note chips — design: visual **40**h, padding 14, 14/600 / code: a 48h pill (no 40 visual inside the hit area), padding 16 — index.tsx:449-457.
- [med] [likely-defect] Disabled "Send to Rahul" — design: label `#5B5F66` / code: `#8D9199` (see Foundations) — Button.tsx:149.
- [low] [likely-defect] Sheet title — design: 22/700/**-0.3** / code: -0.4 — BottomSheet.tsx:107-112.

## M-Detail-Rejected → same files (primary === 'reassign')

- [low] [likely-defect] Hand-back callout:
  - border: design **2px** `#B42318` / code 1.5px.
  - avatar: design 36 / code 44.
  - title: design **15/650** / code 16/600.
  - meta: design 13 / code 14.
  - Code: TaskDetailView.tsx:390-392.
- [med] [likely-defect] Rejection reason — design: **17/25, 500** / code: 18/27, 400 — TaskDetailView.tsx:394.
- [low] [likely-defect] "Still assigned…" hint — design: **13/600**, icon 16, gap 6 / code: 14/600, icon 18, gap 8 — TaskDetailView.tsx:126, TaskDetailView.tsx:395.
- [med] [ambiguous] Extra empty "Photos · 0 / Notes · 0" sections, and the Rejected board has no stepper. Code already hides the stepper for REJECTED, which is correct — TaskDetailView.tsx:155-168.
- Badge and location findings as above.

## M-ReassignPicker → app/(manager)/tasks/[taskId]/index.tsx → WorkerPicker.tsx

- [med] [likely-defect] The task-title subline under "Reassign to" (15, `#4A4F57`) is missing — WorkerPicker.tsx:64.
- [med] [ambiguous] The worker who handed the task back is selectable and unlabelled. Design: "Currently assigned · handed it back", disabled at 0.6 opacity / code: on REJECTED, `disabledWorkerId` is set to null, so that worker is selectable and labelled "Field worker". docs/04 only disables the current worker for ASSIGNED and IN_PROGRESS — index.tsx:420, WorkerPicker.tsx:102-103, WorkerPicker.tsx:129.
- [low] [likely-defect] Disabled row — design: the whole row at **opacity 0.6** / code: only the name greys out — WorkerPicker.tsx:124, WorkerPicker.tsx:191.
- [low] [likely-defect] Row min-height — design: 60 (with subline) / code: 64.
- Other differences as M-WorkerPicker: placeholder "Search by name", radio, selected-row border, footer.

## M-ReassignConfirm → app/(manager)/tasks/[taskId]/index.tsx (ConfirmationDialog pendingWorker)

- [med] [likely-defect] Emblem — design: **from → to avatars** (44 each; the old one at 0.6, an arrow, the new one with a 3px ink ring) / code: a generic `swap-horizontal-outline` icon tile — index.tsx:408.
- [med] [likely-defect] Cancel label — design: "**Back**" / code: the default "Cancel" — index.tsx:399-415.
- Title and body copy match.

## M-Detail-Completed → same files (primary === 'reopen')

- [high] [likely-defect] "Reopen task" variant — design: **secondary** (white, 1.5px ink outline) with the refresh icon / code: **primary** (ink fill) — index.tsx:241-247.
- [med] [likely-defect] Section structure and order — design: header → **Description → Photos → Notes**, with **no stepper and no location card** / code: stepper (all done) → Photos → Notes → Location → Description → footnote — TaskDetailView.tsx:106, TaskDetailView.tsx:155-183.
- [low] [likely-defect] Photos heading — design: "Photos" with the count right-aligned (13/600) / code: "Photos · 3". Notes heading matches the "· n" form — TaskDetailView.tsx:271.
- [low] [likely-defect] Note card — design: white, 1px `#DEDBD3` border, radius **14**, padding `12 14`, text 15/22, meta 13 Geist / code: shadowed Card, radius 20, body 16, mono meta — TaskDetailView.tsx:209, TaskDetailView.tsx:422-425.
- [low] [ambiguous] Subline — design: "Approved by **you** · …" / code: the reviewer's full name — TaskDetailView.tsx:366-368.

## M-ReopenConfirm → app/(manager)/tasks/[taskId]/index.tsx (ConfirmationDialog 'reopen')

- [low] [likely-defect] Emblem tone — design: **warning** (`#FDEBD3` tile, `#9A4A00` refresh icon) / code: no `tone`, so it renders grey with an ink icon — index.tsx:371-380.
- Copy and labels match ("Reopen task" / "Cancel").

## M-Overflow → app/(manager)/tasks/[taskId]/index.tsx → src/components/OverflowMenu.tsx

- Items, order and icons match: Edit task, Reassign, Mark as completed, Cancel task.
- [med] [likely-defect] Backdrop — design: `rgba(15,17,21,0.3)` / code: `colors.overlay` (0.55) — OverflowMenu.tsx:97.
- [med] [likely-defect] Menu:
  - width: design **248** / code min 260.
  - radius: design **18** / code 20.
  - padding: design **6** / code 8.
  - position: design right 16, top 108 (just under the trigger) / code: `marginTop: 64` from the safe-area top, right 20.
  - shadow: design two layers (`0 6 20 @ .12` + `0 16 48 @ .18`) / code `elevation.overlay`.
  - Code: OverflowMenu.tsx:98-106.
- [med] [likely-defect] Items — design: **52**h, radius 12, gap 12, label **16/600** (destructive 650) / code: min 48, label 17 semibold — OverflowMenu.tsx:107-114, OverflowMenu.tsx:125.
- [low] [likely-defect] Destructive separator — design: a standalone 1px `#ECEAE4` line with margin `4 8` / code: a top border `#DEDBD3` on the item itself — OverflowMenu.tsx:115-123.
- [low] [likely-defect] The trigger does not stay highlighted (a white 48 circle) while the menu is open — index.tsx:193, index.tsx:468.

## M-CompleteConfirm → app/(manager)/tasks/[taskId]/index.tsx (ConfirmationDialog 'complete')

- [med] [likely-defect] Copy and structure:
  - Design body: "…Kavya is notified. **Use this when the work was confirmed another way.**", followed by a separate info box ("Photos and notes added so far are kept."; `#F4F3EF`, radius 12, padding `10 12`, info icon 18, 14/20 `#2B2F36`).
  - Code: drops the "Use this when…" sentence and folds "Photos and notes added so far are kept." into the body. ConfirmationDialog has no slot for a note box.
  - Code: index.tsx:282, ConfirmationDialog.tsx:17-33.

## M-CompleteBlocked → app/(manager)/tasks/[taskId]/index.tsx (ConfirmationDialog 'needsPhoto')

- [med] [likely-defect] Buttons — design: a **single** "OK" button / code: "OK" plus a secondary "**Close**", because ConfirmationDialog always renders the cancel button — index.tsx:268-277, ConfirmationDialog.tsx:99.
- Title, body and the camera emblem match.

## M-CancelConfirm → app/(manager)/tasks/[taskId]/index.tsx (ConfirmationDialog 'cancel')

- [low] [likely-defect] Body copy — design ends "…Photos and notes are kept." / code appends "**This can't be undone.**" (and uses a straight apostrophe) — index.tsx:387.
- Labels "Cancel task" / "Keep task", the destructive variant and the ban emblem match.

---

### Boards without a matching implementation

None. Every assigned board maps to an existing route or component. Parts of some boards are missing from the code:

- the in-form Reassign button (M-EditTask);
- "Use my location" and the inline draggable map (M-CreateTask);
- the toast Undo action (S-Global);
- the "Submitted work" / "Work so far" combined card (M-Detail-Review, M-Detail-InProgress);
- the map thumbnail in the location card (M-Detail-*).
