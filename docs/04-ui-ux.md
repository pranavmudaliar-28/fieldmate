# FieldMate — Phase 4: UI / UX

Status: **Draft for approval**
Date: 2026-09-16
Inputs: [02-product-specification.md](02-product-specification.md), [03-architecture.md](03-architecture.md) (both approved)

Tags: **[C]** confirmed in the original spec · **[D]** product-owner decision · **[T]** design or technical choice that doesn't change product behaviour · **[A]** proposed change for approval (see §12)

---

## 1. Design principles

The spec's direction is professional, clean, modern, task-focused, mobile-first and field-friendly, with usability over decoration [C]. In practice:

1. **One obvious next step.** Each screen has at most one primary button, placed in a fixed action bar at the bottom where the thumb reaches it.
2. **Usable outdoors.** High contrast, 16px minimum body text, no light-grey-on-white text, and status never shown by colour alone.
3. **Big targets.** Every tappable element is at least **48×48 dp**, and primary buttons are **52 dp** tall, so they're usable with gloves or while walking.
4. **Status first.** The task status badge is always visible next to the title.
5. **Honest feedback.** Every action shows progress, success or a readable error; no action fails silently.
6. **No decoration.** No illustrations, gradients, charts or animations beyond the platform's standard transitions.

Out of scope: dark mode, tablet-specific layouts, landscape layouts (the app is locked to portrait [T]), and custom fonts [T].

---

## 2. Design tokens

All tokens live in `apps/mobile/src/constants/theme.ts`. Components never use raw values.

### 2.1 Colours

**Brand and base palette** [C]
| Token | Hex | Use |
|---|---|---|
| `primary` | `#2563EB` | Primary buttons, links, focus ring, selected chip |
| `background` | `#F8FAFC` | Screen background |
| `surface` | `#FFFFFF` | Cards, inputs, sheets, dialogs |
| `textPrimary` | `#0F172A` | Titles, body text |
| `textSecondary` | `#64748B` | Metadata, helper text, placeholders |
| `success` | `#16A34A` | Success icons and borders, toast accent |
| `warning` | `#D97706` | Warning icons and borders |
| `error` | `#DC2626` | Error text, destructive buttons, error borders |
| `info` | `#0284C7` | Info icons and borders |

**Supporting tokens** needed for states the spec doesn't give colours for [T]
| Token | Hex | Use |
|---|---|---|
| `primaryPressed` | `#1D4ED8` | Primary button pressed |
| `onPrimary` | `#FFFFFF` | Text and icons on primary or error buttons |
| `border` | `#E2E8F0` | Card and input borders, dividers |
| `borderStrong` | `#CBD5E1` | Input border when focused on a light surface, sheet handle |
| `surfaceMuted` | `#F1F5F9` | Skeleton blocks, disabled input background, photo placeholder |
| `textDisabled` | `#94A3B8` | Disabled text; decorative only, never important text |
| `overlay` | `rgba(15, 23, 42, 0.5)` | Dimmed backdrop behind dialogs and sheets |

**Accessible text variants for status badges** [A]

At 12–14px, several spec colours are **below the WCAG AA 4.5:1 contrast ratio** when used as text on white or on a tint: success ≈ 3.3:1, warning ≈ 3.2:1, info ≈ 4.1:1. The spec colours stay for icons, borders and accents, and badge **text** uses darker shades from the same colour families:

| Token | Hex | Contrast on its tint |
|---|---|---|
| `successText` / `successTint` | `#15803D` / `#DCFCE7` | ≥ 4.5:1 |
| `warningText` / `warningTint` | `#B45309` / `#FEF3C7` | ≥ 4.5:1 |
| `infoText` / `infoTint` | `#0369A1` / `#E0F2FE` | ≥ 4.5:1 |
| `errorText` / `errorTint` | `#B91C1C` / `#FEE2E2` | ≥ 4.5:1 |
| `neutralText` / `neutralTint` | `#475569` / `#F1F5F9` | ≥ 4.5:1 |

Exact ratios are checked with a contrast tool in Phase 6G; any shade that falls short gets adjusted within its colour family.

### 2.2 Task status appearance
| Status | Label | Tint / text | Icon (Ionicons) |
|---|---|---|---|
| ASSIGNED | Assigned | info | `mail-unread-outline` |
| IN_PROGRESS | In progress | warning | `time-outline` |
| COMPLETED | Completed | success | `checkmark-circle-outline` |
| REJECTED | Rejected | error | `close-circle-outline` |
| CANCELLED | Cancelled | neutral | `ban-outline` |

Every badge shows **icon + text** so status never relies on colour [T]. Icons come from `@expo/vector-icons`, which is **already included with Expo**, so there's no new dependency.

### 2.3 Typography [C]
Uses the system font: SF Pro on iOS, Roboto on Android [T].

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `display` | 28 / 34 | Bold 700 | "FieldMate" on Login |
| `screenTitle` | 24 / 30 | Bold 700 | Dashboard greetings, task title on detail screens |
| `sectionTitle` | 18 / 24 | Semibold 600 | Section headers, sheet and dialog titles |
| `body` | 16 / 24 | Regular 400 | Descriptions, notes, input text |
| `secondary` | 14 / 20 | Regular 400 | Card metadata, helper text, labels |
| `caption` | 12 / 16 | Medium 500 | Badges, timestamps, counters |
| `button` | 16 / 20 | Semibold 600 | All button labels |

- Line heights are [T].
- **Dynamic Type:** text scales with the OS setting, capped at `maxFontSizeMultiplier = 1.6` so layouts don't break [T].
- Titles wrap to at most 2 lines on cards and aren't truncated on detail screens.

### 2.4 Spacing [C]
Tokens: `xs 4`, `sm 8`, `md 16`, `lg 24`, `xl 32`, `2xl 40`, `3xl 48`.

| Where | Spacing |
|---|---|
| Screen horizontal padding | **16** [C] |
| Between cards in a list | 8 |
| Card inner padding | 16 |
| Between sections | 24 |
| Label to input | 4 |
| Between form fields | 16 |
| Bottom action bar | 16 padding + safe-area inset |

### 2.5 Shape and elevation [T]
- **Corner radius:** 8 for buttons, inputs and chips; 12 for cards, dialogs and photo thumbnails; 16 for the top corners of bottom sheets; fully rounded for badges and avatars.
- **Elevation:** cards use a 1px `border` instead of shadows, which is flatter and more readable in sunlight. Only dialogs and bottom sheets have a shadow.

---

## 3. Components

Reusable components go in `src/components/`. The 17 components come from the spec [C]. Two more, **OfflineBanner** and **Toast**, are needed for the network-unavailable and success states the spec requires. **ActionBar** is a layout wrapper so primary actions sit in the same place on every screen.

| Component | Variants / props | Behaviour and states |
|---|---|---|
| **Button** | `primary` · `secondary` (outline) · `destructive` · `ghost` (text); `size: lg 52 / md 48`; `loading`, `disabled`, `icon`, `fullWidth` | While `loading`, a spinner replaces the label (width stays the same) and the button can't be tapped. Disabled uses `surfaceMuted` bg + `textDisabled`. Pressed uses `primaryPressed` or 0.85 opacity. |
| **Input** | `label`, `value`, `error`, `helper`, `secureTextEntry`, `keyboardType`, `returnKeyType` | Height 48; label above; border `border`, then 2px `primary` when focused, `error` on error. Error text appears below with an icon. The password field has a show/hide toggle (48dp target). |
| **TextArea** | Same as Input + `maxLength`, `minRows` 3 | Grows up to 8 rows, then scrolls. A character counter appears once 80% of `maxLength` is reached. |
| **Select** | `label`, `options`, `value`, `placeholder`, `error` | Looks like an Input with a chevron. Tapping it opens a **BottomSheet** list of radio rows (48dp); the selected row shows a checkmark. |
| **Card** | `onPress?` | Surface, 1px border, radius 12, padding 16. When tappable, it gets a pressed background and `accessibilityRole="button"`. |
| **Badge** | `tone: info/warning/success/error/neutral`, `icon?`, `label` | Pill shape, caption text, tint background and matching text colour. |
| **StatusBadge** | `status` | A Badge wrapper using the §2.2 mapping. |
| **Avatar** | `name`, `size 32/40` | **Initials** on a `surfaceMuted` circle. There are no profile photos, because the data model has no field for them. |
| **TaskCard** | `task`, `showWorker` (manager), `showRejection` | See the layout below. |
| **SectionHeader** | `title`, `actionLabel?`, `onAction?` | Section title on the left, optional link on the right (48dp target). |
| **LoadingState** | `variant: list / detail / inline` | List shows 3 skeleton TaskCards; detail shows skeleton blocks for title, badge and text; inline shows a spinner. Skeletons are static blocks, not animated [T]. |
| **EmptyState** | `icon`, `title`, `message`, `action?` | Centred, 48px `textSecondary` icon, sectionTitle and body text, optional secondary button. |
| **ErrorState** | `message`, `onRetry` | `alert-circle-outline` icon, readable message, **Try again** button. |
| **ConfirmationDialog** | `title`, `message`, `confirmLabel`, `cancelLabel`, `destructive?`, `loading?`, `children?` (e.g. reason input) | Centred modal on `overlay`. Cancel is on the left and confirm on the right. **Tapping outside doesn't dismiss** a destructive dialog. The confirm button shows loading while the request runs, and errors appear inside the dialog. |
| **BottomSheet** | `title`, `visible`, `onClose`, children | RN `Modal` sliding up; top radius 16; drag handle (decorative); close button top-right; keyboard-aware; maximum height 90%. |
| **PhotoPreview** | `uri`, `caption` (uploader · time), `onPress`, `onDelete?` | 1:1 thumbnail with radius 12. When `onDelete` is set, a 48dp trash button sits in the corner. Tapping the photo opens a full-screen viewer (black background, close button, caption). |
| **PermissionPrompt** | `kind: camera / location / notifications`, `status: undetermined / denied` | Icon, title, explanation. `undetermined` shows **Allow**; `denied` shows **Open Settings** (via `Linking.openSettings()`) and, where it applies, a secondary option to continue without it. |
| **OfflineBanner** | — | A full-width `neutralText` bar below the header: "You're offline. Some actions are unavailable." Stays while offline and is announced to screen readers. |
| **Toast** | `tone: success / error`, `message` | Bottom, above the ActionBar, 3 seconds, one at a time, announced to screen readers; not used for errors that need a decision. |
| **ActionBar** | children (1–2 buttons) | Fixed at the bottom; `surface` with a top `border`; padding 16 plus safe-area inset; rises with the keyboard on forms. |

**TaskCard layout:**
```
┌───────────────────────────────────────────────┐
│ Replace water meter at Block C          [●Assigned] │  ← title (body 600, 2 lines max) + StatusBadge
│ 📍 14 Harbour Rd, Unit 3                        │  ← secondary, 1 line
│ 👤 Priya N.            Updated 2h ago           │  ← manager only: worker; caption: relative time
│ ⚠ Rejected: "Site locked, no key"               │  ← only when REJECTED and showRejection
└───────────────────────────────────────────────┘
```
Emoji here stand in for Ionicons in the mockup (`location-outline`, `person-outline`, `alert-circle-outline`).

**Dates** [T]: lists show relative time ("2h ago", "Yesterday"); detail screens show the absolute local date and time ("16 Sep 2026, 14:05"). Formatting uses `Intl` with the device locale; the UI text itself is English only.

---

## 4. Navigation and chrome

- Each route group uses a **native stack** with the platform's standard header: iOS large-title style off, back button on the left, title centred on iOS and left-aligned on Android [T].
- **Dashboards** (S-002, S-006) have no back button. The header shows "FieldMate" and a **Log out** button on the right (`log-out-outline` icon + text, 48dp).
- **Log out** asks for confirmation first: "Log out? You'll need to sign in again on this device." Because of the Q1 decision, the message also says: "This signs you out on all your devices."
- **After Create task**, the Create screen is *replaced* by Task Details, so Back goes to the Dashboard and never returns to an empty form [T].
- **S-009 Field Evidence** opens as a full-screen modal with a close (✕) button. **S-010 Task Completion** is a normal pushed screen.
- **Tapping a push** opens the task's details on top of that role's dashboard, so Back goes to the dashboard.
- **Android:** the hardware Back button follows the same paths; on a form with unsaved changes it shows the "Discard changes?" dialog.

**Screen titles**
| Screen | Header title |
|---|---|
| S-001 | none (custom layout) |
| S-002 / S-006 | FieldMate |
| S-003 | All tasks |
| S-004 | New task / Edit task |
| S-005 / S-008 | Task details |
| S-007 | My tasks |
| S-009 | Add photo |
| S-010 | Complete task |

---

## 5. Screen layouts

Wireframes are schematic: `[ Button ]` is a button, `( chip )` a filter chip, `▢` a photo thumbnail, `▔▔` the ActionBar.

### S-001 Login
```
┌─────────────────────────────┐
│                             │
│         FieldMate           │ display, centred
│       Welcome back          │ body, textSecondary
│                             │
│  Email                      │
│  ┌───────────────────────┐  │ keyboardType=email, autoCapitalize=none, autoComplete=email
│  └───────────────────────┘  │
│  Password                   │
│  ┌──────────────────── 👁 ┐  │ secure, show/hide
│  └───────────────────────┘  │
│  ⚠ Incorrect email or password   (form error, errorText, above button)
│                             │
│  [        Login          ]  │ primary lg, full width
└─────────────────────────────┘
```
- The layout scrolls and moves up with the keyboard. The email field's Next key moves to password; the password field's Go key submits.
- The Login button stays enabled. Checks run on submit, errors appear next to each field, and the button shows loading while submitting.
- There's no "Forgot password" or "Sign up" link, because those features are out of scope [D].

### S-002 Manager Dashboard
```
┌─────────────────────────────┐
│ FieldMate          ⎋ Log out│
├─────────────────────────────┤
│ Hello, Anita                │ screenTitle
│ [  ＋ Create task        ]  │ primary lg, full width
│                             │
│ Needs attention             │ SectionHeader
│ ┌ TaskCard (REJECTED) ────┐ │ showWorker + showRejection
│ └─────────────────────────┘ │
│                             │
│ Recently completed  View all│ SectionHeader → S-003 (filter=Completed)
│ ┌ TaskCard ───────────────┐ │ up to 10
│ └─────────────────────────┘ │
│                             │
│ [     View all tasks     ]  │ secondary
└─────────────────────────────┘
```
- The whole screen scrolls, with pull to refresh.
- The **Create task** button is in the content rather than an ActionBar, because it's the dashboard's main action and should sit near the top.
- "Needs attention" shows every REJECTED task, since the list is expected to be short. If there are more than 10, it shows 10 plus a "View all" link to S-003 filtered to Rejected [T].
- Empty sections show a compact line instead of a full EmptyState: "Nothing needs your attention." / "No completed tasks yet."

### S-003 Task List (Manager)
```
┌─────────────────────────────┐
│ ←  All tasks                │
├─────────────────────────────┤
│ (All)(Assigned)(In progress)(Completed)(Rejected)(Cancelled) → horizontal scroll
│                             │
│ ┌ TaskCard ───────────────┐ │ showWorker
│ ┌ TaskCard ───────────────┐ │
│ ┌ TaskCard ───────────────┐ │
│          ⟳ loading more     │ inline spinner at the end
└─────────────────────────────┘
```
- The chip row stays pinned at the top. Chips are single-select, and the selected chip uses a `primary` background with `onPrimary` text.
- The list is a `FlatList` that loads more as the manager scrolls, with pull to refresh.
- Changing the filter resets the list and shows loading skeletons.

### S-004 Create Task / Edit Task
```
┌─────────────────────────────┐
│ ✕  New task                 │ close (✕) instead of back: this is a form
├─────────────────────────────┤
│ Title *                     │
│ ┌───────────────────────┐   │
│ Description *               │
│ ┌───────────────────────┐   │ TextArea
│ │                       │   │
│ └───────────────────────┘   │
│ Assign to *                 │ (hidden in edit mode)
│ ┌ Select a worker     ⌄ ┐   │ → BottomSheet worker list
│ Address *                   │
│ ┌───────────────────────┐   │
│ [ ◎ Use current location ]  │ secondary md
│ ✓ Coordinates captured  ✕   │ after capture: caption + clear
│   -33.8688, 151.2093        │
├▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔┤
│ [      Create task       ]  │ ActionBar primary (edit: "Save changes")
└─────────────────────────────┘
```
- Required fields are marked `*`, and screen readers hear "required".
- **Checking:** the first submit checks all fields, scrolls to the first error and focuses it. After that, each field is checked again as it changes.
- **Use current location:**
  - Undetermined permission: the system prompt appears.
  - Denied permission: an inline PermissionPrompt says "Location access is off. You can still type the address." with **Open Settings**.
  - While fetching: the button shows loading. A timeout or failure shows an inline error with Retry.
- **Worker picker sheet:**
  - A list of workers with Avatar and name.
  - Loading shows skeleton rows; an error shows ErrorState.
  - If there are no workers: "No field workers yet. Ask your administrator to create worker accounts."
- **Edit mode:** the fields are pre-filled, and **Save changes** stays disabled until something changes.
- **Leaving with unsaved changes:** a "Discard changes?" dialog with **Keep editing** / **Discard** (destructive).

### S-005 Task Details (Manager)
```
┌─────────────────────────────┐
│ ←  Task details             │
├─────────────────────────────┤
│ Replace water meter         │ screenTitle
│ at Block C                  │
│ [● In progress]             │ StatusBadge
│                             │
│ Description                 │ sectionTitle
│ Old meter leaking; replace… │ body, full text
│                             │
│ Assignment                  │
│ 👤 Priya Nair               │
│ Assigned 16 Sep 2026, 09:12 │
│ ┌ ⚠ Rejected 16 Sep, 10:03 ┐│ errorTint box, only when REJECTED
│ │ "Site locked, no key"    ││
│ └──────────────────────────┘│
│                             │
│ Location                    │
│ 14 Harbour Rd, Unit 3       │
│ -33.8688, 151.2093          │ caption, only if set
│ [ ↗ Open in Maps ]          │ ghost
│                             │
│ Photos (3)                  │
│ ▢ ▢ ▢                       │ 3-column grid, tap → full-screen viewer
│                             │
│ Notes (2)                   │
│ Priya N. · 10:40            │ caption
│ Replaced valve first…       │ body
│ ─────────────               │
│                             │
│ Created 16 Sep 2026, 09:12  │ caption timeline
├▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔┤
│ [   Complete task   ] [ ⋯ ] │ ActionBar
└─────────────────────────────┘
```
- **Actions** (only those allowed in the current status appear, per product spec §5):
  - The ActionBar shows the **main action for the status**: IN_PROGRESS → **Complete task**; COMPLETED → **Reopen task**; REJECTED → **Reassign**; ASSIGNED → **Reassign**.
  - The **⋯ button** opens an action sheet with the other allowed actions: Edit, Reassign, **Cancel task** (red, last).
  - CANCELLED shows no ActionBar, just the badge and a caption "This task was cancelled."
- **Complete when there are no photos:** the button is disabled, and a helper line above the ActionBar reads "At least 1 photo is required to complete this task."
- **Confirmations:**
  - Complete: "Complete this task? The worker will no longer be able to add photos or notes." → **Complete**
  - Reopen: "Reopen this task? It will go back to Priya Nair as Assigned." → **Reopen**
  - Cancel (destructive): "Cancel this task? This can't be undone." → **Cancel task** / **Keep task**
- **Reassign:** a BottomSheet shows the worker list; in ASSIGNED and IN_PROGRESS the current worker is shown but disabled with the caption "Current". Picking a worker opens a dialog: "Reassign to Sam Lee? Priya Nair will lose access to this task." When the task was IN_PROGRESS, it adds: "The task will go back to Assigned."
- **After any action:** a Toast confirms it ("Task completed", "Task reassigned to Sam Lee", …) and the screen updates.
- **Empty sections:** "No photos yet." / "No notes yet." as compact caption lines.

### S-006 Worker Dashboard
```
┌─────────────────────────────┐
│ FieldMate          ⎋ Log out│
├─────────────────────────────┤
│ Hello, Priya                │
│                             │
│ In progress                 │
│ ┌ TaskCard ───────────────┐ │
│                             │
│ New assignments             │
│ ┌ TaskCard ───────────────┐ │
│ ┌ TaskCard ───────────────┐ │
│                             │
│ [    View all my tasks   ]  │ secondary
└─────────────────────────────┘
```
- If both sections are empty, one EmptyState replaces them: `clipboard-outline`, "No tasks right now", "New tasks assigned to you will appear here." Then the "View all my tasks" button.
- Each section shows up to 10 tasks, with a "View all" link when there are more [T].

### S-007 My Tasks (Worker)
```
┌─────────────────────────────┐
│ ←  My tasks                 │
├─────────────────────────────┤
│ Active                      │ SectionList sticky header
│ ┌ TaskCard (In progress) ─┐ │
│ ┌ TaskCard (Assigned) ────┐ │
│ Completed                   │
│ ┌ TaskCard (Completed) ───┐ │
│          ⟳ loading more     │
└─────────────────────────────┘
```
- Section list with pull to refresh; the Completed section loads more as the worker scrolls [T].
- Empty Active section: "No active tasks." Empty Completed section: "Completed tasks will appear here."

### S-008 Worker Task Details
The same reading layout as S-005, without worker details. It shows "Assigned to you · 16 Sep, 09:12". Differences by status:

**ASSIGNED**
```
├▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔┤
│ [ Reject ] [  Start task  ] │ secondary + primary
```
- **Start task:** no confirmation, because it's easy to recover from and it's the expected next step [T]. A Toast confirms "Task started".
- **Reject:** opens a BottomSheet titled "Reject task" with the text "Tell your manager why you can't do this task.", a TextArea "Reason *", and a **Reject task** button (destructive, disabled until the reason isn't empty). Then a confirmation: "Reject this task? It will be removed from your list." On success the task leaves the list and the app goes back to My Tasks with the Toast "Task rejected".

**IN_PROGRESS**
```
│ Photos (2)                  │
│ ▢🗑 ▢🗑 ▢(other worker's)    │ own photos: delete button
│ [ 📷 Add photo ]            │ secondary, full width → S-009
│                             │
│ Notes (1)                   │
│ …                           │
│ ┌ Add a note…           ┐   │ TextArea (collapsed 1 line, grows)
│ └───────────────────────┘   │
│                  [ Add note ]│ secondary md, disabled while empty
├▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔┤
│ [     Complete task      ]  │ primary → S-010
│ At least 1 photo is required│ caption, shown only when 0 photos (button disabled)
```
- **Delete photo:** confirmation "Delete this photo? This can't be undone." → **Delete**. Success shows the Toast "Photo deleted".
- **Add note:** the text is posted, the field clears, the new note appears at the bottom, and the Toast "Note added" shows. A failure keeps the text and shows an inline error.
- Notes can't be edited or deleted, so there are no controls for that.

**COMPLETED**
- No ActionBar. A `successTint` banner reads "You completed this task on 16 Sep, 15:30."

### S-009 Field Evidence (Worker, full-screen modal)
```
Step 1 – permission (if needed)      Step 2 – camera                 Step 3 – preview
┌─────────────────────────────┐     ┌─────────────────────────────┐  ┌─────────────────────────────┐
│ ✕                           │     │ ✕                           │  │ ✕                           │
│                             │     │                             │  │                             │
│        📷 (48px)            │     │      live viewfinder        │  │      captured photo         │
│   Camera access needed      │     │                             │  │                             │
│ FieldMate uses the camera   │     │                             │  │                             │
│ to capture photo evidence   │     │                             │  │                             │
│ for this task.              │     │            ◯                │  │ [ Retake ]  [  Use photo  ] │
│ [        Allow         ]    │     │   (72dp shutter button)     │  │                             │
└─────────────────────────────┘     └─────────────────────────────┘  └─────────────────────────────┘

Step 4 – uploading                  Upload failed
┌─────────────────────────────┐     ┌─────────────────────────────┐
│      captured photo (dimmed)│     │      captured photo         │
│  ▓▓▓▓▓▓▓▓░░░░  62%          │     │ ⚠ Upload failed. Check your │
│  Uploading photo…           │     │   connection and try again. │
│  (buttons disabled, ✕ asks  │     │ [ Retake ]  [   Retry   ]   │
│   "Cancel upload?")         │     │                             │
└─────────────────────────────┘     └─────────────────────────────┘
```
- The camera screen is dark (black background, white controls) for visibility. The shutter is 72dp; the flash toggle and camera flip are 48dp [T].
- **Denied permission:** "Camera access is off. Turn it on in Settings to add photos." with **Open Settings**; the ✕ button goes back to S-008.
- **On success:** the modal closes, the Toast "Photo added" shows, and the new photo appears in the S-008 grid.
- **Leaving before uploading:** closing with a captured photo that hasn't been uploaded asks "Discard this photo?".
- **409 from the server** (e.g. the task was cancelled meanwhile): "This task can no longer be updated." with **Back to task**.
- **Offline:** **Use photo** is disabled and the text "You're offline. Connect to upload this photo." appears. The captured photo stays until the worker leaves the screen.

### S-010 Task Completion (Worker)
```
┌─────────────────────────────┐
│ ←  Complete task            │
├─────────────────────────────┤
│ Replace water meter at…     │ sectionTitle
│                             │
│ ┌─────────────────────────┐ │ Card: checklist summary
│ │ ✓ Photos        3       │ │ success icon (≥1) / error icon + "Required" (0)
│ │ • Notes         2       │ │ neutral (optional)
│ └─────────────────────────┘ │
│                             │
│ ℹ Once completed, you won't │ infoTint box
│   be able to add or delete  │
│   photos or notes.          │
├▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔┤
│ [  Back  ] [ Complete task ]│ secondary + primary (disabled if 0 photos)
└─────────────────────────────┘
```
- This screen is itself the confirmation, so there's no extra dialog [T].
- **On success:** a full-screen confirmation with a `checkmark-circle` icon (success, 64px), "Task completed", "Your manager has been notified." and **Back to task**, which returns to S-008 showing COMPLETED.
- **On 409:** an ErrorState with the server's message and **Back to task**, which also refreshes the task.

---

## 6. Screen state catalogue

Every state, with its exact wording. Messages are short, plain and never technical.

| State | S-001 | S-002 / S-006 | S-003 / S-007 | S-004 | S-005 / S-008 | S-009 | S-010 |
|---|---|---|---|---|---|---|---|
| **Loading** | Button spinner | Skeleton sections | 3 skeleton cards | Worker picker skeleton rows; Create button spinner | Detail skeleton | Camera starting: black + spinner; upload progress bar | Spinner on Complete |
| **Empty** | — | "No tasks right now" / per-section lines | S-003: "No tasks yet" (+ **Create task**); with filter: "No tasks with this status"; S-007: per section | Picker: "No field workers yet…" | "No photos yet." / "No notes yet." | — | — |
| **Error** | "Incorrect email or password" / "Something went wrong. Please try again." | ErrorState + **Try again** | ErrorState + **Try again**; if loading more fails: inline "Couldn't load more · Retry" | Field errors; submit failure Toast (error) + form kept | ErrorState + **Try again** | "Upload failed…" + **Retry** | Inline error + **Try again** |
| **Success** | Navigate to dashboard | — | — | Toast "Task created" / "Changes saved" | Toast per action | Toast "Photo added" | Success confirmation screen |
| **Disabled** | During submit | — | — | Save disabled until something changes; all fields while submitting | Buttons disabled while a request runs; Complete with 0 photos + reason line | Use photo while offline or uploading | Complete with 0 photos |
| **Permission denied** | — | Notification banner (see §7) | — | Location: inline prompt, typing still allowed | — | Camera PermissionPrompt | — |
| **Offline** | Banner; Login disabled with "Connect to the internet to log in." | Banner; cached data shown; no data cached → ErrorState "You're offline" | Banner; cached list | Banner; submit disabled | Banner; cached detail; action buttons disabled | Banner; upload disabled | Banner; Complete disabled |
| **Conflict 409** | — | — | — | Edit: "This task can no longer be edited." → back to detail | Dialog shows the server's message; refresh | "This task can no longer be updated." | Server message + **Back to task** |
| **Not available 403/404** | — | — | — | "This task is no longer available." | Full-screen EmptyState `lock-closed-outline`: "This task is no longer available" + **Go to dashboard** | Same | Same |
| **Session expired 401** | Shown on Login: "Your session has expired. Please log in again." | ← app-wide | ← | ← | ← | ← | ← |

**Standard messages**

| Case | Message |
|---|---|
| Unknown error or 500 | "Something went wrong. Please try again." |
| Network error during a request | "Couldn't connect. Check your connection and try again." |
| Validation (from the API, when there's no matching field) | The server's `message` |

---

## 7. Permission UX

| Permission | When asked | If denied |
|---|---|---|
| **Camera** | When S-009 opens (the first time the worker taps **Add photo**) | S-009 shows PermissionPrompt + **Open Settings**; no photo can be added |
| **Location** | When the manager taps **Use current location** on S-004 | Inline message; the address can still be typed; coordinates stay empty |
| **Notifications** | After the first successful login, when the dashboard loads. On iOS, a short explanation card comes first: "Get notified when tasks are assigned to you" (worker) / "…when tasks are completed" (manager), with **Turn on** / **Not now** | The app works normally. A dismissible info banner on the dashboard says "Notifications are off. Turn them on in Settings to hear about task updates." with **Open Settings**. Once dismissed, it stays hidden on that device [T] |

- On Android 13+, the system notification prompt appears when **Turn on** is tapped.
- On older Android, notifications are allowed by default.

---

## 8. Accessibility

Target: **WCAG 2.2 AA** as it applies to native apps [T].

| Area | Rule |
|---|---|
| Contrast | Text ≥ 4.5:1 (large text ≥ 3:1); icons and borders that carry meaning ≥ 3:1. Badge text uses the `*Text` tokens (§2.1). |
| Touch targets | ≥ 48×48 dp; `hitSlop` for smaller-looking icons; ≥ 8dp between targets. |
| Screen readers | Every interactive element has `accessibilityRole` and `accessibilityLabel`. A TaskCard is read as one label: "Replace water meter at Block C, status In progress, 14 Harbour Rd, assigned to Priya Nair". StatusBadge reads "Status: In progress". Photos read "Photo by Priya Nair, 16 September, 10:40"; the delete button reads "Delete photo by you". |
| States | `accessibilityState` for `disabled`, `busy` (loading), `selected` (filter chips, picker rows), `expanded` (sheets). A disabled Complete button includes the reason in `accessibilityHint`. |
| Announcements | Toasts, form errors, OfflineBanner and upload progress milestones (started, done, failed) are announced with `AccessibilityInfo.announceForAccessibility`. |
| Focus | Opening a dialog or sheet moves focus to its title; closing it returns focus to the button that opened it. The first invalid field gets focus after a failed submit. |
| Dynamic Type | Supported up to a 1.6× multiplier; layouts wrap instead of truncating important text; the ActionBar stacks its buttons vertically at large sizes. |
| Motion | Only standard platform transitions; with Reduce Motion on, sheets fade instead of sliding. |
| Forms | Labels are always visible (no placeholder-only fields); errors are text + icon, not only a red border; `autoComplete` / `textContentType` on email and password. |
| Colour | Status, errors and requirements are never shown by colour alone. |

---

## 9. Wording conventions [T]
- **Sentence case** everywhere: "Create task", not "Create Task".
- **Buttons are verbs** naming the result: "Complete task", "Reject task", "Use photo". Avoid "OK" and "Yes".
- **Destructive dialogs** name the action on the confirm button ("Cancel task") and give the safe option a clear name ("Keep task").
- **Status names** match the badges exactly: Assigned, In progress, Completed, Rejected, Cancelled.
- **No technical terms** in the UI: never "409", "token", "server" or "API".

---

## 10. Performance-related UI rules [C]
- Lists use `FlatList` / `SectionList` with stable `keyExtractor` and memoised `TaskCard`.
- Thumbnails use `expo-image` with caching. The grid requests small display sizes, and the full-size image loads only in the full-screen viewer.
- Skeletons are static blocks, not shimmer animations.
- Tapping an action button twice sends only one request (disabled while `loading`).

---

## 11. Handoff to implementation
- The tokens in §2 become `theme.ts` in Phase 6A.
- Components in §3 are built in Phase 6A/6D/6E as each is first needed, each with an RNTL test covering its states.
- The wording in §5–§7 becomes a `strings.ts` constants file (English only, no i18n library) [T].

---

## 12. Items needing approval

| # | Item | Why |
|---|---|---|
| A1 | **Accessible text shades** for status badges (§2.1): darker shades from the same colour families for text, while the spec colours stay for icons and borders. | Several spec colours are below WCAG AA contrast when used as small text. |
| A2 | **Supporting colour tokens** (§2.1): border, pressed, disabled, overlay, tints. | The spec's palette has no colours for these required UI states. |
| A3 | **Status → colour/icon mapping** (§2.2): Assigned = info, In progress = warning, Completed = success, Rejected = error, Cancelled = neutral. | Not defined in the spec. |
| A4 | **Light mode only, portrait only**; no dark mode or tablet layout. | Not requested in the spec; keeps scope tight. |
| A5 | **Components added beyond the spec's list:** OfflineBanner, Toast, ActionBar. | Needed for the offline and success states the spec requires, and for consistent action placement. |
| A6 | **Logout wording:** "This signs you out on all your devices." | Follows from the Q1 token-revocation decision. |
