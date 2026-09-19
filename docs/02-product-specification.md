# FieldMate — Phase 2: Product Specification

Status: **Draft for approval**
Date: 2026-09-16
Based on the Phase 1 Requirement Analysis and the decisions approved during Phases 1 and 2.

Tags: **[C]** confirmed in the original spec · **[D]** decided by the product owner · **[T]** technical choice that doesn't change product behaviour.

---

## 1. Product summary

FieldMate is a native iOS and Android app that connects task assignment with field execution. A **Manager** creates a task and assigns it to one **Field Worker**. The worker starts the task, captures photo evidence, adds notes and completes it. The manager can review the result, and can edit, reassign, cancel, reopen or complete the task.

There is one organisation. There is no self-registration: accounts are created by an administrator with a server seed/CLI script [D].

---

## 2. Roles

### 2.1 Manager
| Capability | Source |
|---|---|
| Log in and log out | [C] / [D] |
| See **all** tasks in the organisation | [D] |
| Create a task and assign it to exactly one worker | [C] / [D] |
| Edit a task's title, description and location (not when COMPLETED or CANCELLED) | [D] |
| Reassign a task to a different worker (ASSIGNED, IN_PROGRESS, REJECTED) | [D] |
| Cancel a task (ASSIGNED, IN_PROGRESS, REJECTED) | [D] |
| Reopen a COMPLETED task (back to ASSIGNED) | [D] |
| Complete an IN_PROGRESS task on a worker's behalf (needs at least 1 photo) | [D] |
| View task details, evidence and notes (view-only review) | [C] / [D] |
| Receive a push when a task is completed | [D] |

The manager **cannot** start or reject a task, upload or delete evidence, or add notes [C].

### 2.2 Field Worker
| Capability | Source |
|---|---|
| Log in and log out | [C] / [D] |
| See tasks currently assigned to them (active tasks plus a completed history) | [C] / [D] |
| Start an ASSIGNED task | [D] |
| Reject an ASSIGNED task with a required reason | [D] |
| Capture and upload photos while the task is IN_PROGRESS | [C] / [D] |
| Delete their own photos while the task is IN_PROGRESS | [D] |
| Add notes while the task is IN_PROGRESS (notes can't be edited or deleted) | [C] / [D] |
| Complete an IN_PROGRESS task (needs at least 1 photo) | [C] / [D] |
| Receive a push when a task is assigned or reassigned to them, or edited | [D] |

The worker **cannot** create, edit, assign, reassign, transfer, cancel or reopen tasks, or see tasks that aren't assigned to them [C] / [D].

---

## 3. Features

| ID | Feature | Scope in this release |
|---|---|---|
| F-001 | Authentication | Email and password login; logout; the session lasts 7 days with no refresh token, and the user logs in again when it expires; the server decides the role. No registration, password reset or email verification. |
| F-002 | Task Management | Create, view, list (with a status filter), edit (title, description, location), cancel, reopen. |
| F-003 | Task Assignment | One worker per task, assigned when the task is created; reassign before completion. |
| F-004 | Assigned Tasks | The worker's list of tasks assigned to them; start; reject with a reason. |
| F-005 | Field Location | A required typed address; optional latitude and longitude from a "Use current location" button; a reference only, never verified; "Open in Maps" hands off to the device's native Maps app. |
| F-006 | Photo / Field Evidence | Native camera only; preview, then retake or use; JPEG/PNG, compressed on the device, 10 MB maximum; several photos per task; the uploader can delete their own photos while the task is IN_PROGRESS. |
| F-007 | Notes | Several per task; append-only; the worker adds them while the task is IN_PROGRESS. |
| F-008 | Task Completion | Worker or manager; the task must be IN_PROGRESS and have at least 1 photo; completion is confirmed on S-010 or in a dialog. |
| F-009 | Notifications | Push through the Expo Push Service for the three triggers in §6.3. Tapping a push opens the task. No in-app notification inbox. |

---

## 4. Task lifecycle (business rules)

### 4.1 Statuses
| Status | Meaning |
|---|---|
| `ASSIGNED` | Created or reassigned, and waiting for the worker to start |
| `IN_PROGRESS` | The worker has started the field work |
| `COMPLETED` | Finished, with at least 1 photo |
| `REJECTED` | The worker declined; waiting for the manager to reassign or cancel |
| `CANCELLED` | Cancelled by a manager. **Final.** |

### 4.2 Transitions
```
            create (Manager)
                  │
                  ▼
   ┌────────── ASSIGNED ◄──────────── reassign (Manager) ◄─── REJECTED
   │              │  ▲                                           ▲
   │   start      │  │ reassign (Manager)                        │
   │  (Worker)    ▼  │                                           │
   │          IN_PROGRESS ─────────────────────── reject ────────┘ (from ASSIGNED only)
   │              │
   │   complete   │  (Worker or Manager; ≥1 photo)
   │              ▼
   │          COMPLETED ──── reopen (Manager) ───► ASSIGNED
   │
   └─ cancel (Manager) from ASSIGNED / IN_PROGRESS / REJECTED ──► CANCELLED (final)
```

| # | From | Action | To | Actor | Guard |
|---|---|---|---|---|---|
| T1 | — | Create | ASSIGNED | Manager | Title, description, address and worker are all valid |
| T2 | ASSIGNED | Start | IN_PROGRESS | Assigned worker | — |
| T3 | ASSIGNED | Reject | REJECTED | Assigned worker | Reason isn't empty |
| T4 | ASSIGNED, IN_PROGRESS, REJECTED | Reassign | ASSIGNED | Manager | The new worker is an existing FIELD_WORKER; in ASSIGNED or IN_PROGRESS they must differ from the current worker |
| T5 | IN_PROGRESS | Complete | COMPLETED | Assigned worker or Manager | The task has ≥1 photo |
| T6 | ASSIGNED, IN_PROGRESS, REJECTED | Cancel | CANCELLED | Manager | — |
| T7 | COMPLETED | Reopen | ASSIGNED | Manager | Same worker as before |

Any other status change is refused with a **409 Conflict** error.

### 4.3 Numbered business rules
| ID | Rule | Source |
|---|---|---|
| BR-001 | Only managers can create tasks. | C |
| BR-002 | Only managers can assign or reassign tasks; a task has exactly one current worker. | C / D |
| BR-003 | Workers can only see tasks currently assigned to them. Managers see all tasks. | C / D |
| BR-004 | Only the currently assigned worker can start, reject, add evidence to, or add notes to a task. | C / D |
| BR-005 | Photos can only be added while the task is IN_PROGRESS. A task can have several photos. | C / D |
| BR-006 | Notes can only be added while the task is IN_PROGRESS. Notes can't be edited or deleted. | C / D |
| BR-007 | Completing a task needs status IN_PROGRESS and at least 1 photo. The assigned worker or a manager can complete it. | C / D |
| BR-008 | A worker can only reject while the task is ASSIGNED, and must give a reason. | D |
| BR-009 | A manager can edit title, description and location unless the task is COMPLETED or CANCELLED. | D |
| BR-010 | A manager can cancel from ASSIGNED, IN_PROGRESS or REJECTED. CANCELLED is final. | D |
| BR-011 | A manager can reopen a COMPLETED task. It goes back to ASSIGNED with the same worker, who has to start it again. | D |
| BR-012 | Only the person who uploaded a photo can delete it, and only while the task is IN_PROGRESS. | D |
| BR-013 | Location is only a reference. The app never checks where the worker actually is. | D |
| BR-014 | Title, description, address and worker are required when creating a task. Latitude and longitude are optional. | D |
| BR-015 | The server enforces every rule above; the app's own restrictions are only there for usability. | C |

### 4.4 Consequences of the rules
- **Reassignment:** the previous worker immediately loses access to the task and it leaves their My Tasks list. The task's existing photos and notes stay on it. The previous worker's photos can no longer be deleted by anyone.
- **Reassigning an IN_PROGRESS task:** the status goes back to ASSIGNED, so the new worker has to start it.
- **Reopen:** existing photos and notes are kept. Once the worker starts the task again, they can add more photos, and delete their own.
- **Rejection history:** the rejecting worker's reason is kept with that assignment and shown to managers on Task Details.
- **Pushes that aren't sent:** reject, cancel and reopen don't send pushes, because they weren't chosen as triggers. Managers see rejected tasks in the dashboard's "Needs attention" list.

---

## 5. Screens

Every screen supports the states in §8. Only the screens S-001 to S-010 exist. Edit Task reuses S-004 in edit mode, and pop-ups (bottom sheets, dialogs, the full-screen photo viewer) don't count as screens.

### S-001 Login  *(both roles)*
- Content: "FieldMate", "Welcome back", Email, Password, a **Login** button.
- Validation: email format and a non-empty password, checked before submitting.
- A successful login routes by the role the server returns: Manager to S-002, Worker to S-006.
- Wrong credentials show "Incorrect email or password", without saying which field was wrong.
- If the stored session is still valid when the app opens, the user skips Login.

### S-002 Manager Dashboard
- Header: the user's name and a **Log out** action.
- A primary **Create task** button that opens S-004.
- **Needs attention:** REJECTED tasks, each showing the rejection reason. Tapping one opens S-005.
- **Recently completed:** the latest completed tasks [T: the 10 most recent].
- A **View all tasks** link to S-003.
- No counts, charts or analytics.

### S-003 Task List  *(Manager)*
- Status filter chips: All · Assigned · In progress · Completed · Rejected · Cancelled.
- Sorted by last updated, newest first. The list is paginated and loads more as the manager scrolls [T].
- Each TaskCard shows the title, StatusBadge, assigned worker's name and address.
- Pull to refresh. Tapping a card opens S-005.

### S-004 Create Task / Edit Task  *(Manager)*
- Fields:
  - **Title** (required)
  - **Description** (required, multi-line)
  - **Worker** (required; picker listing FIELD_WORKER users)
  - **Address** (required)
  - **Use current location** (optional)
- **Use current location:** asks for location permission, then fills in latitude and longitude and shows them as "Coordinates captured". The manager can clear them.
- Primary action: **Create task**. A successful create goes to S-005 of the new task and sends the worker a push.
- **Edit mode**, opened from S-005:
  - Title, description and address can be changed, and the "Use current location" coordinates can be captured again or cleared.
  - The worker field is hidden, because reassigning is a separate action.
  - Primary action: **Save changes**, which sends the assigned worker a push.
- Leaving with unsaved changes asks "Discard changes?" first.

### S-005 Task Details  *(Manager)*
Content:
- Title, StatusBadge, description.
- **Assignment:** the current worker's name and when they were assigned. For REJECTED tasks, the rejection reason and time.
- **Location:** the address, coordinates if any, and an **Open in Maps** link.
- **Evidence:** a photo grid showing who took each photo and when. Tapping a photo opens a full-screen viewer.
- **Notes:** a list with author and time, oldest first [T].
- **Timeline:** created, completed_at if set.

Actions (only those allowed in the task's current status are shown):

| Action | Shown when | UI |
|---|---|---|
| Edit | ASSIGNED, IN_PROGRESS, REJECTED | Opens S-004 in edit mode |
| Reassign | ASSIGNED, IN_PROGRESS, REJECTED | Bottom sheet with the worker picker, then a confirmation |
| Complete | IN_PROGRESS | Confirmation dialog; disabled with "At least 1 photo is required" when there are no photos |
| Reopen | COMPLETED | Confirmation dialog |
| Cancel task | ASSIGNED, IN_PROGRESS, REJECTED | Destructive confirmation dialog: "This can't be undone" |

### S-006 Worker Dashboard
- Header: the user's name and a **Log out** action.
- **In progress:** the worker's IN_PROGRESS tasks, shown first.
- **New assignments:** the worker's ASSIGNED tasks.
- A **View all my tasks** link to S-007.

### S-007 My Tasks  *(Worker)*
- Sections: **Active** (IN_PROGRESS first, then ASSIGNED) and **Completed** (history).
- Rejected, cancelled and reassigned tasks don't appear.
- TaskCard shows the title, StatusBadge and address.
- Pull to refresh, paginated. Tapping a card opens S-008.

### S-008 Worker Task Details
Content:
- Title, StatusBadge, description.
- Assignment: when it was assigned to them.
- Location: the address and **Open in Maps**.
- Evidence grid: the worker's own photos get a delete action while the task is IN_PROGRESS.
- Notes list, plus an **Add note** input while the task is IN_PROGRESS.

Actions by status:

| Status | Actions |
|---|---|
| ASSIGNED | **Start task** (primary) · **Reject** (bottom sheet with a required reason, then a confirmation) |
| IN_PROGRESS | **Add photo** (opens S-009) · Add note · Delete own photo (with confirmation) · **Complete task** (opens S-010; disabled until there's at least 1 photo) |
| COMPLETED | Read only |

### S-009 Field Evidence  *(Worker)*
1. Camera permission check. If permission was denied, show a PermissionPrompt with an **Open Settings** button.
2. Native camera viewfinder, then capture.
3. Preview with **Retake** and **Use photo**.
4. **Use photo:** compress the image, upload it, and show progress.
5. On success, go back to S-008 with the new photo in the grid. On failure, show an error with **Retry**; the captured photo is kept until the worker leaves the screen.

### S-010 Task Completion  *(Worker)*
- A summary: the task title, the number of photos (at least 1 required), the number of notes, and a reminder that completing can't be undone by the worker.
- Primary: **Complete task**. Secondary: **Back**.
- On success: a confirmation message, then back to S-008 showing COMPLETED, and managers get a push.
- If the server refuses because the task no longer allows it (for example it was cancelled or reassigned meanwhile), show the server's message and refresh the task.

---

## 6. User flows

### 6.1 Manager
```
Login ─► Manager Dashboard
          ├─► Create task ─► fill title/description/worker/address (+GPS) ─► Create
          │                   ─► Task Details (ASSIGNED)   [push → worker]
          ├─► Needs attention (REJECTED) ─► Task Details ─► Reassign | Cancel
          ├─► Recently completed ─► Task Details ─► review evidence/notes ─► Reopen?
          └─► View all tasks ─► Task List (filter) ─► Task Details
                                   ├─► Edit ─► Save            [push → worker]
                                   ├─► Reassign ─► pick worker  [push → new worker]
                                   ├─► Complete (IN_PROGRESS, ≥1 photo) [push → managers]
                                   ├─► Reopen (COMPLETED)
                                   └─► Cancel (final)
```

### 6.2 Field Worker
```
Push "New task assigned" ─┐
Login ─► Worker Dashboard ─┴─► My Tasks ─► Worker Task Details (ASSIGNED)
                                            ├─► Reject ─► reason ─► confirm ─► (task leaves list)
                                            └─► Start task ─► IN_PROGRESS
                                                   ├─► Open in Maps (native app)
                                                   ├─► Add photo ─► Field Evidence ─► capture ─► preview ─► use ─► upload
                                                   ├─► Add note
                                                   └─► Complete task ─► Task Completion ─► confirm ─► COMPLETED [push → managers]
```

### 6.3 Notifications
| Trigger | Recipient | Tap opens |
|---|---|---|
| Task created with this worker, or reassigned to them | The newly assigned worker | S-008 |
| Manager edits a task | The currently assigned worker | S-008 |
| Task completed (by the worker or a manager) | All managers [T: except the manager who completed it] | S-005 |

- **When the app asks for push permission:** right after the first successful login [T]. If the user declines, the app still works fully without pushes.
- **Device registration:** each login registers the device's push token, and logout removes it.
- **Delivery:** a push that fails to send never makes the task action fail [T].

---

## 7. Navigation

Built with Expo Router [C]. Each role has a separate stack, and access is controlled by the role in the session the server returns.

```
app/
├── (auth)/
│   └── login                       S-001
├── (manager)/                      guard: role === MANAGER
│   ├── index                       S-002 Manager Dashboard
│   ├── tasks/index                 S-003 Task List
│   ├── tasks/new                   S-004 Create Task
│   ├── tasks/[taskId]/index        S-005 Task Details
│   └── tasks/[taskId]/edit         S-004 (edit mode)
└── (worker)/                       guard: role === FIELD_WORKER
    ├── index                       S-006 Worker Dashboard
    ├── tasks/index                 S-007 My Tasks
    ├── tasks/[taskId]/index        S-008 Worker Task Details
    ├── tasks/[taskId]/evidence     S-009 Field Evidence (full-screen modal)
    └── tasks/[taskId]/complete     S-010 Task Completion
```

- **Signed-out users** are sent to Login. **Signed-in users** are sent to their role's dashboard, and a route belonging to the other role redirects there too.
- **Session expired:** a 401 from the server logs the user out and shows "Your session has expired. Please log in again."
- **Tapping a push** opens the task's details route. If the user is signed out, the app opens Login and then the task.
- **Access lost:** if the server returns 403 or 404 for a task (for example it was reassigned away), the app shows "This task is no longer available" with a link back to the dashboard.
- **Stack only:** there's no tab bar, because each role only has one dashboard and one list [T].

---

## 8. Application states

| State | Where | Behaviour |
|---|---|---|
| **Loading** | All data screens | Skeleton cards on lists; spinner on detail screens; a spinner inside a button when submitting |
| **Empty** | S-002 sections, S-003, S-006 sections, S-007, evidence and notes | Friendly text, e.g. "No tasks assigned yet", "No photos yet"; S-003 with a filter shows "No tasks with this status" |
| **Error** | Any failed request | A readable message, never technical details, with a **Retry** button; form errors appear next to each field |
| **Success** | Create, save, reassign, start, reject, cancel, reopen, complete, upload, add note, delete photo | Short toast or banner confirmation; the data refreshes |
| **Disabled** | Buttons while a request is running; Complete with 0 photos; actions not allowed in the current status | Greyed out, with a reason where it helps ("At least 1 photo is required") |
| **Permission denied** | Camera (S-009), location (S-004 GPS button), notifications | Explanation plus **Open Settings**; for location the manager can still type an address; for notifications the app works without pushes |
| **Network unavailable** | Global | An "You're offline" banner; buttons that need the network are disabled; the last loaded data stays visible; everything refreshes when the connection returns. No offline queue. |
| **Conflict (409)** | Status changes | Show the server's message (e.g. "This task was cancelled") and refresh the task |
| **Forbidden / not found** | Task routes | "This task is no longer available" with a way back |
| **Session expired (401)** | Global | Log out and return to Login with a message |

---

## 9. Validation rules (product level)

The server's checks are the ones that count [C]. The app runs the same checks before submitting.

| Field | Rule |
|---|---|
| Email | Required, valid email format |
| Password | Required |
| Task title | Required, 1–200 characters [T] |
| Task description | Required, 1–5000 characters [T] |
| Address | Required, 1–500 characters [T] |
| Latitude / longitude | Optional, but always both or neither; latitude between −90 and 90, longitude between −180 and 180 |
| Worker | Required; must be an existing FIELD_WORKER |
| Reject reason | Required, 1–1000 characters [T] |
| Note | Required, 1–5000 characters [T] |
| Photo | JPEG or PNG, 10 MB maximum after compression [D] |

Text is trimmed before checking, so a value that's only spaces counts as empty [T].

---

## 10. Out of scope for this release
- Registration, password reset, email verification, token refresh, account deletion, user management screens.
- Multiple workers per task; workers transferring tasks.
- Manager approve/reject review; manager notes or photos.
- Editing or deleting notes; photos from the gallery; file types other than photos.
- GPS verification, map SDKs, geocoding, route directions inside the app.
- Offline queue or sync; in-app notification inbox; pushes for reject, cancel or reopen.
- Analytics, dashboards with metrics, reports, exports.
- Chat, payments, marketplace, CRM, AI, general project management.
- Languages other than English.

---

## 11. Decision log

| # | Decision | Phase |
|---|---|---|
| D-01 | Statuses are ASSIGNED, IN_PROGRESS, COMPLETED, REJECTED, CANCELLED; a task is assigned when it's created | 1 |
| D-02 | A worker starts a task explicitly with "Start task" | 1 |
| D-03 | One worker per task; managers can reassign before completion; workers can't transfer | 1 |
| D-04 | One organisation; managers see all tasks | 1 |
| D-05 | Location: typed address plus optional GPS; reference only | 1 |
| D-06 | Completion requires at least 1 photo | 1 |
| D-07 | Several photos per task; the uploader can delete their own until completion | 1 |
| D-08 | Managers can edit, cancel and reopen; workers can reject | 1 |
| D-09 | Pushes: worker when assigned or reassigned; managers when completed; worker when the task is edited | 1 |
| D-10 | A rejected task is REJECTED and the manager reassigns it; a reopened task goes back to ASSIGNED | 1 |
| D-11 | Notes: several per task, append-only | 1 |
| D-12 | Accounts created by seed script; logout; 7-day token without refresh | 1 |
| D-13 | A manager can complete a task; the photo rule still applies; S3-compatible storage | 1 |
| D-14 | Reject only from ASSIGNED, with a required reason; cancelling is final | 1 |
| D-15 | iOS and Android; Expo Push; JPEG/PNG up to 10 MB, compressed on the device | 1 |
| D-16 | Manager Dashboard: Create button, Needs attention (REJECTED), Recently completed, link to all tasks | 2 |
| D-17 | Photos and notes can only be added while IN_PROGRESS | 2 |
| D-18 | My Tasks shows Active and Completed; rejected, cancelled and reassigned tasks are hidden | 2 |
| D-19 | Task List has status filter chips; "Open in Maps" links to the native Maps app | 2 |
| D-20 | Title, description, worker and address are required; coordinates are optional | 2 |
