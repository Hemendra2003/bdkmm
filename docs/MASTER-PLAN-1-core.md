# MOMENTUM — Master Plan 1: Product logic, backend and production readiness

[UI/UX master plan](MASTER-PLAN-2-ui-ux.md) · [Full comparison and merge decisions](PLAN-COMPARISON.md)

**Status:** merged implementation proposal, 29 September 2026. This plan combines the earlier production plan with the useful additions in `docs/PLAN-1-core.md`. It does not authorize or report implementation, production changes, credential rotation, account changes or Git history rewriting.

**Product goal:** a dependable personal habit and daily reflection app. Its loop is **choose a manageable routine → record the day → optionally reflect → understand the result → review patterns → adjust future plans**. Keep the rocket identity and existing visual theme, with a mobile-first web experience and installable PWA.

## 1. Decisions, evidence and release scope

### Decision register

| Status | Decision |
|---|---|
| User-confirmed | Serve individual users tracking habits and daily reflection first. |
| User-confirmed | Target a polished mobile-first web app with installable PWA support. |
| User-confirmed | Preserve the existing visual theme while renovating the experience. |
| User-confirmed | Keep both scoring models in the plans as options. Do not silently choose one. |
| Merged recommendation | Launch with one-habit onboarding, personal schedules, optional reflection, history, reliable offline drafts and sync, complete account/data controls and operational recovery. |
| Merged recommendation | Use React + TypeScript + Vite, retain Supabase Auth/PostgreSQL and migrate incrementally through tested modules. |
| Merged recommendation | Remove mandatory question counts/polarity quotas and scored mood/sleep questions from new-user defaults. |
| Decision gate before scoring implementation | Choose Engine A or B; if B, resolve the separate missed-day/decay policy. Freeze one canonical version with fixtures, copy and migration rules. |

Both engine options remain documented. This is **not** a proposal to expose an A/B engine selector to every user. Common product, data, auth, security and offline work can proceed while the engine decision is pending. Final score presentation, engine implementation and cutover acceptance depend on that gate.

### Current evidence and its limits

The earlier audit reviewed committed `eb31f0eb839324509bb84700de3bcf3143a755cc`. The Desktop repository still has that HEAD, but its working tree contains uncommitted changes to `app.js`, `index.html` and `storage.js`. Preserve and review that work before implementation.

| Finding | What the current review establishes | Required outcome |
|---|---|---|
| Clock/demo | The always-on June 27 override was removed locally. A browser-local demo-date preference now exists; normal dates still use UTC extraction, and demo dates still reach real save paths. Deployment status is unknown. | Profile-local dates; demo fixtures isolated from production persistence; no cross-account demo preference leakage. |
| Initial questions | Committed HEAD seeds 15 questions; the working tree now seeds three fixed scored questions: sleep, mood and overall day. The ten-question minimum remains. | Personal onboarding and optional reflection; preserve existing users' historical meanings during migration. |
| Credential history | Local historical objects contain nonempty, non-obvious-placeholder authentication-token values in removed local-tool settings. Multiple versions differ. Validity, revocation and current GitHub reachability were not tested. | Owner-led credential containment/investigation; separate decision on history cleanup. Never print secrets in reports. |
| Data integrity | Current scoring uses today's definitions for old answers; partial entries can affect velocity; null/orphan keys count toward completion; invalid numeric answers are coerced. | Immutable definitions, validated answers, explicit score eligibility and deterministic replay. |
| Isolation/security | User text reaches unsafe HTML rendering. Reads rely on backend authorization that is not represented by tracked migrations. Production policies were not inspected. | Safe rendering, verified grants/RLS and linked ownership; no claim of proven cross-user exposure. |
| Reliability | Durable drafts, revision-aware saves, outbox and full PWA support remain absent. Ascending history reads are unpaginated. | Recoverable edits, complete history and honest device/account save states. |

The local removal of old migration/settings access does not establish that database settings are unused or safe to delete. Live schema, grants, backups, deployments, existing-user counts and email configuration remain verification gates.

### Recommended first production release

- Email/password and Google sign-in, confirmation/resend, password recovery, session recovery, settings and account deletion.
- Start with one habit, an optional starter set or a custom routine. Build and Limit/Avoid habits support binary or three-level choices.
- Daily/selected-weekday schedules, effective dates, planned rest, pause, archive and restore.
- Today due list, durable draft, explicit finalization, optional reflection note/mood/sleep and understandable results.
- History calendar plus accessible list, day detail, valid backfill/correction, per-habit history and weekly/monthly review.
- PWA installation, offline startup for a previously prepared account, durable drafts, queued finalization, reconnection sync, conflicts and safe updates.
- Complete export/import, discoverable deletion/restore behavior, support diagnostics and operational recovery.

Advanced numeric/interval/weekly-quota schedules, optional email/push reminders, integrations and richer reviews are later work. Social feeds, rankings, AI advice, wearables, subscriptions and native apps are outside this release. Offline sync is a retained **recommendation**, not a previously explicit user instruction; it materially expands work beyond a manifest and local draft.

## 2. P0 stabilization before broader renovation

1. **Contain credential risk.** Have the repository/provider owner identify all affected credentials without redistributing them; revoke/rotate any that may remain usable and review access/billing evidence. Removing a file or rewriting history does not revoke a credential. Evaluate history cleanup separately, including collaborator coordination, backup, forks/caches and protected branches; do not make force-push an automatic first action. Add secret scanning and suitable ignore rules for local tool settings, environment secrets and OS files, while allowing a safe example configuration.
2. **Verify account ownership.** Inventory existing schema, grants, RLS, views and functions. Test anonymous denial and user-A/user-B reads/writes before onboarding more users. Use operation-appropriate policies and validate referenced records' owners. Explicit client filters help but do not replace RLS. Do not blindly apply a fresh initialization migration to an existing database.
3. **Finish date/demo isolation.** Preserve the local clock improvement; replace UTC day extraction with the selected profile timezone. Give demos a separate repository/data source that cannot call production write functions. Remove destructive developer tools from production builds. A `?dev=1` flag is not authorization.
4. **Make text rendering safe.** Replace user-controlled HTML interpolation with text nodes or framework escaping across every screen. Removing globals/inline handlers alone does not fix injection. Validate plain text, choices, URLs and size limits; add focused rendering regressions.
5. **Stop losing edits.** Persist account-scoped drafts, keep the editor open through failed saves and prevent failed reads from opening a blank form that could overwrite an existing entry. A temporary localStorage patch is acceptable during stabilization; the launch contract uses IndexedDB and an outbox.
6. **Pin and characterize.** Pin the Supabase SDK immediately, then move it into a lockfile-managed npm build. Capture current engine behavior in fixtures before refactoring; identify intentional rule changes separately from regressions.
7. **Preserve evidence and recovery.** Snapshot source/schema inventory, validate a backup restore in isolated staging and investigate historic demo-date concentration without moving or deleting user records.

P0 exit requires evidence of isolation, safe rendering, trustworthy date targeting, recoverable editing and a tested recovery path. Historical credential status must have an owner and documented disposition; no active suspected credential exposure should be waved through as a UI task.

## 3. Common product behavior for either engine

### Habits, definitions and schedules

Each habit has a stable identity and immutable revisions. Label, choice IDs/meanings, priority, schedule and effective interval belong to the revision. A response references the definition that applied to its day, not whatever wording exists now.

Launch with daily and selected-weekday schedules. Eligibility requires a valid effective interval, scheduled weekday and no pause/rest exception. Planned rest creates no due occurrence and is not a failed action. Archive removes future occurrences while retaining historical statistics. Restore resumes the same habit identity on a selected date without filling the gap. A separate new habit gets a new identity; re-adding an archived library item distinguishes restore from starting again.

Custom choices must be distinct, meaningful and ordered from lower to higher attainment. Reject blank/duplicate labels, invalid IDs and excessive text/item counts. Binary choices use two explicit endpoints; three-level choices add partial attainment. Library suggestions must not imply universal health, medication, productivity or financial standards.

Rename, priority and schedule changes default to tomorrow. Later additions offer “Include today” or “Start tomorrow”; onboarding can start today. Applying changes to an open day creates an explicit plan revision and impact preview. Reopen a finalized day deliberately before replacing its plan. Never silently rewrite historical configurations.

No minimum routine size or required ratio of Build to Limit/Avoid habits. A weighted balance indicator, if retained at all, is optional descriptive information. It cannot gate scoring, block archival or suggest that every person needs negative habits. Optional note/mood/sleep reflection stays outside action scoring under both proposed engines.

### Dates and midnight

Store an IANA timezone and week-start preference. At first edit capture the selected local date, timezone, due-plan version and applicable engine era. An editor left open overnight keeps that target; offer the new day explicitly. Revalidate on foreground/visibility and date changes without discarding work. A cutover cannot silently move a draft into a different formula: validate its target era at commit and offer an explicit legacy-review/recovery path when ordinary editing is no longer allowed.

Travel may prompt a timezone change but cannot rewrite old dates. Test DST, leap days, year boundaries, UTC extremes and device/profile timezone differences. Allow past-day backfill within reconstructable effective history; reject future answers while allowing future plans. Imports retain source provenance.

### Draft, finalization, resolution and sync

Distinguish **unrecorded, completed, partial, not completed and excused**. “Skip for now” remains unrecorded. Excusing is explicit and records a reason. Missing data is never silently turned into success, failure or a neutral answer; there is no “80% answered means complete” threshold.

- **Save draft** preserves work without publishing a score or advancing a check-in streak.
- **Save check-in** commits an intentional finalization. It may contain unanswered actions and count as a check-in, while its action result remains **pending**.
- A score is eligible only when every due action is answered or excused, with at least one non-excused scored action.
- Reflection-only/no-action or all-excused check-ins show **No action score**. Reflection does not resolve unanswered actions.
- A no-action day can be finalized through “Checked in today” without requiring private disclosures. Empty autosaves do not count.
- Offline finalization is a queued operation with provisional local feedback. The account's canonical revision changes after a server receipt.

Editing a working draft of a finalized check-in leaves its committed result intact. Finalizing a replacement may change history; preview the effect. If the replacement leaves unresolved actions, its old action contribution is removed and subsequent results replay. Show answered, unanswered and excused counts, and use “Check-in saved” rather than declaring a partially answered day complete.

### Shared metric dictionary

| Metric | Contract |
|---|---|
| Check-in streak | Consecutive local dates with finalized check-ins, including partial/reflection-only finalizations. Unfinalized today preserves yesterday's streak until today ends; a closed-date gap resets it. Offline changes are provisional until synced. |
| Habit success streak | Consecutive scheduled full successes. Partial/not-completed breaks; unanswered due occurrence breaks when its day closes. Off-days ignored; excused freezes without incrementing. |
| Habit performance | Average recorded attainment, accompanied by observation count and recorded/scheduled coverage. |
| Habit adherence | Fully completed due occurrences divided by non-excused scheduled occurrences in a closed period. Unanswered due items remain in the denominator with an unknown count. Exclude off-days, pauses and pre-start dates. Zero denominator means no result. |
| Days logged | Finalized local check-ins; drafts separate. |
| Calendar periods | “This week/month” uses the profile timezone and chosen week start. “Last 7/30 days” contains exactly that many dates, with an upper bound. |
| Trends | Compare sufficient observations and coverage; otherwise show insufficient data. Reflection associations are descriptive. |
| Engine streaks | If Engine B is selected, multiplier streaks have separate names/contracts; they are not interchangeable with check-in or habit streaks. |

## 4. Keep both engine options; decide before implementation

Momentum is a game mechanic based on self-reported actions, not an objective measure of wellbeing or personal worth. Both candidates require valid immutable definitions, explicit exclusions, deterministic replay, trusted commits and a visible legacy cutover. Neither is claimed to be scientifically validated.

### Option A — Normalized daily performance and bounded daily change

**Intent:** make different-sized routines easier to interpret and make each day's change predictable.

1. Attainment is 0, 0.5 or 1; binary habits use endpoints. Limit/Avoid choices increase in the same attainment direction. Represent attainment internally as 0/1/2 and weights as integers; optional S/A/B priorities map to 3/2/1 with plain-language labels.
2. For an eligible finalized day, compute:

   `P = round(100 × sum(weight × attainment) / sum(non-excused due weights))`

   Here attainment means 0, 0.5 or 1. With integer units 0/1/2, the equivalent formula is `P = round(50 × sum(weight × attainmentUnits) / sum(non-excused due weights))`; never feed the doubled units into the first formula.

3. Unrecorded due items keep the result pending. Explicit excuses remove their weights from both sums and remain visible. All-excused/no-action days have no score.
4. Round `P` once. `intendedChange = round((P − 50) / 5)`, bounded from −10 to +10. Start new accounts at 100. `velocity = max(0, previousVelocity + intendedChange)`. Show actual change after the zero floor.
5. Use half-away-from-zero rounding identically in client/server fixtures. Unknown, pending and no-action days carry velocity unchanged; they are not awarded 50 points.
6. Remove shadow drag and escalating negative multipliers. Resolving an earlier pending day replays later results and explains the adjustment.

Adding more habits cannot raise the 100-point daily ceiling. Coverage and exclusions still matter: a high score on one answered habit is not evidence of a broad routine. The zero floor can make actual loss smaller than intended loss. Keep check-in/success streaks as separate engagement measures.

**Tradeoff:** simpler explanation and bounded change, but a substantial change from the current rocket simulation. Requires a new scoring era and user education.

### Option B — Repair and document the current thrust/drag engine

**Intent:** preserve the existing simulation's character while fixing its correctness, history and explanation problems.

The current source uses these per-answer values. Freeze the chosen table in the engine version; do not use mutable live habit tiers during replay.

| Habit type/tier | Lower attainment | Partial | Full attainment |
|---|---:|---:|---:|
| Build S | −5 | 0 | +8 |
| Build A | −3 | 0 | +5 |
| Build B | −1.5 | 0 | +3 |
| Limit/Avoid S | −10 | −4 | 0 |
| Limit/Avoid A | −6 | −2 | 0 |
| Limit/Avoid B | −3 | −1 | 0 |

Binary habits use the endpoints. These are game weights, not health recommendations. Lower Build attainment also creates drag; the names “positive/negative habit” must not hide that behavior. Unanswered negative items currently produce no drag, matching the immediate contribution of full avoidance without recording an avoidance response; the common score-eligibility gate removes that selective-reporting path.

**Candidate B contract, to freeze at the decision gate:**

1. For an eligible finalized day, sum positive contributions as thrust and absolute negative contributions as drag. `raw = thrust − drag`. Explicitly excused items contribute nothing and are labeled excluded.
2. Select today's multiplier from **prior** engine streaks and the sign of raw, preventing circular definitions. Preserve the source candidates:
   - Positive: `min(2.2, 1 + log(priorPositiveStreak + 1) / log(1.8) × 0.25)`.
   - Negative: `min(3.5, 1 + (priorNegativeStreak + 1)^1.4 × 0.15)`.
   - Zero raw: 1.
3. Round the multiplier to two decimals; calculate rounded raw change. Shadow is the rounded sum of `0.30 × drag(t−1) + 0.12 × drag(t−2)` from those **calendar dates**, not the previous saved rows. Only resolved canonical action results supply drag; a pending or absent observation is not invented.
4. `intendedChange = roundedRawChange − roundedShadow`; `velocity = max(0, previousVelocity + intendedChange)`; `actualChange = velocity − previousVelocity`. Start new accounts at 100. Avoid applying a floor twice in different stages.
5. Compute engine streaks once from actual change after shadow/floor: positive increments positive and resets negative; negative does the reverse; zero resets both in this candidate. The explanation must show raw, multiplier, shadow, intended change and actual change separately. Negative intent at a zero floor is not displayed as lost velocity.
6. Use an explicit shared rounding policy, recommended half away from zero, with golden fixtures. That differs from legacy JavaScript rounding on negative ties and must be versioned. Exact cap examples and state thresholds come from fixtures; do not preserve inaccurate About-page claims.

**Gap policy is a separate B decision.** Recommended conservative candidate: an unrecorded, pending or no-action day carries velocity unchanged and resets multiplier streak continuity only when that local day closes; an unfinished today cannot prematurely reset yesterday's continuity. Shadow is applied only on an eligible scored day using its calendar predecessors. Scheduled off-days, reflection and excuses must not be silently treated as failed actions. This multiplier reset is separate from the habit success streak's off-day/excuse rules.

**Optional attached-plan variant, not selected:** apply shadow on unlogged days, decay velocity by 3%, permit one missed-day positive-streak grace and retain negative streak across gaps. This introduces new penalties and must be approved separately if B is chosen. Before implementation define which dates qualify, off-day/rest/no-action behavior, exact order and rounding, zero-floor behavior, grace reset conditions and how backfill replaces the synthetic result. A past gap is unknown data; penalizing it is a product choice, not a correctness fix. Model these as dated, versioned system trajectory adjustments, separate from action scores and check-in status. They cannot fabricate answers, finalize a check-in or earn a streak. Compute/replay them deterministically through closed dates with trusted revision checks; the UI shows momentum as of the adjustment date and labels the adjustment separately.

**Tradeoff:** preserves the simulation but is harder to explain. Raw outcomes depend on routine size/composition; adding more high-weight habits can increase gains. Advisory balance does not fix that, and quotas are not adopted as a workaround. Explain this limitation, avoid rankings/comparisons between users and pilot whether people understand negative multipliers and shadow. Do not quietly blend A's normalized formula into B.

### Engine gate acceptance

Select A or B and record every constant, rounding step, gap rule, finalization interaction, zero-floor outcome and replay boundary in `docs/ENGINE.md`. Include worked first-day, gap, partial, all-excused, backfill, retier/archive, shadow-sign-change and floor examples where relevant. Generate UI explanations from the same fixture values. Test user understanding before implementation is declared complete. A legacy snapshot and cutover plan are required for either choice; “B resembles the old engine” does not mean all fixes preserve old numerical history.

## 5. Architecture and implementation boundaries

**Recommend React + TypeScript + Vite with Supabase.** This is a maintainability choice, not a claim that vanilla JavaScript cannot be production-ready. First extract pure logic and typed repositories, preserve the existing working changes, then replace screens incrementally. Keep static hosting and narrow trusted server operations; a separate general-purpose API service is unnecessary for this scope.

| Boundary | Responsibility |
|---|---|
| Domain | Pure dates, scheduling, eligibility, score, metrics, streaks and replay with explicit clock/timezone inputs. |
| Data | Typed repositories, boundary validation, pagination, mutations, retries and conflicts. Rename the custom `Storage` global. |
| Session/state | Explicit boot/auth/offline/expired states, account-scoped caches, generation guards and stale-request rejection. |
| Features | Onboarding, Today/check-in, habits, history/review, reflection and account/data settings. |
| Components | Safe rendering, accessible controls and complete loading/empty/error states. |
| PWA | Versioned static shell, IndexedDB drafts/outbox, connectivity and update lifecycle. |
| Backend | Migrations, grants/RLS, constraints, indexes, ownership checks and atomic mutations. |

The shared TypeScript engine supplies client previews and trusted server calculations. The server reads authoritative definitions and verifies the complete source-revision basis; client-supplied scores never become authoritative by themselves. Narrow database functions commit validated results atomically.

Remove global cache duplication and inline event handlers. In React use framework event/state conventions rather than retaining a parallel global event architecture. Add a content security policy appropriate to the built app. Validate startup environment configuration; browser-prefixed variables are public, so only public Supabase configuration belongs there. Keep service credentials server-side.

Use Vitest for domain/data contracts, ESLint/Prettier, type checking and PR CI. Characterize legacy behavior before replacing it. Require meaningful scenarios rather than a vague promise of “full coverage.” Pin dependencies in a lockfile and review upgrades. Sort history once, paginate completely and replay from a valid checkpoint; do not reload/recompute all history on every tap.

## 6. Data model and trusted mutation contracts

Use additive migrations around verified existing schema. Capture full definitions in immutable revision rows or equivalent complete snapshots; `{polarity,tier,opts}` alone cannot preserve old wording, schedules or choice identity.

| Entity | Required meaning/invariant |
|---|---|
| Profile/settings | Owner, IANA timezone, week start, locale, onboarding and privacy preferences. Reuse existing settings when appropriate. |
| Habit | Stable ID, owner, library/custom source, creation and archive state. |
| Habit revision | Immutable label, stable choices/IDs, priority, schedule and effective interval. |
| Day plan | Owner/date, captured timezone, ordered eligible revisions and explicit rest exceptions. |
| Check-in | Unique owner/date, separate working/finalized pointers, answers, optional reflection, engine version and revision. |
| Check-in revision | Prior values, source/import/edit provenance and restoration basis. |
| Derived result/checkpoint | Eligibility/status, breakdown, velocity/streak facts, engine/source/history revisions and replay boundary. |
| Mutation receipt | Unique owner/operation ID, payload hash, committed revision and canonical result. |
| Import/migration job | Format version, manifest/checksum, counts, status, errors and final completion record. |

Validated JSONB keyed to immutable definition/choice IDs is sufficient initially. Enforce owner/date uniqueness, valid dates/choices, foreign ownership, enums and size bounds in the trusted/database boundary. Use server timestamps and explicit monotonic revisions. Allocate ordering transactionally; concurrent `max+1` is unsafe without serialization. Do not make all habits fixed or require exactly three options.

### Transactional operations

- **Create/revise plan:** validate ownership/effectivity; atomically write revisions and the ordered plan; reject stale bases.
- **Save/finalize:** accept operation ID/hash, expected check-in/plan revisions, selected date/timezone and content. Draft changes do not replace the committed score. Finalization validates eligibility and commits the finalized pointer, derived results or authoritative replay marker, and receipt together.
- **Retry:** the same operation/payload returns the same receipt. Reusing its ID with different content is rejected. A lost response must not generate a new unintended write.
- **Conflict:** stale revisions return typed current-state information. Preserve local work. Auto-merge only disjoint edits with a proven common base and compatible plan; overlapping answers, reflection, plan or finalization need a comparison and explicit resolution.
- **Historical correction/delete/restore:** preview impact, validate the expected history revision and replay the affected suffix with original definitions. Legacy history remains read-only in the ordinary editor; separate reviewed repairs cannot silently change the frozen baseline.
- **Import:** stage/validate first, then atomically publish an approved manifest or complete a resumable job with a final publish step. Chunked upserts alone do not prevent half-imported history.
- **Account deletion:** narrowly privileged, ownership/reauthenticated operation with a verifiable job state and removal of the owned graph.

Serialize trajectory changes per account through an aggregate history revision and database lock. Comparing only the edited row does not protect against two devices editing different dates. If a server function calculates outside the final database transaction, compare the full revision basis at commit and retry if it changed. Invalidate checkpoints from the earliest affected date. Prevent direct table writes from bypassing these contracts; review grants, privileged function ownership and search paths.

A derived daily cache is optional after correctness and measurement. It must be written by trusted calculation and keyed to source versions. Reading 30 days requires a valid preceding checkpoint; the cache never replaces portable raw history.

If replay is asynchronous, a committed check-in and an up-to-date trajectory are separate acknowledgements. Expose **Recalculating momentum** with the last valid result's date/revision until trusted replay completes. Do not present stale downstream values as current or confuse this processing state with unanswered-action score pending. Repeated replay jobs must be safe and recoverable.

### Errors and recovery

Return stable categories plus clear messages. Validation identifies fields; auth pauses sync until the same account returns; conflicts open comparison; rate limits provide retry delay; transient errors retry the same operation with bounded backoff. Unsupported clients preserve work and request a safe update.

A timeout means the save outcome is unknown. Query/retry its receipt before creating another operation. Distinguish “Could not save” from “Saved; latest view could not load.” A failed initial load must never become an editable empty record. Log request IDs/categories without private payloads.

## 7. Authentication, authorization and privacy

Test confirmation/resend, expired links, signup redirect, Google/OAuth errors, recovery/reset, token expiry, sensitive-action reauthentication and deletion. Validate redirect allowlists and real email delivery in staging. Enforce password policy server-side and prevent duplicate submissions. Magic links remain optional later.

Use one auth subscription. Handle initial boot once, defer dependent database work outside auth callbacks, preserve token refresh without unnecessary full reboot and reload account data when identity changes. Generation guards reject late user-A results after switching to B. Clear every cache, form and rendered fragment on logout. Exact current SDK callback timing must be tested after pinning; source structure establishes race risk, not an observed universal refresh cadence.

On network-failed logout, complete local logout/cleanup while distinguishing it from confirmed remote-session revocation. Resolve pending work through sync/export/discard choices; never replay a previous account's queue into another account. Account deletion must deny further online access, revoke sessions and clear this device; already-offline devices are cleared when they reconnect, not through an impossible instant remote wipe.

Version grants/RLS for every table/view/function and test anonymous and two-user isolation across normal writes, forged owner/foreign IDs, exports, imports and deletion. Ownership predicates must protect both old and new row references. Browser publishable configuration is expected; authorization must come from sessions, grants and policies.

Use the [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) when defining operation-specific policies; client filtering alone cannot supply those ownership protections.

Keep reflection notes, mood and sensitive habit names out of analytics, logs, URLs, notifications and session replay. Use coarse lifecycle events, minimized identifiers and diagnostic IDs. Explain account versus device storage and local retention. Local account separation does not promise encryption against someone controlling the device.

Archive is reversible and preserves history. Retain the earlier proposal for a **30-day trash period** on individually deleted check-ins, with visible permanent-delete controls. Confirm actual backup retention before publishing deletion promises; active-data deletion and backup expiry are different. Restores must reapply deletion records to avoid resurrecting removed content. Privacy/help copy must describe verified infrastructure behavior.

## 8. PWA and offline: deliberate launch work

Provide manifest/icons, standalone layout and optional install guidance. The browser app remains complete without installation. Cache versioned static assets separately from private data. Offline opening assumes the app/account was previously prepared online; a new unauthenticated device cannot magically obtain private plans.

IndexedDB drafts are keyed by account, date, plan version and base server revision. The outbox stores stable operation IDs, hashes, expected revisions and state. Persist changes locally and show **Saved on this device → Waiting to sync → Synced**, or **Needs review**. Device persistence is not account commitment.

Flush on foreground/resume/reconnection with bounded retries; background execution is only an optimization. Revalidate the matching account before queued writes. Session expiry quarantines that account's work until it reauthenticates. Another account cannot display or submit it. Support sign-out with pending work and ignore delayed old-session responses.

Browsers can stop service workers, so the required sync path must survive without uninterrupted background execution. [MDN offline/background guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation).

Handle denied storage/quota failure with a clear memory-only warning. Offline edits use cached due plans; unsupported plan changes wait for connectivity. If a future plan is unavailable, show that limitation instead of inventing a schedule. Browser clearing/uninstallation can remove device-only work; it is not a backup.

Service-worker updates preserve/migrate drafts and queues, avoid activating destructively during editing, and prompt at a suitable moment. Test old/new client coexistence, unsupported schema writes, iOS Safari/Android Chrome/desktop behavior and connectivity changes after a server commit. A manifest and localStorage alone do not deliver this contract.

## 9. Migration, historical truth and portability

1. **Inventory:** record deployed version, actual schema/policies/settings, API limits, counts, ownership anomalies and backup availability. Distinguish committed source, local modifications and deployed behavior.
2. **Prove recovery:** restore to isolated staging; capture counts, checksums and representative exports. Rehearse rollback or forward repair with frontend/database compatibility.
3. **Map identities:** convert old per-user question keys to stable habit/revision/choice IDs with collision and orphan reports. Preserve raw payloads and unknown values; do not guess lost definitions.
4. **Add versioned structures:** apply additive schema, policies and adapters; separate fresh onboarding from legacy upgrade. Do not drop settings merely because the current adapter stopped reading them.
5. **Freeze the legacy era:** historical definitions were not versioned. Reconstruct only what evidence supports, label the limitation and preserve the last defensible legacy velocity as the new-era baseline. This is not guaranteed original historical truth. For B, the recommended transition preserves that velocity but resets engine multiplier streaks and pre-cutover shadow carry to zero at the boundary. Record this reset in the transition manifest and explanation; ordinary check-in/habit history remains separate. Carrying legacy streak/drag context forward is a different possible migration policy and would require frozen, evidenced inputs plus first/second-day fixtures before adoption.
6. **Choose and cut over:** freeze A or B and its exact version, then start at a visible boundary. Pre-cutover records remain available/read-only with annotations. Deletion/privacy controls remain available; an explicit legacy repair requires its own impact review.
7. **Investigate bad dates:** inspect concentration around the old demo date and any backup/audit evidence. Do not shift all matching records or promise recovery of overwritten data without source versions. Preserve/quarantine anomalies for review.
8. **Rehearse and release gradually:** bounded idempotent jobs, interrupted retries, counts/checksums, export/restore verification, internal accounts, small beta, then broader rollout. Close obsolete write paths and keep compatible rollback/repair artifacts.

Export a versioned bundle including definitions/revisions, schedules, archived state, day plans, raw answers, optional reflections, check-in revisions, timezones, engine versions and transition baselines. Validate import size, schema, ownership, dates and choice meaning; preview accepted/rejected rows and duplicate keep/replace decisions. Never trust incoming foreign IDs or future answers. A round-trip into a clean account must reproduce supported history and explicitly report unsupported/legacy uncertainty.

## 10. Operations, testing and release evidence

Separate local, staging and production configuration/projects. Use synthetic preview data and protected deployment credentials. Run type/lint/build, domain fixtures, migration/authorization tests and relevant browser flows on PRs. Promote an identified artifact/commit through staging with smoke checks, migration report and rollback instructions. Vercel/Netlify and Sentry are candidate tools; choose providers/tier from verified needs and budget, not unverified defaults.

Add `SECURITY.md`, contribution guidance, `docs/ENGINE.md`, release/incident/restore/account-deletion runbooks and named owners. Observe redacted boot/auth/save/sync/import/replay failures, API latency, queue age and conflict rate. Distinguish offline queues from backend incidents. Alerts require an action and owner. Give users support/help and a private-content-free diagnostic ID.

Measure first finalized check-in, time to first value, recovered drafts, weekly return, return after a missed day and ability to explain a result. Define denominators beforehand. Answers are unnecessary for product analytics; a vendor and session replay are not mandatory.

| Area | Proposed acceptance target, not a measured result |
|---|---|
| Mobile loading | LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 at p75 when field data exists; document a midrange-device test profile before launch. [Core Web Vitals](https://web.dev/articles/vitals). |
| Local interaction | Visible response under 100 ms; durable draft confirmation within 500 ms on the agreed device. |
| Online save | p95 confirmed save under 2 s under a documented regional/network profile. |
| Reliability | ≥99.5% successful valid online saves in beta, with defined exclusions; zero unexplained loss of acknowledged saves. |
| History | Complete responsive handling of at least five calendar years and 30 habits, including leap days; exceed configured API page limits in fixtures. |
| Recovery | Proposed RPO ≤24 h and RTO ≤4 h, adopted only after backup-tier/cost review and a timed staging restore. |

Supabase's usual query cap is configurable; verify the live limit and implement deterministic pagination. Omitted newer rows are a fetch problem, not evidence they were deleted. Backups must cover necessary database/configuration evidence and be restore-tested. Set spend/quota/email/request/import limits, capacity thresholds and a response when limits approach.

### Required scenario matrix

1. **Domain:** every choice/boundary, invalid/null/orphan answers, partial finalization, all-excused/reflection-only, zero floor, selected engine's gap/shadow/rounding rules, immutable definitions and deterministic replay.
2. **Dates/schedules:** Kolkata/Los Angeles boundaries, UTC extremes, DST/leap/year transitions, travel, overnight editor, scheduled rest, pause and archived restoration.
3. **Accounts/security:** anonymous/two-user matrix, forged linked owners, rendering injection, auth events, sign-out during load/save, rapid switching, deleted-account token reuse.
4. **Writes:** lost response, receipt deduplication, same-date/different-date concurrent edits, stale plan, commit followed by failed refresh, failed-load blank form and conflict resolution.
5. **Offline/PWA:** reopen/reload, expired auth, storage failure, unavailable cached plan, reconnect retry, pending-work logout, old/new client and update with queued work.
6. **Product journeys:** one-habit onboarding, optional reflection, routine changes, history/backfill, reviews, recovery links, export/import round-trip, selected/account deletion and restoration.
7. **Migration/ops:** key collisions/orphans, unchanged source payloads, legacy baseline, interrupted job retries, multi-page history, restore, alert and rollout/rollback drills.
8. **Verified display bugs:** zero velocity flame fallback, zero-change “first entry” copy, reachable rocket-state thresholds, exact seven-day windows with future-date exclusion and correct answered counts.
9. **UX evidence:** users understand local versus synced, pending versus scored and the selected engine. The UI plan's accessibility/mobile gates pass.

## 11. Delivery sequence and ownership

The attached plan's short phase estimates are useful task-sizing prompts, but do not cover this full migration/offline/product scope. Estimate calendar delivery after repository/backend discovery and engine selection; report staffing, dependencies and contingency. Avoid treating parallel work as free capacity.

| Work package | Lead roles | Exit condition |
|---|---|---|
| 0. Baseline and containment | Technical lead + backend | Current work preserved; credential disposition; isolation, dates/rendering, backup and draft safeguards verified. |
| 1. Foundations | Frontend + domain/backend | Typed modules, pinned build, characterization tests, state/session boundaries and CI. UI design system can proceed in parallel. |
| 2. Product contracts and engine gate | Product + domain + design | A/B choice and B subdecisions if relevant, common state/metric rules, worked fixtures and understandable explanations. |
| 3. Schema and transactions | Backend/domain | Immutable revisions, ownership, idempotent receipts, conflict handling, source-preserving migration rehearsal and replay protection. |
| 4. Complete daily product and PWA | Frontend + backend + design | Full onboarding/Today/habits/history/reflection/account journeys and offline sync; provisional versus canonical results clear. |
| 5. Hardening and controlled release | Technical lead + QA + operations | Performance, device, recovery, migration and usability evidence; support/runbooks, small beta and release sign-off. |

Auth/account, environment setup and design tokens can proceed during foundation work; production score explanations wait for the engine gate. History and offline integration depend on stable revision/mutation contracts. Do not implement two production engines merely to postpone the decision.

The product owner signs off behavioral choices and beta outcomes; the technical lead owns architecture/release readiness; engineers own data/PWA correctness; QA owns reproducible scenario evidence; an operational owner owns alerts/restores/support. One person may hold several roles, but none should be implicit.

Launch only after agreed P0/P1 scope has no unresolved blockers, linked acceptance evidence passes and a small beta completes the entire loop. The objective is predictable ordinary use, interruption, mistakes and recovery—not merely a successful build.
