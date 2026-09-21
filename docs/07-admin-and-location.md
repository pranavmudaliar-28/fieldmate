# FieldMate — Phase 7: Admin role & customer location

Status: **Draft for approval**
Date: 2026-09-21
Inputs: your issue list plus the decisions you made on 2026-09-21.

This phase adds the first new role since the original specification, and changes how a task's location is chosen. Both change product behaviour, so nothing is built until you approve this.

Tags: **[D]** your decision · **[T]** technical choice · **[Q]** open question (§6)

---

## 0. Already fixed (no approval needed)

**The description field could not be tapped.** The `Input` component replaced its own styling with whatever a caller passed, so any multi-line field — description, notes, reject reason — collapsed to zero width and swallowed taps. The styles are now merged, multi-line fields fill their box, and the text starts at the top. Covered by a regression test.

---

## 1. Customer location

Today a manager types a free-text address and can capture **their own** GPS position. As you pointed out, that is the wrong position: the task is at the **customer's** site.

### Decisions
| Decision | Choice |
|---|---|
| How a location is chosen | **Address search with suggestions, plus a map with a draggable pin** [D] |
| Provider | **Google Maps + Places** [D] |
| "Use my current location" | **Removed** [D] |

### How it will work (replaces docs/02 F-005)
1. The manager types in **Search address**; suggestions appear as they type.
2. Picking a suggestion fills the address and its coordinates, and drops a pin on a small map.
3. The pin can be **dragged** to correct the exact spot (a gate, a rear entrance); the address updates to match.
4. **Address and coordinates are now both required**, because a picked place always has both. (Today coordinates are optional.)
5. Workers still see the address and "Open in Maps"; the location remains a reference, never verified [D, unchanged].

### What this needs from you
- A **Google Cloud project** with **Places API**, **Geocoding API** and **Maps SDK for Android/iOS** enabled, and **billing enabled** (Google requires a card even within the free monthly allowance).
- Two API keys (one Android, one iOS), each restricted to our app identifiers.

### Cost and safety notes
- Google bills per session and per map load; a small team stays well inside the free allowance, but the account must exist.
- Keys restricted to our app identifiers; the keys live in the build configuration, never in the repository.
- Search requests go **from the app to Google directly** [T]; no customer address is sent anywhere else.

### Effect on existing data
Existing tasks keep their address; those without coordinates simply show no pin until they're edited.

---

## 2. Admin role

A third role, **ADMIN**, that runs the system.

### What an admin can do [D]
| Area | Allowed |
|---|---|
| Users | Create (any role), edit name/email/role, deactivate and reactivate, delete permanently |
| Passwords | Set a new password for any user (typed by the admin) |
| Sessions | Force sign-out on all of a user's devices |
| Tasks | Everything a manager can do — create, assign, edit, reassign, cancel, reopen, complete — plus see every task |

### Guardrails [D]
- An admin **cannot deactivate, delete or demote themselves**.
- The system **always keeps at least one active admin**; the action that would remove the last one is refused.
- **Deleting is only possible for a user with no history** (no tasks created, assigned, photographed or noted). The database already prevents the rest, and the app will say so plainly. Deactivating is the normal route.

### Deactivation [D]
- The user can no longer sign in, and their sessions end immediately (the existing revocation mechanism).
- **Their tasks stay assigned.** Managers see the worker marked "Inactive" on the task, and reassign when they choose.
- Deactivated workers **disappear from the assignment picker**, so no new work reaches them.

### First admin [D]
Created from the command line, exactly as today:
```sh
npm run user:create -w @fieldmate/api -- --email you@example.com --name "Your Name" --role ADMIN
```

### Where it lives in the app [D]
Admins land on a **Users** screen and can switch to the manager task screens.

**New screens** (the first additions beyond S-001…S-010):
| ID | Screen | Contents |
|---|---|---|
| S-011 | Users | Search and list of all users: name, email, role, active/inactive. "Add user" button. |
| S-012 | User details | One user's details and the actions: edit, reset password, force sign-out, deactivate/reactivate, delete. |
| S-013 | Add / edit user | Name, email, role; password on creation. |

Admins also see the existing manager screens (S-002…S-005), so their dashboard offers both "Users" and "Tasks".

---

## 3. What changes under the hood

### Database
| Change | Why |
|---|---|
| `user_role` enum gains `ADMIN` | The new role |
| `users.is_active` (boolean, default true) | Deactivation |
| Index on `users.role` | Filtering the user list |

Migration is additive, so existing rows are untouched: everyone stays active, and no current role changes.

### API (new endpoints, all admin-only)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/admin/users` | List and search users (paged) |
| POST | `/api/v1/admin/users` | Create a user |
| GET | `/api/v1/admin/users/:userId` | One user |
| PATCH | `/api/v1/admin/users/:userId` | Edit name, email, role, active |
| POST | `/api/v1/admin/users/:userId/password` | Set a new password |
| POST | `/api/v1/admin/users/:userId/sessions/revoke` | Force sign-out |
| DELETE | `/api/v1/admin/users/:userId` | Delete, when the user has no history |

**Changes to existing behaviour**
- Login refuses a deactivated account with the same "Incorrect email or password" message, so it reveals nothing [T].
- Every authenticated request re-checks that the account is still active.
- The worker picker returns **active** field workers only.
- Admins pass the manager permission checks for tasks.
- Task responses mark whether the assigned worker is still active, so managers can see it.

### Mobile
- A third route group for admins, with the Users screens.
- The existing task screens become available to both managers and admins.

---

## 4. Work plan

| Step | Content | Verified by |
|---|---|---|
| 7A | Database: `ADMIN` role, `is_active`, migration | Constraint and migration tests |
| 7B | API: admin endpoints, guardrails, deactivated-user rules | Integration tests for every rule, including the last-admin guard |
| 7C | Mobile: admin area, Users screens, admin navigation | Screen tests |
| 7D | Location: Google Places search, map pin, removal of the current-GPS button | Screen tests; a live check on your phone |
| 7E | Documentation and a final check of the whole flow | Full suite, live run |

Each step ends with a report, as in the earlier phases. Steps 7A–7C need nothing from you; **7D is blocked until the Google keys exist.**

---

## 5. What this does not include

Unless you ask for them: audit logs of admin actions, self-service password reset by email, user import/export, teams or regions, per-user permissions beyond the three roles, and admin control of tasks beyond what a manager can already do.

---

## 6. Open questions

| # | Question |
|---|---|
| Q1 | Do you want the admin's own role shown in the app header, so it's obvious which account is in use? (small, cosmetic) |
| Q2 | Should a deactivated user's name still appear on their old tasks and photos? (Recommended: yes — removing it would rewrite history.) |
| Q3 | For the Google keys: will you create the Google Cloud project, or should I write step-by-step instructions for it? |
