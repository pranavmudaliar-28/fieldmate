# Design-to-code diff (part B): worker journey and admin boards

Design source: claude.ai Design artifact VUmQPdfi3GXbqPGm7QYSc2, boards `project/<name>.dc.html` (390x844, 1 CSS px = 1 dp).
Code: `C:\FieldMate\apps\mobile`. All paths below are relative to that folder. This is a static review: nothing was run.

Note on the spec: `docs/04-ui-ux.md` is the pre-"Ink & Signal" draft (blue primary, 52 dp buttons, radius 8/12, "notes can't be edited"). It is out of date for visuals, so it rarely makes a visual divergence intentional. `docs/02-product-specification.md` §F-004 and `docs/07-admin-and-location.md` still define scope: worker reject (sheet, then a confirmation) and admin deactivate, reactivate, force sign-out and delete are all in scope, **and all of them are implemented**.

## Systemic differences (apply to many boards; listed once here, not repeated per board)

- [med] [likely-defect] Primary/signal CTA size. Design: height 60, radius 16, 18px/750 label, 22px icon (worker journey CTAs, Submit, Preview, Sent, Camera permission). Code: `Button` lg is minHeight 56, radius 14 (`radius.action`), 17px semibold, 20px icon. In `src/components/Button.tsx`: lines 138 and 143, typography at 119, icon size at 86. Admin and sheet buttons are 56/14/17 in the design and do match.
- [med] [likely-defect] Ghost "Undo last step" is underlined. Design: 15px/650 ink, no underline, 18px icon, 44 high. Code: the `ghost` variant always underlines and uses 16px, minHeight 48. `src/components/Button.tsx:199`; used at `app/(worker)/tasks/[taskId]/index.tsx:183-193`.
- [low] [likely-defect] Disabled button colours. Design: bg #DEDBD3, label #5B5F66. Code: bg `border` #DEDBD3, label `textDisabled` #8D9199, which is lower contrast. `src/components/Button.tsx:148-149`.
- [med] [likely-defect] Status badge size. Design detail badge: height 30, padding 0 12 0 10, 14px/650, 16px icon. List badge: height 28, 13px/600, 16px icon. Code `Badge`: padding 8/4 (about 26 high), 13px semibold, 14px icon. `src/components/Badge.tsx:75-86` and `:63`.
- [med] [likely-defect] Section headings on the task screens ("What to do", "Photos · n", "Notes · n"). Design: 17px/700, count in 600 #4A4F57, gap 10 to the content. Code `Section`: cardTitle at fontSize 20 semibold, minHeight 48, gap 12. `src/features/tasks/TaskDetailView.tsx:416, 408-415`.
- [low] [likely-defect] Bordered cards versus shadowed cards. The design draws the stepper, location, note, detail-list and callout cards with a 1px #DEDBD3 border and no shadow, at radius 14-16 for small callouts. Code `Card` uses `elevation.card` shadow, no border, radius 20. `src/components/Card.tsx:65`, `src/features/tasks/WorkerJourney.tsx:115`, `TaskDetailView.tsx:209, 284`.
- [low] [likely-defect] Input fields. Design: height 52, unfocused border 1.5 #CFCBC1. Code: minHeight 56 (`layout.inputHeight`), border #DEDBD3. `src/components/Input.tsx:161-163`.
- [low] [likely-defect] Dividers inside grouped cards. Design #ECEAE4; code `colors.border` #DEDBD3. `src/components/TaskRow.tsx:92`, `app/(admin)/(tabs)/index.tsx:252`, `app/(worker)/tasks/[taskId]/complete.tsx:310`.
- [low] [likely-defect] Chevrons in list rows. Design #6B7079; code `textSecondary` #4A4F57. `src/components/TaskRow.tsx:63`, `app/(admin)/(tabs)/index.tsx:210`.
- [low] [likely-defect] Back arrow in the header. Design: 24px icon in a 48 box at x=12. Code: 26px icon, box pulled to x=8 (padding 20, margin -12). `src/components/AppHeader.tsx:64, 127`.

## W-Home → app/(worker)/(tabs)/index.tsx

- [med] [likely-defect] Greeting title size. Design 28/34, 700, -0.7. Code `size="large"` uses `typography.hero` 34/40, -1. `src/components/AppHeader.tsx:122`, `app/(worker)/(tabs)/index.tsx:98-103`.
- [low] [likely-defect] Eyebrow date. Design 14px/500. Code 15px regular. `src/components/AppHeader.tsx:120`.
- [low] [likely-defect] Bell. Design 48x48, 22px icon, badge 20 min with 12px/700 and a 2px paper (#F4F3EF) border at top -2 / right -4. Code 56x56, 24px icon, badge 24 with 13px and a white border at -4/-4. `src/components/NotificationBell.tsx:56-57, 38, 66-79`.
- [med] [likely-defect] Tab label. Design "Home". Code "Today". `app/(worker)/(tabs)/_layout.tsx:5`.
- [med] [likely-defect] Floating tab bar.
  - Design: inset 16 left/right and 28 from the bottom, radius 24, items 56 high at radius 18, inactive #C9CCD1, labels 12px (600 inactive, 700 active).
  - Code: inset 20, radius 28, item radius 20, inactive pure white `textOnInverse`, labels 13px.
  - `src/components/TabBar.tsx:112, 118, 128, 75, 134-138`.
- [med] [likely-defect] Status badge on the ink hero. Design (Arrived): solid #123F3D with #8FE3DA text, height 30, 14px/650. Code: text = status tint (#DDF3F1), fill = `${text}55` (translucent #0B6B67). `app/(worker)/(tabs)/index.tsx:188-193`.
- [low] [likely-defect] Hero title. Design 26/31, -0.6. Code `display` 28/34. `index.tsx:271`.
- [low] [likely-defect] Hero address and "Next:" line. Design #D3D5D9 at 16/22. Code `textOnInverseMuted` #A9ADB4 at 16/24, which is lower contrast. `index.tsx:273, 283`.
- [low] [likely-defect] Progress segments. Design height 6, inactive #33373E. Code height 5, inactive `borderInverse` #2A2D33. `index.tsx:278, 280`.
- [low] [likely-defect] Hero label. Design 13px/700, letter-spacing 1. Code `typography.label` semibold, 0.8. `index.tsx:269`.
- [med] [likely-defect] Spacing. Design: 20 between sections, 10 from the "New assignments" heading to its cards. Code: `spacing.section` 28 between sections, 12 within (plus the 48 minHeight on `SectionHeader`). `index.tsx:260-261`, `src/components/States.tsx:272`.
- [med] [likely-defect] "New assignments" heading. Design 20px/700, -0.3, count pill 24 high at 13px/800. Code `sectionTitle` 22/28 semibold, pill 28 high at 14px. `src/components/States.tsx:275-284`.
- [med] [likely-defect] Assignment card layout.
  - Design: one row, with a column of badge, title and address, and the chevron vertically centred on the right. Title 17px/650, address 14px with no pin icon.
  - Code `TaskCard`: chevron sits in the badge's top row, title is `cardTitle` 18/24, and a location-outline icon precedes the address.
  - `src/components/TaskCard.tsx:100-106, 53, 108, 62`.
- [low] [ambiguous] Gutter. Design: cards at 16 from the edge, header at 20. Code: 20 for everything. `index.tsx:260`.
- [low] [ambiguous] Extras with no design counterpart: `NotificationPrompt` (`:114`), and other under-way tasks listed after "New assignments" with no heading (`:146-154`).

## W-Home-Empty → app/(worker)/(tabs)/index.tsx (EmptyState)

- [med] [likely-defect] Emblem. Design: 148 circle (radius 999), 76px custom pin-with-check glyph, a 22px yellow dot at top-right. Code: 112 squircle (radius 28), 44px `checkmark-circle-outline`, no dot. `src/components/States.tsx:239-249, 112`; icon at `index.tsx:121`.
- [med] [likely-defect] Vertical position. Design centres the empty block vertically in the space above the tab bar. Code puts `EmptyState` at the top of a ScrollView whose content container has no flexGrow, so it sits under the header. `index.tsx:105-129`, `States.tsx:232-238`.
- [low] [likely-defect] Title. Design 26/32, 700, -0.5, margin-top 8. Code 22/28 bold. `States.tsx:250-255`.
- [low] [likely-defect] Message and spacing. Design message 17/25, gap 16, side padding 36. Code body 16/24, gap 12, side padding 24. `States.tsx:232-238, 256`.
- [low] [likely-defect] "See completed tasks" button. Design outline 48 high, radius 14, 16px/650. Code `secondary` at the default lg size (56, 17px). `States.tsx:125-130`; no `size="md"` is passed.

## W-MyTasks → app/(worker)/(tabs)/tasks.tsx (+ src/components/TaskRow.tsx)

- [low] [likely-defect] Title. Design 32/38, -0.8. Code `hero` 34/40. `tasks.tsx:117`, `AppHeader.tsx:122`.
- [med] [likely-defect] Section headers.
  - Design: 13px/700, letter-spacing 0.8, colour #2B2F36, 16px icon, padding 12/10. The count is 600 #4A4F57. The sticky "Active" header is full-bleed with a 1px #DEDBD3 bottom border.
  - Code: 15px label style, 18px icon, padding 20/12, inset by the 20 gutter, no border.
  - `tasks.tsx:132, 185-199`.
- [low] [likely-defect] Grouped card inset. Design margin 4/12/8, so the card sits 12 from the edge. Code 20 gutter. `tasks.tsx:184`.
- [low] [likely-defect] Row.
  - Design: emblem 40 at radius 12, title 16px/650, meta 13px, gap 3, padding 14/14/14/16.
  - Code: emblem 44, title 17px, meta 14/20, gap 2, padding 16/12, minHeight 72.
  - `src/components/TaskRow.tsx:102-108, 110-111, 93-100`.
- [low] [likely-defect] Row divider. Design runs full width in #ECEAE4. Code is inset 16 in #DEDBD3. `TaskRow.tsx:92`.

## W-Detail-Assigned → app/(worker)/tasks/[taskId]/index.tsx (+ TaskDetailView, WorkerJourney)

- [med] [likely-defect] Subline. Design "From Priya Sharma · 20 min ago" names the assigning manager. Code "Assigned 20 min ago" has no name. `src/features/tasks/TaskDetailView.tsx:332-333`.
- [med] [likely-defect] Stepper geometry and states.
  - Node: design 32, code 36 (`WorkerJourney.tsx:112`).
  - Current step: design adds an outer 4px #FFF1C2 halo around a full 32 yellow node. Code draws a 4px translucent-yellow border inside the 36 node (`:134-138`).
  - Labels: design 12/15 at 700 (current), 600 (done) or 500 (not yet). Code `caption` 13/16 with a single "strong" weight (`:140-146`).
  - Label gap: design 8, code 6 (`:117`). Done-node icon: design 16, code 18 (`:79`).
- [med] [ambiguous] Location card has no map preview. Design: a 110-high static map tile with a pin, then the address; the "Open in Maps" button is tonal (#ECEAE4, 44 high, 14px). Code: no map, a location-outline icon, a `secondary` md button (ink outline 48, radius 14), and the external-link icon placed before the label where the design puts it after. `src/features/tasks/TaskDetailView.tsx:280-323`.
- [low] [likely-defect] Spacing. Design: content gap 18, header-block gap 10. Code: 20 and 12. `TaskDetailView.tsx:383-384`.
- [low] [likely-defect] "What to do" body colour. Design #2B2F36. Code `textPrimary`. `TaskDetailView.tsx:418`.
- [low] [ambiguous] Extra footnote "Created …" at the bottom; not in the design. `TaskDetailView.tsx:180-183`.
- [low] [likely-defect] Action bar.
  - Design: Reject fixed at 112 wide, both buttons 60 high at radius 16; Accept label 18px/750; bar padding 12 20 34, gap 10.
  - Code: Reject `flex: 0.6` (about 128 wide), buttons 56 high, bar padding-top 16, gap 12.
  - `index.tsx:673, 348-366`, `src/components/ActionBar.tsx:64-69`.

## W-RejectSheet → app/(worker)/tasks/[taskId]/index.tsx:532-570 (+ BottomSheet, ChoiceList)

Implemented, and in scope (docs/02 F-004, BR-008).

- [low] [ambiguous] Lead copy. Design "Priya gets your reason…" (manager's first name). Code "Your manager gets your reason and can reassign the task." Lead is also 16/24 in code versus 15/22. `index.tsx:539-541, 679`.
- [low] [ambiguous] Initial selection. The design pre-selects "Clashes with another job". Code starts with nothing selected, so the submit button starts disabled. `index.tsx:90`.
- [low] [likely-defect] Reason rows.
  - Design: 52 high, padding 0 14, gap 12, 16px/600. Selected border is 2px ink, unselected 1.5 #DEDBD3. Radio 22 with a 10 dot, unselected ring #9A9EA5.
  - Code: minHeight 56, padding 16, 17px. Selected border stays 1.5. Radio 24 with a 12 dot, ring #686D76.
  - `src/components/ChoiceList.tsx:84-96, 98-110`.
- [low] [likely-defect] Sheet chrome. Design: handle 40x5 #CFCBC1, close 44 with an 18px icon, sheet gap 14. Code: handle 44x5 #DEDBD3, close 48 with a 20px icon, gap 16. `src/components/BottomSheet.tsx:91-98, 113-120, 70`.
- [low] [likely-defect] "Details · optional" label. Design renders "· optional" at 500 in #4A4F57. Code renders the whole label in one style. The textarea border is #CFCBC1 in the design, #DEDBD3 in code. `index.tsx:549`.
- [low] [ambiguous] Code adds a confirmation dialog after the sheet ("Reject task"); no board for it. docs/02 §F-004 requires a confirmation, so this is intentional. `index.tsx:572-595`.

## W-Detail-Accepted → app/(worker)/tasks/[taskId]/index.tsx

- [low] [likely-defect] Subline. Design "From Priya Sharma · accepted 5 min ago". Code "Accepted 5 min ago" (no manager name). `TaskDetailView.tsx:334-335`.
- [med] [likely-defect] "Open in Maps" placement. Design: an outline 48 button, radius 12, 15px, **inline to the right of the address**, with a trailing external-link icon. Code: a separate row below the address, leading icon. `TaskDetailView.tsx:284-321`.
- [low] [likely-defect] Secondary row. Design: undo and "Reject task" at 15px/650, 44 high, gap 6 below the CTA. Code: md buttons (16px, minHeight 48), stack gap 4. `index.tsx:382-396, 674`.
- (Map preview and stepper findings from W-Detail-Assigned apply here too.)

## W-Detail-OnTheWay → app/(worker)/tasks/[taskId]/index.tsx

- [low] [ambiguous] Subline. The design has none under the title. Code shows "address · details". `TaskDetailView.tsx:336-338`.
- [low] [ambiguous] The design omits "What to do"; code always renders the description. This may only be because the board crops it.

## W-Detail-Arrived → app/(worker)/tasks/[taskId]/index.tsx

- [low] [likely-defect] Tip callout.
  - Design: 1px #DEDBD3 border, radius 16, padding 14 16, 15/22 text at regular weight, 20px icon.
  - Code: 1.5 border, radius 20, padding 16, 16/24 text (`calloutBodyStrong`), 22px icon.
  - `index.tsx:701-713, 643`.
- [low] [ambiguous] The design shows no location card on this state (tip, then "What to do"). Code shows the location card. `TaskDetailView.tsx:170`.

## W-InProgress-NoPhotos → app/(worker)/tasks/[taskId]/index.tsx

- [low] [likely-defect] Title size. In the in-progress, locked and completed states the design title is 24/30, -0.5. Code is always `display` 28/34. `TaskDetailView.tsx:385`.
- [low] [likely-defect] "Add your first photo" tile.
  - Design: fixed 168 high, white fill, 2px dashed ink border, mark 64 at radius 20, title 18px/700, gap 10.
  - Code: paddingVertical 32 with transparent fill (the paper shows through), mark 72, `cardTitle` semibold, gap 8.
  - `index.tsx:680-700`.
- [low] [likely-defect] "Add note" button. Design 44 high, padding 12, radius 12, 15px/650, 18px "+" icon. Code `secondary` md (48, radius 14, 16px, padding 20). `index.tsx:310-318`.
- [low] [likely-defect] Empty notes text. Design 15px. Code 14px. `index.tsx:669`.
- [med] [likely-defect] Submit hint and disabled CTA.
  - Hint: design 14px/600 in #2B2F36. Code 14 regular in `textSecondary`. `src/components/ActionBar.tsx:68`.
  - Disabled CTA: design label #5B5F66. Code #8D9199 (see the systemic disabled-colour finding).
  - Copy: the design has no trailing period ("…submit for review"). Code adds one. `index.tsx:50`.

## W-InProgress → app/(worker)/tasks/[taskId]/index.tsx (+ PhotoGrid, NoteList)

- [low] [likely-defect] "Changes requested" callout.
  - Design: bg #FFF6E6, border **2px** #C26A00, radius 18, padding 14, title 14px/700 in #7A3A00, body 16/23 in #2B2F36.
  - Code: bg `warningTint` #FDEBD3, border 1.5 #B85A00, radius 20, padding 16, title `warningText` #944700.
  - `TaskDetailView.tsx:390, 400-402`.
- [med] [likely-defect] Photo tile delete button. Design: 36 circle at top/right 4, rgba(15,17,21,0.82). Code: 32 circle at 6, `scrim` at 0.55 opacity, which reads weaker over a bright photo. `src/components/PhotoGrid.tsx:140-150`.
- [low] [likely-defect] Photo tile details. Design: radius 12, tile 104 high, source chip at 6/6, 24 high, 12px, 13px icon. Code: radius 14 (`radius.action`), square cells, chip at 8/8 with 13px text and 14px icon. `PhotoGrid.tsx:116-139`.
- [med] [likely-defect] Note card.
  - Design: 1px border, radius 16, padding 12 6 12 14, text 15/22, meta "11:52 · **edited**" in 13px with "edited" at 700 #2B2F36 and no author. Edit/delete targets are 44 at radius 12.
  - Code: shadowed Card at radius 20, body 16/24, and meta in **Geist Mono** with the author's first name ("Rahul · 11:52 · edited"), "edited" not emphasised. Targets are 48.
  - `TaskDetailView.tsx:209-219, 422-432`.
- [low] [likely-defect] "Add photo" header button. Design 44 high, radius 12, 15px. Code `primary` md (48, radius 14, 16px). `index.tsx:259-266`.

## W-NoteAdd → app/(worker)/tasks/[taskId]/index.tsx:418-459

- [low] [ambiguous] Label. Design "Note for Priya" (manager's first name). Code "Note for your manager". `index.tsx:426`.
- [low] [likely-defect] Textarea. Design 17/25 text, 5 rows. Code body 16/24, minHeight 120. Counter: design 13px #4A4F57, right-aligned. Code mono in `textTertiary`. `index.tsx:670`, `Input.tsx:185`.

## W-NoteEdit → app/(worker)/tasks/[taskId]/index.tsx:461-504

- [low] [likely-defect] "Saved changes show an 'edited' label…" note. Design: a standalone row between the field and the button, info icon 18, 14/20 in #2B2F36. Code: passed as the Input `helper` (13px caption in `textSecondary`, no icon). `index.tsx:471`, `Input.tsx:184`.
- [low] [ambiguous] Copy. Design "…label to Priya." Code "…label to your manager." `index.tsx:471`.

## W-NoteDelete → app/(worker)/tasks/[taskId]/index.tsx:506-530 (+ ConfirmationDialog)

- [low] [likely-defect] Body. Design: the quoted note sits in a paper box (#F4F3EF, padding 12 14, radius 12, 15/22 in #2B2F36), with **no** "This can't be undone." Code: plain body text `“…” This can't be undone.` at 16px `textSecondary`. `index.tsx:509`, `src/components/ConfirmationDialog.tsx:137`.
- [low] [likely-defect] Dialog chrome. Design: inset 20, radius 24, emblem 48, buttons 52. Code: overlay padding 24, radius 28, emblem 52, buttons 56. `ConfirmationDialog.tsx:113, 119, 124-131`. This applies to every dialog board.

## W-CameraPermission → app/(worker)/tasks/[taskId]/evidence.tsx (Explainer)

- [low] [likely-defect] Background. Design #0C0D10. Code `surfaceInverse` #0F1115. `evidence.tsx:604`.
- [low] [likely-defect] Close button. Design 48, bg #1E2026, 22px icon. Code 52, bg rgba(255,255,255,0.12), 24px icon. `evidence.tsx:621-628, 546`.
- [low] [likely-defect] Mark and title. Design mark 104 at radius 32 with a 52px icon; title 32/38, -0.8. Code mark 112 at radius 28 with a 44px icon; title `hero` 34/40. `evidence.tsx:637-645, 492, 659`.
- [low] [likely-defect] Body colour. Design #C9CCD1. Code #A9ADB4. `evidence.tsx:664`.

## W-CameraDenied → app/(worker)/tasks/[taskId]/evidence.tsx (Explainer, denied)

- [low] [likely-defect] Gallery link copy. Design "Pick from gallery". Code always "Pick from gallery instead". `evidence.tsx:187`.
- [low] [likely-defect] Danger colour. Design #E5484D for the border and strike, which is brighter on ink. Code `toneColors.error.dot` #C8291C. `evidence.tsx:649, 656`.
- [low] [likely-defect] Step numbers. Design: 28 **circles**, 14px/700. Code: 32 squircles (radius 12). `evidence.tsx:667-675`.
- [low] [likely-defect] "Open Settings". Design 60 high, radius 16, #F3F2EE, 18px/700. Code 56, radius 14, #F4F3EF, 17 semibold. `evidence.tsx:686-694`.

## W-Camera → app/(worker)/tasks/[taskId]/evidence.tsx (camera-view)

- [med] [likely-defect] Missing framing guide and top scrim. The design has a 310x400 rounded guide (2px rgba(255,255,255,0.6), radius 18) and a 150-high top scrim at rgba(0,0,0,0.45). Code has neither; the bottom bar is rgba(15,17,21,0.72) where the design uses a 200-high rgba(0,0,0,0.6). `evidence.tsx:395-456, 784-795`.
- [low] [likely-defect] Gallery button. Design 56x56 at radius 14 showing the **last photo thumbnail**. Code 64x64 with an `images-outline` icon. `evidence.tsx:805-815, 435`.
- [low] [likely-defect] Shutter. Design 84 with a 64 inner disc. Code 88 / 68. `evidence.tsx:816-832`.

## W-Preview → app/(worker)/tasks/[taskId]/evidence.tsx (photo-preview)

- [med] [likely-defect] Top-left button. Design "Back to camera" returns to the viewfinder. Code labels it "Back" and calls `close()`, which opens "Discard this photo?" and then leaves the screen altogether. `evidence.tsx:310, 79-85`.
- [low] [likely-defect] Photo frame and chip. Design: frame 520 high, radius 24, margin-top 8; source chip at 12/12, 32 high. Code: frame `flex:1`, radius 28, margin-top 24; chip at 16/16. `evidence.tsx:695-716`.
- [low] [likely-defect] Button row. Design columns 1fr / 1.4fr, gap 10, both 60 high at radius 16. Code flex 1 / 1.3, gap 12, both 56 at radius 14. `evidence.tsx:755-768`.

## W-Uploading → app/(worker)/tasks/[taskId]/evidence.tsx (upload-progress)

- [med] [likely-defect] Missing "Back to task" button. The design keeps a 60-high light button so the worker can leave while the upload continues. Code renders no action at all while uploading. `evidence.tsx:274-302`.
- [med] [likely-defect] Progress indicator. Design: a 112 circular ring (track #33373E, fill #FFC21A, stroke 8) with 26px/700 % inside, and "Uploading…" at 20px/700. Code: `hero` 34px %, an 8-high linear bar, and "Uploading… keep this screen open" at 16px. `evidence.tsx:284-298, 729-739`.

## W-UploadFailed → app/(worker)/tasks/[taskId]/evidence.tsx (photo-preview, failed)

- [low] [ambiguous] Buttons. Design shows a single full-width "Retry" (signal). Code shows "Retake" plus "Retry". docs/04 §S-009 specifies Retake plus Retry. `evidence.tsx:356-374`.
- [low] [likely-defect] Failure styling.
  - Frame: design has a 3px #E5484D outline. Code has none.
  - Mark: design is a solid 72 #E5484D circle with a white 34px cloud-off icon. Code is a 64 circle at rgba(200,41,28,0.2) with a #C8291C 30px icon.
  - Body: design #D3D5D9. Code #A9ADB4.
  - `evidence.tsx:740-753, 695-702`.
- [low] [likely-defect] Header button. Design: a close "X" labelled "Close". Code: chevron-back labelled "Back". `evidence.tsx:310`.

## W-Submit → app/(worker)/tasks/[taskId]/complete.tsx

- [med] [likely-defect] Missing third checklist row, "All photos uploaded" (green Done). Code has only the photos and notes rows. This matters with the offline queue, where photos can still be pending. `complete.tsx:89-110`.
- [low] [likely-defect] Title and lead. Design title 30/36, -0.8; lead 16/24. Code `display` 28/34; lead 17/26. `complete.tsx:301-302`.
- [low] [likely-defect] Checklist rows.
  - Design: mark 36 with an 18px icon, padding 16, gap 14, title 17px/650, status 13px/700.
  - Code: mark 40 with a 20px icon, minHeight 76, gap 12, `cardTitle` 18, status 14 semibold.
  - `complete.tsx:311-328, 200`.
- [low] [likely-defect] Info box. Design: text 15/22 at 500 in #0A3D73, radius 16, padding 14 16. Code: body 16/24 in `infoText` #0B5CAD, radius 20, padding 16. `complete.tsx:329-336`.
- [low] [ambiguous] Copy. Design "Priya will review…" and "If Priya asks…". Code "Your manager…". `complete.tsx:84, 115`.
- [low] [likely-defect] Button split. Design 1fr / 2fr. Code flex 0.8 / 1.4. `complete.tsx:338-339`.

## W-Sent → app/(worker)/tasks/[taskId]/complete.tsx (SentForReview)

- [low] [likely-defect] Missing decoration: concentric yellow rings behind the mark (opacity 0.14). `complete.tsx:229-255`.
- [low] [likely-defect] Mark sizes. Design: mark 120 with a 12px halo (144 overall) and a 60px icon. Code: mark 136, halo 176, 48px icon. `complete.tsx:348-364, 235`.
- [med] [likely-defect] "Awaiting review" badge on ink. Design: solid #2F2145 with #CDB0FF text, 32 high, 14px/650. Code: text #EFE6FD on translucent `#6B2FBF55`. `complete.tsx:249-254`.
- [low] [likely-defect] Secondary text colour. Design #C9CCD1. Code `textOnInverseMuted` #A9ADB4. `complete.tsx:370, 387`.
- [low] [likely-defect] "Back to home". Design 60 high, radius 16, 18px/700. Code 56, radius 14, 17px. `complete.tsx:388-396`.
- [low] [ambiguous] Copy. Design "Priya has been notified…". Code "Your manager has been notified…". `complete.tsx:246`.

## W-Locked → app/(worker)/tasks/[taskId]/index.tsx (AWAITING_REVIEW)

- [low] [likely-defect] Photo grid. Design uses **4 columns** in the locked state. Code always uses 3 (`width: '31.9%'`). `src/components/PhotoGrid.tsx:116`.
- [low] [likely-defect] "Locked while your manager reviews" callout. Design: radius 16, padding 14 16, 20px icon, title 16px/700, body 14/20. Code: radius 20, padding 16, 22px icon, title 17 semibold, body 15. `index.tsx:701-712`.
- [low] [likely-defect] Note card. Design: border, radius 14, padding 12 14, 15/22, meta without author. Code: shadowed Card with author, in mono (as in W-InProgress). `TaskDetailView.tsx:209-219`.

## W-Completed → app/(worker)/tasks/[taskId]/index.tsx (COMPLETED)

- [med] [likely-defect] Structure and order.
  - Design: header, approved banner, compact address card (no Maps button), Photos, Notes. **No stepper.**
  - Code: renders the stepper, then the banner, Photos, Notes, then the full location card with "Open in Maps" (location comes after the photos), then the description and footnote.
  - `TaskDetailView.tsx:106, 155-178`; WorkerJourney only hides for REJECTED/CANCELLED at `WorkerJourney.tsx:26`.
- [low] [likely-defect] Approved banner. Design: radius 16, padding 14 16, mark 36 with an 18px icon, text 16px/650 in #14532D. Code: radius 20, padding 16, mark 44 with a 22px icon, 17px in #1B6B3A. `index.tsx:714-730`.

## A-Users → app/(admin)/(tabs)/index.tsx

- [low] [likely-defect] User count position. Design: next to the title (15px/600 #4A4F57, baseline-aligned). Code: inside the search field, in mono. `index.tsx:92-96, 236`.
- [low] [ambiguous] Extras not in the design: the bell beside "Add user" (`:64`) and the role filter chips All/Workers/Managers/Admins (`:100`).
- [low] [likely-defect] Search field. Design 52 high, border #CFCBC1, padding 14, gap 10. Code 56, #DEDBD3, 16, gap 8. `index.tsx:219-229`.
- [med] [likely-defect] Rows.
  - Design: list card inset 12 from the screen edge, row padding 12/12/12/14, avatar **44**, name 16px/650, email 13px, gap 4, tag gap 8.
  - Code: 20 gutter, padding 16, avatar forced to **52** (`styles.avatar`), name 17, email 14, gap 2, tag gap 12.
  - `index.tsx:237, 239-259, 254`.
- [low] [likely-defect] Role tag. Design: radius 6, 24 high, 12px/650 in #2B2F36, 13px icon. Code: neutral `Badge` (radius 8, 13px in #4A4F57, 14px icon). Status: design 12px/650 with an 8 dot. Code `ActiveMark`: 14 semibold, 9 dot. `index.tsx:206-207`, `src/features/admin/ActiveMark.tsx`.
- [low] [likely-defect] Card shadow. Code applies `elevation.card` to the last row only, so the card's shadow is uneven; the design shadows the whole card. `index.tsx:247-251`.

## A-UserDetail → app/(admin)/users/[userId]/index.tsx

- [low] [likely-defect] Header. Design: avatar 68 with 24px initials, name 26/30, -0.6, gap 6. Code: avatar 80, `display` 28/34, gap 8. `index.tsx:556, 558, 557`.
- [low] [likely-defect] Detail list. Design: border only, padding 14 16, label 13px, value 16px/600. Code: border plus shadow, padding 12 16, label 14, value 17. `index.tsx:571-582`.
- [low] [likely-defect] Action rows. Design: minHeight 56, gap 14, label 16px/600 (Deactivate 650), detail 13px/500. Code: 60, gap 12, label 17, detail 14 regular. `index.tsx:583-594`.
- [low] [likely-defect] Content gap. Design 18. Code 16. `index.tsx:551`.

## A-SetPassword → app/(admin)/users/[userId]/index.tsx:286-374 (BottomSheet)

- [med] [ambiguous] Presentation. Design: a full pushed screen with a back arrow, an in-page title "Set password" (28/34), a 16/24 lead, and "Save password" in a fixed bottom action bar. Code: a BottomSheet (22px title, 14px lead `sheetLead`, button inside the sheet). `index.tsx:286-296, 596`.
- [low] [likely-defect] Fields. Design: password input 52 high, mono 16px. Code: 56 high, mono **17px**. Info note: design padding 14. Code 16. `index.tsx:597, 606-616`.

## A-ForceSignOut → app/(admin)/users/[userId]/index.tsx:376-394

- [low] [likely-defect] Dialog chrome only (radius 28 vs 24, emblem 52 vs 48, buttons 56 vs 52). See W-NoteDelete. Copy, ink confirm button and neutral emblem match.

## A-Deactivate → app/(admin)/users/[userId]/index.tsx:396-406

Implemented (docs/07 §Deactivation).

- [med] [likely-defect] Confirm styling. Design: **ink** (non-destructive) "Deactivate" button and a **warning** emblem (#FDEBD3 bg, #9A4A00 icon). Code passes `destructive`, so the button is red and the emblem error-tinted. `index.tsx:401`, `ConfirmationDialog.tsx:94`.
- [low] [ambiguous] Copy. Code adds "and open tasks stay assigned until a manager reassigns them". Design: "Past tasks and photos stay as they are. You can reactivate at any time." `index.tsx:399`.

## A-Reactivate → app/(admin)/users/[userId]/index.tsx (inactive state)

Implemented.

- [med] [ambiguous] Actions shown for an inactive user. The design shows only a standalone "Edit user" row card plus the Reactivate CTA. Code still lists "Set password", "Force sign-out" and "Delete permanently" for an inactive user. `index.tsx:201-257`.
- [low] [likely-defect] "Sign-in turned off" banner. Design: white bg, **1.5 dashed #9A9EA5** border, radius 16, padding 14 16, 20px icon, title 16px/650. Code: `surfaceMuted` fill, no border, radius 20, 22px ban icon, title 17. `index.tsx:560-569, 177`.
- [low] [likely-defect] Action-bar hint. Design: centred 13px text, no icon. Code: left-aligned 14px with an info icon. `index.tsx:262-266`, `ActionBar.tsx:45-52, 67-68`.
- [low] [ambiguous] Code shows a "Reactivate …?" confirmation; the design reactivates directly. `index.tsx:408-418`.

## A-DeleteConfirm → app/(admin)/users/[userId]/index.tsx:420-435 (cantDelete)

- [low] [likely-defect] Body. Design has two paragraphs: a 16px "…can't be deleted. Deactivate instead." and a 14px secondary paragraph. Code merges them into one 16px message. `index.tsx:423-427`.

## A-DeleteSimple → app/(admin)/users/[userId]/index.tsx:437-456

- Matches: copy, red confirm, error emblem. Only the shared dialog chrome differs (see W-NoteDelete).

## A-CreateUser → app/(admin)/users/new.tsx (+ src/features/admin/UserForm.tsx)

- [med] [likely-defect] Role radio cards.
  - Design: each card leads with a 36x36 role-icon tile (ink with a yellow glyph when selected, #ECEAE4/#2B2F36 otherwise), with the radio on the **right**. Unselected bg #FBFAF7, selected bg white with a 2px ink border. Label 16px/650, description 13px, minHeight 60.
  - Code `ChoiceList`: radio on the left, no role icon, selected bg paper #F4F3EF, border 1.5, label 17, description 14.
  - `UserForm.tsx:137-148`, `ChoiceList.tsx:84-110`.
- [low] [likely-defect] Header title. Design 20px/700, -0.3. Code compact `sectionTitle` 22/28 semibold. `AppHeader.tsx:121`.
- [low] [likely-defect] Work email field. Code adds a leading mail icon; the design has none. `UserForm.tsx:115`.
- [low] [ambiguous] Helper copy. Design "…Deepak can sign in with it straight away." Code "…They can sign in…". `UserForm.tsx:168`.
- [low] [likely-defect] Form gap. Design 18. Code 20. `UserForm.tsx:231`.

## A-EditUser → app/(admin)/users/[userId]/edit.tsx (+ UserForm)

- [low] [likely-defect] Password note. Design: a filled #ECEAE4 box, radius 14, padding 12 14, 14/20 text in #2B2F36. Code: a plain row with no fill, in `textSecondary`. `UserForm.tsx:194-199, 235-236`.
- [low] [ambiguous] "Save changes" stays disabled until something changes; the design shows it enabled. docs/04 §S-004 edit-mode rule, so intentional. `UserForm.tsx:222`.
- (Role-card and header findings from A-CreateUser apply here too.)

## Feature-missing

None. Every board in this set has an implementation:

- Reject sheet: `index.tsx:532`.
- Note add, edit and delete: `index.tsx:418-530`. docs/04 still says notes can't be edited; that is superseded by 9C.
- Deactivate and reactivate: `users/[userId]/index.tsx:396-418`.
- Force sign-out: `:376`.
- Delete, with and without history: `:420-456`.
- Set password: `:286`.

The items missing _inside_ screens are:

- the static map preview (W-Detail-*)
- "All photos uploaded" (W-Submit)
- "Back to task" while uploading (W-Uploading)
- the camera framing guide (W-Camera)
- the last-photo thumbnail on the gallery button (W-Camera)
