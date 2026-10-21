# UI QA findings: FieldMate mobile

**Run:** 2026-10-19, on branch `qa/ui-audit`.

**Design reference:** the claude.ai Design canvas "FieldMate — Mobile App UI" (66 boards at 390×844).

- `docs/04-ui-ux.md` predates the current Ink & Signal design, so the canvas decides visuals.
- `docs/02` and `docs/07` still decide product scope.

**Device:** Android emulator `fieldmate_qa` running API 35, Pixel 7 profile (1080×2400 at 420 dpi, which is 411×914 dp), with Expo Go 57.0.9.

- No physical phone was tested. Every "live" result below is from this emulator.

**Backend:** the local stack (Postgres, MinIO and the Express API) with the seed accounts. The existing dev data was used and never reset.

**Labels used in the tables:**

- **Live:** reproduced, then verified, on the emulator.
- **Static:** found by reading the design and the code only.
- **Unit:** covered by a Jest test.

Screenshots are in `qa/evidence/<area>/`, with `before-*` and `after-*` pairs where they exist.

## Fixed (verified on the emulator)

| ID   | Area                                 | Defect                                                                                      | Root cause                                                                                                                           | Fix                                                             | Commit        | Evidence                                    |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------- | ------------------------------------------- |
| I-1  | Every form                           | A field stayed styled as focused after you left it. Two fields could look focused at once.  | `{...inputProps}` was spread _after_ Input's own `onBlur`, so every react-hook-form `onBlur` replaced the handler that clears focus. | Handlers now run after the spread. Unit test added.             | 5356898       | `login/focus-*`, `login/after-focus-*`      |
| I-2  | Every form                           | The focus ring had square corners.                                                          | A padded translucent fill lost its corner radius on Android.                                                                         | The ring is drawn as a border.                                  | 5356898       | same                                        |
| L-1  | Login                                | Wrong credentials showed the API's text, "Incorrect email or password."                     | Server message used as the title.                                                                                                    | "Email or password is incorrect", as on S-Login-Error.          | 5356898       | `login/before-2`, `login/after-2`           |
| L-2  | Login                                | The password field wasn't marked on wrong credentials.                                      | Input could only go red together with an inline message.                                                                             | New `invalid` prop. Unit test added.                            | 5356898       | same                                        |
| P-1  | Photo grid                           | Showed 2 columns with an empty third on most phones.                                        | 3 × 31.9% + 2 × 8dp gap exceeds the row width below about 372dp.                                                                     | Cells are sized from the measured width.                        | 5356898       | `worker-detail/before-1`, `after-1`         |
| R-1  | Manager review                       | "Request changes" wrapped to two left-aligned lines.                                        | Button labels weren't centred; 20dp padding in a half-width button.                                                                  | Centred, shrinkable labels; 16dp padding.                       | bf78773       | `manager-detail/after-1`, `after-3`         |
| M-1  | Every sheet, dialog and menu         | The dim stopped at the status bar and the gesture bar.                                      | `Modal` without the translucent-bar props.                                                                                           | `statusBarTranslucent` and `navigationBarTranslucent`.          | bf78773       | `manager-detail/after-5`, `profile/after-3` |
| A-1  | Admin and manager action bars, forms | Edit user, Reactivate, Reassign, Reopen and Save sat label-width at the left of the bar.    | `fullWidth` is `alignSelf: stretch`, which is vertical in a row.                                                                     | `flex: 1` at each site.                                         | 666e8ef       | `admin/after-2`, `after-3`, `after-4`       |
| J-1  | Stepper                              | "In progress" touched "Submitted".                                                          | Labels exactly filled their columns.                                                                                                 | 2dp inset.                                                      | 5739971       | `worker-detail/after-2`, `after-3`          |
| D-6  | Task form                            | "Customer location *" used body text and a visual asterisk, unlike every other field label. | Its own label style.                                                                                                                 | Field-label style; "required" moved to the screen-reader label. | (this commit) | `manager-create/after-5-location-label`     |
| SS-1 | Stepper at 360dp                     | "Accepte / d", "Submitte / d".                                                              | Single words wider than a 57dp column.                                                                                               | Android hyphenation ("Ac-cepted").                              | dc8b448       | `small-screen/*`                            |
| FS-1 | Bell at 2.0× text                    | Unread count clipped.                                                                       | Fixed-height pill.                                                                                                                   | `minHeight`; count capped at 1.2×.                              | 90430db       | `font-scale/manager-dashboard-2x*`          |
| FS-2 | Tab badge at 2.0× text               | Count clipped.                                                                              | Same.                                                                                                                                | Same.                                                           | 90430db       | same                                        |
| T-1  | Toast                                | A new toast could be hidden early by the previous toast's timer.                            | Timers were never cleared. Found statically, confirmed by a unit test.                                                               | Each toast clears the previous timer.                           | 5356898       | `Toast.test.tsx`                            |

## Design alignment (from the static diff, checked on the emulator)

| Commit  | Changes                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ede3067 | **Tokens:** on-ink text, muted on-ink, control border, offline colours, disabled-fill label, page title 32/38, section heading 20/700, group title 17/700, radii 16/18/24, input height 52, tab inset 16, two-layer E1 shadow.<br>**Components:** list/detail badge sizes, flat cards in the flow, bordered stat tiles, smaller dashboard greeting, 48dp bell, dialog and sheet measurements, muted inactive tabs. |
| 5739971 | 60dp signal button, "Home" tab, heading sizes.                                                                                                                                                                                                                                                                                                                                                                     |
| 666e8ef | Reopen uses the secondary (outline) button.                                                                                                                                                                                                                                                                                                                                                                        |
| da43bcf | Note meta in Geist rather than Geist Mono.                                                                                                                                                                                                                                                                                                                                                                         |

## New features you asked for

| Feature                                | Commit  | Verified                                                                          |
| -------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| Toast Undo after a worker step on Home | 5356898 | Live: "I've arrived" → Undo → On the way, confirmed on the server.                |
| "All photos uploaded" checklist row    | 5356898 | Live for the uploaded state. The waiting state is unit-tested only (see Blocked). |
| Map thumbnail on the location card     | e0c4efc | Live.                                                                             |
| Combined "Submitted work" card         | da43bcf | Live.                                                                             |

## Deliberately not matched to the design

- **Ink 3 colour:** stays `#686D76`. The design's `#6B7079` is 4.48:1 on paper, below WCAG AA; `theme.test.ts` enforces 4.5.
- **In-progress text:** stays `#944700`. The design's `#9A4A00` is 5.37:1 on its tint; status badges must reach 5.4.
- **Tab labels:** stay 13px; the design uses 12. Nothing in the system goes below 13.
- **Sheet close button:** stays 44dp drawn, but its hit area remains at least 48dp.
- **Font weights:** capped at 700, your decision. The design's 650 maps to 600 and 750/800 to 700.
- **Review buttons:** equal widths. The design's 1 : 1.3 split only fits "Request changes" with zero padding.
- **Empty photos/notes:** still show their captions inside the work card, as `docs/04` and the existing test specify. The boards omit them.

## Open: needs a decision or more work

| ID  | Source  | Item                                                                                                                                                                                                                                                                                           |
| --- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | Decided | "Undo last step" now follows the W-Detail boards: icon, no underline (`Button` takes `underline={false}`). Verified on the emulator.                                                                                                                                                           |
| D-2 | Decided | Set password stays a bottom sheet (your call). The design shows a full screen.                                                                                                                                                                                                                 |
| D-3 | Decided | An inactive user now shows only Edit user and Reactivate, as on A-Reactivate. Verified on the emulator with a throwaway user, created and deleted again. An inactive user must be reactivated before they can be deleted.                                                                      |
| D-4 | Decided | The reviewer is already named where the API provides one ("Priya requested changes", "Approved by Anita Rao"). The task data has no "assigned by" person, so other copy keeps "your manager"; naming them would need an API change.                                                            |
| D-5 | Static  | The design's "+N" overflow tile on the photo grid isn't implemented; all photos show.                                                                                                                                                                                                          |
| D-7 | Static  | About 280 lower-severity spacing and size differences remain. Full lists: [qa/design-diff-shared-manager.md](design-diff-shared-manager.md) and [qa/design-diff-worker-admin.md](design-diff-worker-admin.md). These are static, written before the fixes; items fixed since are listed above. |
| —   | —       | Not built (your decision): "Use my location" and the draggable map, the in-form Reassign button, dark mode.                                                                                                                                                                                    |

## Blocked or not tested

- **Offline queue on device:** BLOCKED.
  - Airplane mode also cuts the emulator off from Metro, and Expo Go won't start a project offline.
  - The "photos waiting to upload" state is covered by a unit test only.
  - Recovery: a development build (`expo run:android`) loads its JS bundle without Metro, so airplane mode can be tested.
- **Camera capture and photo upload:** NOT TESTED.
  - Granting camera permission restarts Expo Go mid-flow.
  - The black thumbnails seen in testing are 160-byte placeholder JPEGs in the dev data, not a rendering bug.
- **Keyboard overlap:** NOT TESTED. agent-device types through its own input method, which draws no on-screen keyboard.
- **Opened later (2026-10-21) and passing:** Edit task, Add user (with validation), the admin Tasks tab, the worker Reject sheet and the Add note sheet.
- **A real photo renders correctly:** one real 356 KB upload in the dev data displays properly. The black tiles are the 160-byte placeholder images.
- **Landscape:** NOT TESTED. The app is portrait-only.
- **Physical phone:** NOT TESTED. Everything above is emulator-only.

## Incidents during testing (needs your input)

Two actions that can't be undone in the app happened on dev test tasks. I hadn't intended either, and the logs don't show a tap that caused them:

| When (local) | What happened                                        | Account                             | On the emulator at that moment                                                                          |
| ------------ | ---------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 18:03:00     | Task `56c2a661` ("Lifecycle probe") was **approved** | manager (`reviewed_by` = Anita Rao) | That task's Approve dialog was open. My Cancel tap had just failed as ambiguous (two "Cancel" matches). |
| 18:49:32     | Task `427f7630` was **accepted**                     | worker2                             | That task's Assigned screen, with "Accept task", was probably open.                                     |

**What both have in common:**

- I had just saved component files, so Fast Refresh ran.
- A screen offering exactly that action was showing.

**Conclusion:** my emulator session is the most likely source.

**Mechanism: unknown.**

- Neither screen has an effect that runs an action on mount.
- agent-device logs only failed commands.
- The API keeps no request log.

**Your phone:** it uses the same local API and database, so I can't fully rule it out. Were you using the app at 18:03 or 18:49?

**Why this matters:** if Fast Refresh, or the agent-device input method, can fire a focused or visible Pressable, that would only affect development. It is still worth a look before running more automation against real data. Both tasks were left as they are.

**Precaution I took afterwards:** I parked the emulator on Profile before every code edit. No task has changed since 18:50.

**Side effect of testing:** logging out bumps an account's `token_version`, which signs it out on every device. My switches between the four seed accounts will have signed them out on your phone too. Every user record is otherwise unchanged: same roles, all active.
