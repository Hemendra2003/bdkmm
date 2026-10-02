# MOMENTUM — Master plan 2: the complete user experience

**Status:** merged design and delivery plan; no app changes performed.  
**Companions:** [Core product master](MASTER-PLAN-1-core.md) · [Full comparison and merge decisions](PLAN-COMPARISON.md)

## 1. Scope, evidence and decisions

### User requirements

Build for individuals tracking habits and daily reflection. Deliver a polished mobile-first web app with installable PWA support. Preserve Momentum's existing visual theme, with freedom to redesign the complete experience and improve copy. Keep **both scoring alternatives in the plans**, pending a later choice.

### Recommended common experience

Use three primary destinations: **Today, Habits, Progress**, with Account/Settings in the header. Make optional reflection unscored, allow user-chosen routine sizes, and remove compulsory negative-habit quotas. Give launch users recoverable offline drafts and queued synchronization. These are merged recommendations, not additional decisions the user has already made.

The core master defines two alternatives:

- **A — Normalized habits:** weighted action score, bounded daily change and a simple momentum total.
- **B — Repaired thrust/drag:** preserve the original physics-style engine, with explicit multipliers and shadow drag, corrected dates, history and calculation rules. The proposed 3% missed-day decay and streak grace remain a separate, unselected B policy.

Build common screens against the agreed state contract. Keep engine-specific result cards, explanations and examples separate in the design specification. Before implementing scoring or writing final engine copy, select and version the release formula. This plan does **not** propose a user-facing engine switcher or silently combine both formulas.

### Evidence boundary

The earlier review used committed `eb31f0e` and controlled frontend fixtures. The current local working tree still has that HEAD but contains uncommitted changes: the normal startup no longer always forces June 27, and new-account initialization now seeds three fixed questions instead of the committed version's 15. Those are local changes to preserve and verify, not proof of deployment. UTC date handling, exposed demo behavior, partial-result claims and historical recalculation remain concerns. Live authentication, database permissions and production user data were not verified in this plan review.

## 2. The states people must understand

The interface must distinguish these concepts under either engine:

| Concept | Required experience |
|---|---|
| Due habit | A habit scheduled for the profile's calendar date. Off-days and planned pauses are visible without appearing as failures. |
| Reflection | Optional mood, sleep reflection and note. Clearly unscored and separate from action performance. |
| Device draft | Recoverable work in progress. Even fully answered, it is a preview until deliberate submission. Autosave never advances a streak. |
| Queued submission | User has submitted while offline; acceptance is pending. Say “Waiting to sync.” Any score shown is provisional. |
| Confirmed check-in | Server accepted the deliberate submission. Can count toward check-in consistency even when action answers remain unresolved. |
| Score pending | Confirmed check-in has unresolved due actions. Show the last confirmed momentum with its actual date. |
| Score ready | Every due action is answered or validly excused, at least one eligible action remains, and the server confirms the calculation. |
| No action score | No eligible actions, including scheduled rest or all-excused days. A deliberate reflection/check-in can still be recorded. |
| Recalculating momentum | Check-in is confirmed but historical replay is still processing. Identify the last valid result by date and label stale downstream values until the new calculation is confirmed. This differs from unanswered-action score pending. |
| Conflict | Another device or routine change affects this revision. Preserve both versions and guide resolution. |
| Historical record | Shows its original wording, answer meaning, schedule and engine era. Corrections follow the core policy. |

If optional B decay is selected later, add a separate **System momentum adjustment** state. A dated decay/shadow adjustment can change momentum without creating an action score or a check-in. Show “Momentum as of [date]” and its adjustment breakdown; the underlying day remains unrecorded, pending or no-action as appropriate. The last-scored-day examples below apply to A and conservative B, where unknown days carry momentum unchanged.

“Skip for now” leaves an action unresolved. “Excuse today” requests a reason and excludes that action under the core rules. Neither becomes a successful response. Do not add “Mark the rest neutral”: it would create observations the user did not make.

Check-in streaks, habit streaks, score changes and synchronization are different. Name them precisely. An entry can be saved while its score is pending; a queued submission is not yet confirmed.

## 3. Preserve the visual identity; improve readability

### Tokens and typography

Keep the dark navy space, starfield, pixel rocket, gold hero accent, green/red status accents, secondary blue and original font families.

| Role | Preserve | Implementation direction |
|---|---|---|
| Background/surfaces | `#05060D`, `#0D0F1A`, `#181A28`, `#1F2133` | Consistent surface depth, restrained stars behind reading areas. |
| Gold | `#FFB830`, intentional `#FFE066` highlights | Main action and momentum emphasis; avoid competing primary buttons. |
| Reds | Brand `#D62828`, brighter `#FF5555`/`#FF3030` | Keep dark red in artwork; use contrast-tested accessible error text. |
| Green/blue | Existing green identity and `#5BBFFF` | Semantic roles, shared with charts; remove accidental mismatched colors. |
| Text | `#F0F0F8`, `#B8B8D0`, `#9090B0` | Primary, secondary and muted roles with tested contrast. |
| Display | Press Start 2P | Wordmark, major numbers and short milestones. |
| Metadata | DM Mono | Dates, numerical annotations and brief telemetry. |
| Reading | Space Grotesk | Forms, questions, buttons, navigation, explanations and errors. |

Use a proposed scale of **16px/24px body**, **14px/20px secondary**, **12px/16px meaningful metadata**, readable titles and a fluid hero. Remove 8–10px essential labels. Pixel type and uppercase must not make everyday reading difficult.

Centralize semantic tokens, preferably in the selected architecture's equivalent of `src/styles/tokens.css`. Define brand/positive/negative/warning/text/surface roles, documented alpha variants and chart tokens consumed by the renderer. Remove unused pink and accidental duplicates; preserve purposeful variation. Check actual rendered foreground/background combinations rather than assuming a token name guarantees contrast.

Use spacing 4/8/12/16/24/32/48px and a small radius scale around the original 6px corner, with larger sheets. Add 120ms/200ms baseline motion tokens, consistent easing and reduced-motion alternatives.

### Components

One implementation each for buttons, links, navigation, page headers, inputs, radio groups, date controls, cards, importance controls, pills, status banners, dialogs, bottom sheets, tooltips/help, notifications with undo, skeletons and empty states. Share segmented styling where appropriate; radio groups, tabs and filters retain their correct semantics and keyboard rules.

Document default, hover, focus, pressed, selected, disabled, loading, invalid, success and destructive states. Async features also need offline, stale, failure, retry and conflict states. A failed load must never look like an empty account.

Create a coherent pixel SVG set: rocket, bolt, warning, settings, library, back, close, check, plus and chart. Replace mixed emoji. Small artwork still sits inside a **44×44px** touch target; decorative graphics are hidden from accessibility APIs, and icon-only buttons have names.

Use a visible gold focus ring with enough contrast and offset on each surface. Sheets need initial focus, contained keyboard navigation, inert background, Escape behavior, scroll management and return focus. A drag handle is optional; every sheet has an accessible close action. Use normal confirmations for genuinely destructive actions, contextual retry for failures and short notifications for completed reversible actions.

## 4. Navigation and responsive layout

| Destination | Content |
|---|---|
| **Today** | Today's action, draft/sync status, compact rocket, current confirmed momentum and one recent trend. |
| **Habits** | Active/archived routine, add/library/custom creation, detail, schedules, importance, pause and history. |
| **Progress** | Trends, consistency, coverage, lightweight calendar, accessible date list and past-entry details. |
| **Account / Settings** | Account access, timezone/week start, motion, data, help and sign out. |

Merge the attached plan's Questions controls into Habits. Users should not need to guess whether “Habits” or “Questions” owns their routine. Titles match destinations; root screens do not show a redundant Back button. Historical and other child screens have clear parent navigation.

Route inventory: welcome; sign-in/up; verification/recovery; resumable setup; Today; dated check-in/result; Habits/new/detail; Progress/history; dated entry/score detail; Settings children. Path or hash routing is an implementation choice based on hosting. Both must support refresh, deep links, browser Back, meaningful titles, restored scroll and focus handoff. Auth callbacks return to the intended destination without losing work.

Mobile uses one readable column, stable header and bottom navigation. Put the main check-in action before the compact rocket within the first representative mobile viewport. Use `viewport-fit=cover`, safe-area insets and dynamic viewport sizing. Avoid accidental nested scrolling; allow deliberate sheet content to scroll. Sticky actions remain above keyboards and home indicators.

Test from 320px upward, landscape, long options, large numbers and text enlargement. Tablet layout follows available space. Desktop may use a 1040–1120px shell with a 640–680px reading column, side navigation and useful secondary context; preserving the theme does not freeze mobile geometry on every screen.

## 5. Complete journeys

### A. Welcome, authentication and recovery

Explain the promise plainly: **“See how your daily habits build momentum.”** Use the real rocket and a clearly labeled example. Sign in and Create account are distinct modes, each with one primary action and its own validation.

Provide visible Email/Password labels, appropriate autocomplete, show-password, inline errors, preserved email after failure and loading/disabled feedback. Enter submits the active form; remove global Enter-anywhere behavior. Google sign-in needs pending, cancellation and callback-error states.

Show “Check your email to finish creating your account” only when the configured service actually requires confirmation. Include resend with cooldown, change-email navigation, expired-link recovery and continuation after verification. Otherwise continue setup directly.

Password recovery covers request, neutral response, valid/expired/reused link, new password, success and interrupted recovery. Session expiry preserves account-scoped work, requests sign-in and returns to the interrupted task. Switching accounts cannot reveal prior-account entries, drafts or queued actions. Privacy and terms links make only implemented claims.

### B. First-use setup and migration

Keep setup short, resumable and revisitable from Habits/Settings:

1. **Choose your routine.** Suggest approximately three to five habits or a relevant optional template. Review before adding. Sensitive habits require intentional selection.
2. **Make it yours.** Customize names, distinct response choices, daily/weekday schedule and Low/Medium/High importance. Explain Build a habit versus Reduce a habit with one example. Optional S/A/B badges can preserve visual flavor.
3. **Confirm your day.** Confirm the detected timezone and explain the date used for check-ins. Keep secondary preferences outside the critical path.
4. **Start your first check-in.** Briefly introduce private game-like momentum and optional unscored reflection, then enter the actual task.

Do not require ten questions, a negative-habit percentage or locked scored mood/sleep questions under the merged recommendation. Show counts computed from the actual selection; remove contradictory hardcoded “7 more” examples. Starter presets are choices, not silently installed personal routines.

Existing users receive a migration explanation, effective switch date, retained history and routine review. Say when legacy scores were reconstructed from available cutover data; do not claim unavailable historical versions were recovered. Migration copy depends on the selected engine and core cutover policy. If B is selected, explain the recommended reset of multiplier streaks and shadow carry at the boundary while velocity is preserved. A draft spanning cutover keeps its target date/era and gets an explicit recovery path if that era becomes read-only.

### C. Today

The first screen answers: **What can I do now? What is saved? What changed?**

```text
MOMENTUM                    Date · Account
Today's check-in
3 habits answered · 4 unanswered
[ Continue check-in ]
Check-in saved · Score pending

[compact pixel rocket]              124 km/s
Momentum · last scored day, 28 Sep
[ See score details ]

This week: 5 confirmed check-ins
[Small labeled trend · View progress]

Today              Habits             Progress
```

The primary action reads Start check-in, Continue check-in or Edit check-in. Separate local draft, queued, confirmed and score-pending labels. Show the last scored date instead of implying an unfinished day has a final score.

Use one contextual nudge at most: resume unfinished work, resolve sync or optionally add a permitted past check-in. Do not push avoidance habits to satisfy a quota or nag because About has not been read. After a gap: “Welcome back. Start with today.” At zero momentum, retain a useful action without alarm or shame.

A new-account empty state may say “Your momentum starts at 100 km/s. Start your first check-in.” Migrated users see their real preserved baseline. One scored point can be displayed honestly; explain that more scored days are needed for a trend. A logged reflection-only day is not necessarily a scored point.

### D. Daily check-in

Show the full date, clear historical-edit indication, due-action progress, readable question/options, stable close control and optional reflection. A date stepper is useful alongside a picker; it obeys future-date, tracking-start, backfill and era limits.

Use native radios or accessible equivalents. Selection has a visible check/border and programmatic state, not just color. Options may share a row when they fit; otherwise stack. Do not truncate or impose a two-line cap that hides meaning. Tier/polarity explanations work by touch and keyboard.

Provide **Skip for now** and **Excuse today** as separate secondary actions. Explain excuse reasons and consequences before finalization. Scheduled rest needs no excuse. Keep progress honest about answered, excused and unresolved actions.

Autosave to durable account-scoped IndexedDB under the core contract. Closing retains the draft; discarding is explicit. Confirm close only if work would actually be lost. Show storage-failure recovery instead of falsely claiming persistence. Restore answers and a useful scroll position on return.

The sticky primary action is **Save check-in**, independent of score readiness. Nearby copy says, for example, “4 unanswered · Your score will remain pending.” Local autosave does not substitute for deliberate submission.

Keep the editor available during saving. Retain answers after failure and offer Retry. If save succeeds but refresh fails, explain that distinction. Repeated taps must not duplicate records. Auto-scroll is off by default; any later assistance must preserve user control and focus.

Editing a confirmed day creates a draft while its committed revision remains intact. Before replacing it with a finalized partial check-in, preview removal of its prior score contribution and downstream recalculation. The entry remains recorded with score pending. Concurrent changes need a readable comparison; only safe disjoint edits may merge automatically under core rules.

Offline submission says **“Check-in queued · Waiting to sync.”** Keep any preview labeled provisional. On account expiry, reconnect and authenticate the correct account before sending its queue. Reserve confirmed saved-result language for server acknowledgement.

### E. Results and engine explanation

Use **“Check-in saved”** for confirmed submission, with conditional detail:

- **Pending:** “Check-in saved · 4 habits unanswered · Score pending.”
- **No score:** explain no scheduled/eligible actions; show reflection/check-in confirmation independently.
- **Scored:** new momentum, actual change, key contributions and an expandable calculation.
- **Queued:** waiting-to-sync state, not a confirmed result page.

Both engine designs show previous momentum, the current contribution and actual new momentum, including zero-floor effects. Use actual comparison dates; “Yesterday” only when correct. “Day one. Build from here” only applies to the true first confirmed entry. Offer Return to Today and Edit this check-in. A short rocket lift has a static reduced-motion equivalent.

#### Alternative A result card

Show **Action score / 100 → daily change → momentum**. Expand into response values, importance weights, excused exclusions, weighted total and eligible denominator. The proposed core formula is:

`P = round(100 × weighted answer total / eligible weight total)`  
`Nominal change = round((P − 50) / 5)`, bounded to −10…+10.  
`Momentum = max(0, previous momentum + nominal change)`.

Use the core's round-half-away-from-zero convention and derive change from the same displayed integer P. Show actual change after the floor. No multiplier, shadow-drag or balance-quota copy appears in A's current-engine screens.

#### Alternative B result card

Show **Thrust → Drag → Multiplier → Shadow drag → Change → Velocity**. Expose raw contribution, multiplier basis, rounding, shadow calculation, floor and actual change so the displayed steps reconcile. Caps and the 30%/12% calendar-day shadow proposal must come from the approved versioned core contract, not handwritten constants scattered through UI code.

Explain multiplier streaks separately from check-in and habit streaks. Avoid “clean day,” “punishment” and claims that all effects disappear after one positive day. If optional missed-day decay is selected, add a distinct labeled decay row and explain its date basis. Use an as-of date for confirmed momentum and separately labeled system-adjustment chart points/table rows; keep action-score charts free of fabricated responses. If it is not selected, no decay promise appears. A pending or missing entry must not silently become a fabricated answered failure.

#### About and legacy records

Keep About's editorial feel, with a matching title/eyebrow, short legend and tested worked examples for the selected release engine. State that momentum is a private game mechanic, not a measure of wellbeing. Historical details show the engine version, frozen/reconstructed-history limitation and cutover baseline. The prior engine remains explainable without pretending every era uses the same formula.

### F. Habits, library and routine maintenance

Habits contains Active and Archived views, schedule summaries, human importance labels and recent coverage. A detail screen combines configuration with historical responses: optional 30-day sparkline, answer distribution, coverage, excuses and explicit missingness. An average without its denominator is insufficient.

Add flow: **browse/search → inspect → customize → preview → add**. Search names and categories. Provide loading, no-result, failure/retry and persistent Added states. Recommendations reflect expressed goals or categories; sensitive topics are intentionally discovered, not suggested to meet balance targets.

Custom forms need labels, character counts, distinct answer choices, validation for empty/duplicate options and a check-in preview. Order options consistently from least to most aligned with the user's goal and map Build/Reduce polarity correctly. Clear error presentation after correction; do not rely on color alone.

Support daily and selected-weekday schedules with accessible controls. Onboarding additions start today. Later additions offer today/tomorrow; edits to schedules or importance default to tomorrow. Every edit displays its effective date and preserves historical wording, options and scoring versions. Applying a change today previews impact; changing a finalized day's plan requires a deliberate reopen flow while retaining its earlier confirmed revision.

Provide dated Pause, Resume and planned-rest controls. A future pause changes scheduled obligations; a one-day excuse is a separate action. Archive removes future obligations while keeping discoverable history and archived statistics. Restore includes an effective date and impact review. Offer undo where supported. Reordering works through keyboard/buttons as well as drag. Permanent data deletion belongs in Settings.

### G. Progress, history and reflection

Start with **Last 7 days, Last 30 days, All time**, with exact endpoints. “This week” means the configured calendar week; it must not label a rolling seven-day or eight-date cutoff.

Separate check-in consistency, action coverage, habit adherence and momentum. A confirmed reflection-only check-in can count for check-in consistency. Due unanswered actions mean score pending; no eligible actions mean no action score. Habit streaks follow scheduled completions; excused days neither advance nor break them under the shared contract.

Adherence excludes scheduled off-days and valid excuses. Unanswered eligible dates remain Unrecorded: they reduce confirmed adherence without being presented as answered failures. Show coverage and excuse counts beside statistics. No eligible denominator produces an explanation, not a misleading percentage. Weekly summaries report observations, not invented causes.

Use a shared chart renderer with token colors, honest gaps, units and clear scale. Daily change has a true zero baseline; positive/negative regions include non-color meaning. Momentum gets labeled ticks and a reasonable minimum range so a small wobble does not look catastrophic. An empty today marker must say whether it means pending, no score or no record; it is not a zero value.

Touch/hover/keyboard inspection shows exact date/value and Open day. Include month labels, useful factual summaries and an accessible data table. An average states its scored-day denominator. Mark scoring-era boundaries and avoid unexplained cross-era comparisons. Move detailed charts here, leaving Today glanceable.

History includes a lightweight month calendar **and** an accessible date-grouped list at launch. Cells expose date and status; list and picker offer equivalent access. Distinguish draft, queued, confirmed/pending, scored, no-score and legacy records. Missing eligible dates offer Add past check-in within permitted bounds. Disable future/pre-start dates with an explanation. Legacy records remain read-only in the ordinary editor; current-era corrections preview downstream effects under core rules.

### H. Settings, trust and support

Include account/provider details, password access where applicable, sign out, timezone, week start, motion preference, data controls, score help and support. Timezone changes explain their effective date and preserve history. Use confirmation on sign out when unsynced-work risk needs a decision, rather than adding a routine extra step every time.

Export states exactly what it includes. Import covers validation, record counts, duplicates/conflicts, preview, deliberate confirmation, progress and accurate results. Separate clearing selected records from deleting an account. Explain scope, consequences and the actual recovery policy; use typed confirmation for destructive operations where appropriate.

Remove production developer utilities. Development tooling requires environment/build separation; a query-string flag cannot authorize data access, resets or privileged actions. Demo data must be isolated from live persistence.

Privacy, retention, deletion and support copy reflect verified backend behavior. Do not promise encryption properties, recovery or deletion times that have not been implemented and validated.

## 6. Copy and feedback system

Use calm, direct language with light mission-control flavor. American English is a proposed house style. Short decorative telemetry can be uppercase; forms, errors and longer status use sentence case. Every warning gives a useful next step. Keep metric units consistent as `km/s` where the design retains the fictional velocity display.

Centralize reusable strings, plurals, interpolation and accessibility names in the selected architecture. Do not scatter formula constants or state-dependent claims in templates.

| Situation | Preferred copy |
|---|---|
| Primary daily action | Start check-in / Continue check-in / Edit check-in |
| Routine destination | Habits |
| Polarity | Build a habit / Reduce a habit |
| Optional day reflection | Difficult / Okay / Good |
| Return after a gap | Welcome back. Start with today. |
| Confirmed partial | Check-in saved · 4 habits unanswered · Score pending |
| Local persistence confirmed | Draft saved on this device |
| Offline submitted | Check-in queued · Waiting to sync |
| Load failure | Your entries couldn't load. Try again. |
| Submission failure | We couldn't sync your check-in. Retry. |
| Invalid credentials | That email and password don't match. |
| First genuine check-in | Day one. Build from here. |
| Comparison | Since 28 Sep / vs last scored day |
| Empty trend | Your trend starts with your first scored check-in. |

Retire Degenerate, KILLERS, COLLAPSE DETECTED, false DAY COMPLETE, ambiguous clean streaks, quota warnings and raw provider exceptions. Engine B may retain thrust/drag vocabulary in explanations without using it to scold. Include distinct copy for storage failure, saved-but-refresh-failed, conflict, scheduled rest, all-excused days, legacy history and deletion outcomes.

## 7. PWA, performance and accessibility

### Installed and offline behavior

The browser experience works completely before installation. Add correct app/page titles, rocket favicon/install icons, theme-color and manifest. Offer a dismissible installation invitation after value, with platform-appropriate instructions where needed.

Installed mode supports cold launch, resume, auth redirects, deep links, cached startup and account-scoped work. Full offline behavior is deliberate engineering: cached shell and plan, durable IndexedDB draft/outbox, clear available actions, idempotent sending, conflict handling and account isolation. Local storage alone does not provide synchronization.

Updates preserve drafts and wait for a safe reload point. Design update-ready, stale-client and recovery states. Reminders and richer notifications are later unless explicitly brought into release scope; ask permission only after opt-in and handle denial without blocking check-ins. Do not display unavailable controls as working features.

Pause decorative stars when covered, hidden or reduced motion is requested. A 30fps ceiling is a starting budget, not a reason to animate constantly. Debounce resize work without rebuilding unrelated screens. Choose font loading/fallback metrics to limit layout shift; evaluate `font-display: optional` for display type rather than assuming it always preserves the intended appearance.

### Accessibility gate

Target WCAG 2.2 AA with automation and manual task testing. Check actual contrast: 4.5:1 normal text and 3:1 large text. [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). The product's 44×44px touch standard is larger than WCAG AA's 24px minimum with exceptions; do not confuse the two. [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

Use landmarks, heading order, labeled fields, associated errors, current-page navigation and visible focus. Announce save outcomes without rereading the page. Expose selected/expanded/disabled state. Test dialogs, focus restoration, keyboard-only work, chart data access, 200% text enlargement, 400% zoom/reflow and forced colors.

Test VoiceOver/Safari and a Windows screen-reader/browser combination, including errors and recovery. Reduced motion covers rocket, stars, pulse, loaders, transitions and celebration. Automated accessibility scores alone cannot establish conformance.

## 8. Delivery, dependencies and acceptance

| Phase | Work | Gate |
|---|---|---|
| **UX-0: align meaning** | State glossary, evidence baseline, inventory; A/B design branches and scoring decision gate; date, excuse, revision, sync and migration contracts. | Every status maps to a real state. No hidden engine blend or false completion. |
| **UX-1: system and prototype** | Tokens, SVGs, components, responsive shell, routes and all principal journeys, including long labels, sparse data and failures. | Main action in mobile viewport; options readable; five representative users attempt tasks, proposed four succeed without rescue. Any data-loss misunderstanding blocks progression. |
| **UX-2: daily loop** | Auth/recovery, setup, Today, dated check-in, local drafts/outbox, server confirmation/conflicts, results and chosen-engine help. | Account creation, partial submit, close/reopen, offline/retry, expiry and next-day return preserve data and dates without duplication. |
| **UX-3: supporting journeys** | Versioned habits/schedules/pause/archive/restore, Progress/calendar/list, edits, settings/import/export/deletion, installed lifecycle. | Effective dates and impacts understood; historical meaning preserved; metrics reconcile; browser and installed mode survive updates/resume. |
| **UX-4: release validation** | Manual accessibility, real devices, visual regression, slow/offline cases and second usability round. | No critical task blocker, inaccessible primary control, misleading score, clipped answer or unreachable action. All required journeys and state checks pass. |

Core dependencies are concrete: auth contracts before recovery; date/schedule/revision contracts before past-day and routine edits; trusted calculation before confirmed result copy; outbox/conflict contracts before offline claims; data lifecycle before import/deletion UI. Tokens can progress in parallel with core stabilization. Copy, accessibility and failure testing run throughout, with a final integrated pass.

Use iPhone SE-size and modern iPhone/Safari, Android/Chrome, iPad/tablet, and desktop around 1280px as representative devices, plus responsive widths rather than device names alone. Run axe on meaningful screens/states and keyboard walkthroughs across auth, setup, check-in, habits, history, settings and recovery. Visual regression covers representative themes, sizes and states, not only five happy-path screenshots.

Target Lighthouse mobile Performance ≥90 under recorded conditions and Accessibility ≥95 as diagnostic signals; known accessibility violations still block release. Combine performance scores with the core plan's budgets and real-device observations.

The attachment's UI tasks total roughly **17.5–24.5 developer-days**, excluding missing scope, integration and rework. This is an input to estimation, not a complete production promise. Re-estimate the merged scope after engine/state decisions and prototype review; parallel work does not remove dependencies.

## 9. After launch and measurement

Measure first confirmed check-in, first eligible score, check-in duration, draft recovery, abandonment, save/retry success, account recovery and repeat weekly use. Keep denominators explicit and distinguish device actions from server-confirmed events. Collect event names and timing without raw habit names, answers or reflection text. Set improvement targets after observing a baseline.

Evaluate richer weekly reviews, reminders, advanced filters and modest milestones against real demand. Defer social rankings, chatbots and new themes until the daily loop is reliable and useful.
