# UI screen inventory

This is every route in `apps/mobile/app/` (expo-router, Expo SDK 57) and how it fared in the 2026-10-19 QA pass. Defects and fixes are described in [qa/FINDINGS.md](qa/FINDINGS.md).

**Test setup:** live means tested on the Android emulator (API 35, 411×914 dp) in Expo Go, against the local API with the seed accounts.

**Status meanings:**

- **PASS:** opened through the real app flow, with its main controls exercised. Any defects found were fixed and re-verified.
- **PARTIAL:** opened, but part of it couldn't be exercised.
- **BLOCKED:** couldn't be exercised in this environment.
- **NOT TESTED:** not opened live.

**Design board:** the matching artboard on the claude.ai Design canvas.

## Shared

| Route                                      | Purpose                                    | Entry point         | Key interactions                                                   | Design board                             | Status                                                       |
| ------------------------------------------ | ------------------------------------------ | ------------------- | ------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------ |
| `index.tsx`                                | Session gate: splash, then the role's home | App launch          | —                                                                  | S-Splash                                 | PASS                                                         |
| `(auth)/login.tsx`                         | Sign in (S-001)                            | No session; Log out | Email and password, show password, wrong credentials, offline hint | S-Login, S-Login-Error, S-SessionExpired | PASS. Fixed L-1, L-2, I-1, I-2                               |
| Profile (each role's `(tabs)/profile.tsx`) | Identity, role, log out                    | Profile tab         | Log out confirm and cancel                                         | S-Profile                                | PASS. M-1 verified on its dialog                             |
| `(role)/notifications.tsx`                 | Inbox (S-014)                              | Bell                | Mark all read, open item                                           | S-Notifications, S-Notifications-Empty   | PASS for the manager list. Empty state not seen live         |
| Offline banner and toasts (`_layout.tsx`)  | Global feedback                            | Any screen          | Toast with Undo                                                    | S-Global                                 | PASS for toasts. Offline banner BLOCKED: Expo Go needs Metro |

## Field worker

| Route                                  | Purpose                                  | Entry point         | Key interactions                                                      | Design board                                      | Status                                                                                                                                              |
| -------------------------------------- | ---------------------------------------- | ------------------- | --------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `(worker)/(tabs)/index.tsx`            | Home (S-006)                             | Sign in as a worker | Current-task step button, toast Undo, new assignments                 | W-Home, W-Home-Empty                              | PASS: step and Undo verified on the server, at 2.0× text and on a 360dp screen. Empty state not seen live                                           |
| `(worker)/(tabs)/tasks.tsx`            | My tasks (S-007)                         | My tasks tab        | Sections, open a task                                                 | W-MyTasks                                         | PASS (viewed)                                                                                                                                       |
| `(worker)/tasks/[taskId]/index.tsx`    | Task details and journey (S-008)         | Task card           | Accept and Reject, steps, Undo last step, photos, notes, Open in Maps | W-Detail-_, W-InProgress_, W-RejectSheet, W-Note* | PASS: step, Undo and the map thumbnail. Fixed P-1, J-1, SS-1. The reject sheet and note edit/delete were not exercised live (unit tests cover them) |
| `(worker)/tasks/[taskId]/evidence.tsx` | Camera, gallery and note capture (S-009) | Add photo           | Camera permission, capture, preview, upload, offline queue            | W-Camera*, W-Preview, W-Uploading, W-UploadFailed | PARTIAL: permission screen seen. Capture BLOCKED (granting permission restarts Expo Go). Offline BLOCKED                                            |
| `(worker)/tasks/[taskId]/complete.tsx` | Submit for review (S-010)                | Submit for review   | Checklist, Back, Submit                                               | W-Submit, W-Sent, W-Locked                        | PASS for the checklist and the new uploads row. Submit not pressed, to keep data unchanged. The "waiting" state is unit-tested only                 |

## Manager

| Route                                | Purpose                         | Entry point          | Key interactions                                                       | Design board                                                                                  | Status                                                                                                                         |
| ------------------------------------ | ------------------------------- | -------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `(manager)/(tabs)/index.tsx`         | Overview (S-002)                | Sign in as a manager | Needs attention list, stat tiles, Create task, bell                    | M-Dashboard                                                                                   | PASS, including at 2.0× text. Fixed FS-1, FS-2                                                                                 |
| `(manager)/(tabs)/tasks.tsx`         | All tasks (S-003)               | Tasks tab            | Filter chips, open a task, +                                           | M-Tasks, M-Tasks-Empty                                                                        | PASS: filters and the Review empty state seen                                                                                  |
| `(manager)/tasks/new.tsx`            | Create task (S-004)             | Create task          | Fields, worker picker, location, discard prompt                        | M-CreateTask, M-WorkerPicker, M-Discard                                                       | PASS: form, focus and discard (no task created). Keyboard overlap NOT TESTED (the automation's input method shows no keyboard) |
| `(manager)/tasks/[taskId]/index.tsx` | Task details and review (S-005) | Task card            | Request changes sheet, Approve dialog, overflow menu, Reopen, Reassign | M-Detail-*, M-ApproveConfirm, M-RequestChanges, M-Overflow, M-Reopen/Reassign/Complete/Cancel | PASS: sheet, dialog, overflow and work card. Fixed R-1, M-1, A-1. See the approval incident in FINDINGS                        |
| `(manager)/tasks/[taskId]/edit.tsx`  | Edit task (BR-009)              | Overflow › Edit task | Form, save                                                             | M-EditTask                                                                                    | NOT TESTED live. Shares `TaskForm` with Create task                                                                            |

## Admin

| Route                              | Purpose                       | Entry point      | Key interactions                                            | Design board                                                                       | Status                                                                           |
| ---------------------------------- | ----------------------------- | ---------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `(admin)/(tabs)/index.tsx`         | Users (S-011)                 | Sign in as admin | Search, role chips, open a user                             | A-Users                                                                            | PASS (viewed)                                                                    |
| `(admin)/(tabs)/tasks.tsx`         | Tasks (pushes manager routes) | Tasks tab        | —                                                           | —                                                                                  | NOT TESTED live                                                                  |
| `(admin)/users/[userId]/index.tsx` | User details                  | User row         | Set password, force sign-out, deactivate, delete, Edit user | A-UserDetail, A-SetPassword, A-ForceSignOut, A-Deactivate, A-Reactivate, A-Delete* | PASS (viewed). Fixed A-1. Destructive actions deliberately not run on seed users |
| `(admin)/users/[userId]/edit.tsx`  | Edit user                     | Edit user        | Fields, role, Save disabled until changed                   | A-EditUser                                                                         | PASS (viewed; not saved)                                                         |
| `(admin)/users/new.tsx`            | Add user (S-013)              | Add user         | Form                                                        | A-CreateUser                                                                       | NOT TESTED live. Shares `UserForm` with Edit user                                |

## Cross-cutting checks

| Check                                      | Result                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Android system back                        | Closes sheets and menus, leaves detail screens, exits from a tab root (standard Android behaviour) |
| Text size 2.0× (Android's largest setting) | Layout holds. Badge clipping fixed (FS-1, FS-2)                                                    |
| Text size 3.2×                             | agent-device's maximum, beyond Android's own settings. Tab labels overflow; not pursued            |
| 360×640 dp screen                          | Holds. Stepper word-splitting fixed (SS-1)                                                         |
| Landscape                                  | Not applicable: the app is portrait-only                                                           |
| Physical Android phone                     | NOT TESTED. Everything here is emulator-only                                                       |
