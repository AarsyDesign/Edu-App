# VRD — Very Detailed Atomic Implementation Roadmap
Version: 0.1
Purpose: agent execution handoff

## Operating Rule

The implementation agent must:
- read PRD.md first
- read DESIGN-SYSTEM.md second
- execute phases sequentially
- never skip acceptance criteria
- avoid speculative features
- preserve working code
- keep commits/changes atomic
- report blockers rather than inventing requirements
- run tests after each logical milestone
- perform visual QA before declaring UI complete

## Phase 0 — Repository and Environment Audit

0.1 Inspect repository root.
0.2 Identify framework/runtime.
0.3 Identify package manager.
0.4 Identify existing lint/test/build scripts.
0.5 Identify environment variable conventions.
0.6 Identify database setup if present.
0.7 Identify deployment target.
0.8 Identify auth implementation if present.
0.9 Identify styling/design system if present.
0.10 Do not replace existing working infrastructure without evidence.
0.11 Record findings in docs/IMPLEMENTATION-AUDIT.md.
0.12 List conflicts with PRD.
0.13 Stop and report if a critical architecture blocker exists.

Acceptance:
- repository is understood
- existing conventions documented
- no destructive changes made

## Phase 1 — Product Foundation

1.1 Create/verify app shell.
1.2 Establish route structure.
1.3 Establish error boundary.
1.4 Establish loading patterns.
1.5 Establish responsive breakpoints.
1.6 Establish design tokens from DESIGN-SYSTEM.md.
1.7 Establish typography.
1.8 Establish color tokens.
1.9 Establish spacing/radius/shadow tokens.
1.10 Establish reduced-motion behavior.
1.11 Establish audio preference storage.
1.12 Create base UI primitives.
1.13 Verify primitives visually.

Acceptance:
- no page uses arbitrary one-off design values unless justified
- primitives are reusable
- visual tokens are centralized

## Phase 2 — Data Model

Create entities conceptually equivalent to:

ParentAccount
ChildProfile
LearningArea
Skill
Activity
ActivityOption
ActivityAttempt
LearningProgress
LearningSession
ContentReview
ContentSource
AppSetting

2.1 Define primary keys.
2.2 Define foreign keys.
2.3 Define timestamps.
2.4 Define ownership relationships.
2.5 Define content status enum.
2.6 Define activity type enum.
2.7 Define age range.
2.8 Define difficulty.
2.9 Define content origin.
2.10 Define review status.
2.11 Add indexes for parent_id, child_id, learning_area, age range, status.
2.12 Add uniqueness constraints where needed.
2.13 Create migration.
2.14 Verify migration from clean database.
2.15 Verify migration rollback/recovery strategy if supported.

Acceptance:
- schema supports MVP
- child data cannot be queried without parent authorization
- no unnecessary PII fields exist

## Phase 3 — Authentication and Parent Ownership

3.1 Implement parent registration.
3.2 Implement parent login.
3.3 Implement logout.
3.4 Implement session expiration.
3.5 Protect parent routes.
3.6 Protect child profile APIs.
3.7 Enforce server-side ownership checks.
3.8 Prevent client from supplying arbitrary parent_id.
3.9 Add basic rate limiting to auth-sensitive endpoints.
3.10 Add safe error messages.
3.11 Do not expose whether arbitrary email exists where inappropriate.

Acceptance:
- parent can authenticate
- unauthorized parent cannot access another parent's child
- auth failures do not leak sensitive information

## Phase 4 — Child Profile

4.1 Create child profile.
4.2 Select age 3–7.
4.3 Select nickname.
4.4 Select non-living avatar.
4.5 Select language.
4.6 Select learning goals.
4.7 Store parent ownership.
4.8 Implement child switcher for multi-child parents.
4.9 Implement edit profile.
4.10 Implement delete/archive profile according to retention policy.
4.11 Add parent gate before sensitive settings.

Acceptance:
- child profile creation takes minimal steps
- no public child profile exists
- parent can manage multiple children

## Phase 5 — Learning Areas and Skills

5.1 Seed six MVP learning areas.
5.2 Define initial skills per area.
5.3 Define age suitability.
5.4 Define basic difficulty levels.
5.5 Define prerequisite relationships where useful.
5.6 Ensure skills are content-configurable, not hardcoded into UI.

Acceptance:
- content can be assigned to a learning area and skill
- age filtering works

## Phase 6 — Activity Engine

6.1 Define activity JSON/domain contract.
6.2 Implement Tap Answer.
6.3 Implement Count Objects.
6.4 Implement Match.
6.5 Implement Sequence.
6.6 Implement Identify Color.
6.7 Implement Identify Shape.
6.8 Implement simple Multiple Choice.
6.9 Validate answer server-side when persisted.
6.10 Implement retry.
6.11 Implement completion.
6.12 Implement explanation/feedback.
6.13 Ensure activity renderer is type-driven.
6.14 Ensure invalid activity payloads fail safely.
6.15 Add test fixtures for each activity type.

Acceptance:
- one activity can render and complete
- each activity type has tests
- malformed content does not crash the app

## Phase 7 — Child Home and Learning Journey

7.1 Build child home.
7.2 Show current learning journey.
7.3 Show next recommended activity.
7.4 Show progress without competitive ranking.
7.5 Build area selection.
7.6 Build session start.
7.7 Build session completion.
7.8 Add gentle progress animation.
7.9 Add empty-state for no progress.
7.10 Add offline/degraded handling if feasible.

Acceptance:
- child can reach first activity in <= 2 meaningful taps after profile selection
- UI remains readable for ages 3–4
- no unnecessary text

## Phase 8 — Baseline Assessment

8.1 Define 5–10 baseline activities.
8.2 Randomize within controlled difficulty.
8.3 Store attempts.
8.4 Calculate initial skill estimates.
8.5 Assign starting recommendations.
8.6 Do not label child as pass/fail.
8.7 Allow parent to skip/restart if needed.
8.8 Ensure assessment is short.

Acceptance:
- age determines initial pool
- assessment refines starting point
- result does not shame child

## Phase 9 — Progress Engine

9.1 Store activity attempts.
9.2 Calculate completion.
9.3 Calculate simple skill accuracy.
9.4 Track recent performance.
9.5 Generate next recommendation.
9.6 Add mastery thresholds only when evidence supports them.
9.7 Avoid overfitting from very small sample sizes.
9.8 Add parent-readable progress summary.

Acceptance:
- progress persists
- repeated attempts do not corrupt history
- recommendation logic is deterministic and testable

## Phase 10 — Parent Dashboard

10.1 Build child overview.
10.2 Show sessions.
10.3 Show learning areas.
10.4 Show strengths.
10.5 Show suggested practice.
10.6 Show settings.
10.7 Add audio preference.
10.8 Add session preference.
10.9 Keep dashboard low-density.
10.10 Add privacy/data controls as applicable.

Acceptance:
- parent can understand child status in under 30 seconds
- no vanity analytics dominate

## Phase 11 — Content Management

11.1 Create admin/content authentication boundary.
11.2 Create activity editor.
11.3 Create learning area selector.
11.4 Create age range selector.
11.5 Create difficulty selector.
11.6 Create interaction type selector.
11.7 Create options/answer editor.
11.8 Create explanation editor.
11.9 Create source field.
11.10 Create content origin field.
11.11 Create review status.
11.12 Preview activity as child.
11.13 Publish only from approved state.
11.14 Prevent draft from appearing in production child feed.

Acceptance:
- content workflow cannot bypass approval
- preview matches production renderer

## Phase 12 — AI-Assisted Draft Pipeline

AI is a content production helper, not an authority.

12.1 Define structured prompt/schema for activity drafts.
12.2 Generate small batches.
12.3 Validate schema.
12.4 Reject malformed drafts.
12.5 Mark origin AI_DRAFT.
12.6 Send to human review.
12.7 Reviewer checks age suitability.
12.8 Reviewer checks factual correctness.
12.9 Reviewer checks wording.
12.10 Reviewer checks answer.
12.11 Reviewer checks explanation.
12.12 Reviewer checks source where required.
12.13 Reviewer approves/rejects.
12.14 Only approved content can publish.
12.15 Store content version.

Acceptance:
- AI output never auto-publishes
- every published AI-drafted activity has human approval

## Phase 13 — Seed 100 Activities

13.1 Create 25 number/counting activities.
13.2 Create 20 language/letter activities.
13.3 Create 20 logic activities.
13.4 Create 15 shape/color activities.
13.5 Create 10 world knowledge activities.
13.6 Create 10 adab/Islam activities.
13.7 Balance ages.
13.8 Balance activity types.
13.9 Review every activity manually.
13.10 Run content QA.
13.11 Test every activity in child mode.
13.12 Fix confusing activities.
13.13 Publish approved set.

Acceptance:
- 100 production-ready activities
- no activity has unresolved correctness issue
- no AI draft remains directly visible

## Phase 14 — Audio and Motion

14.1 Add mute setting.
14.2 Add optional short SFX.
14.3 Add optional voice instruction architecture.
14.4 Ensure music is OFF by default.
14.5 Add reduced motion.
14.6 Audit all animations.
14.7 Remove unnecessary continuous motion.
14.8 Check sound levels.

Acceptance:
- app is fully usable without music
- reduced motion removes nonessential motion

## Phase 15 — Privacy and Child Safety Review

15.1 Inventory every child data field.
15.2 Remove unnecessary fields.
15.3 Verify child data is not public.
15.4 Verify child profile cannot access community.
15.5 Verify parent gate on sensitive actions.
15.6 Verify external navigation gate.
15.7 Verify purchase gate.
15.8 Verify logs do not leak child PII.
15.9 Verify analytics are minimized.
15.10 Document retention/deletion behavior.

Acceptance:
- no direct child social interaction
- no accidental PII exposure
- ownership checks verified

## Phase 16 — Quality Assurance

16.1 Unit test domain logic.
16.2 Integration test auth.
16.3 Integration test child ownership.
16.4 Test activity renderer.
16.5 Test progress calculations.
16.6 Test recommendation logic.
16.7 Test content publishing.
16.8 Test AI draft approval.
16.9 Test error states.
16.10 Test mobile viewport.
16.11 Test tablet viewport.
16.12 Test touch targets.
16.13 Test reduced motion.
16.14 Test audio off.
16.15 Test slow network.
16.16 Test empty database.
16.17 Test invalid content.

Acceptance:
- no critical path without tests
- no known critical privacy or auth issue

## Phase 17 — Anti-Slop Visual QA

17.1 Review every primary screen against DESIGN-SYSTEM.md.
17.2 Check hierarchy.
17.3 Remove redundant cards.
17.4 Remove decorative clutter.
17.5 Check spacing consistency.
17.6 Check typography hierarchy.
17.7 Check color semantics.
17.8 Check animation restraint.
17.9 Check illustration consistency.
17.10 Check child appropriateness.
17.11 Check parent trust.
17.12 Capture representative screenshots.
17.13 Perform final visual review.

Reject and revise if:
- screen resembles generic SaaS
- generic AI illustration dominates
- too many pills/cards
- excessive gradients
- excessive motion
- unclear primary action

## Phase 18 — Performance

18.1 Measure initial load.
18.2 Optimize images.
18.3 Lazy-load noncritical assets.
18.4 Avoid large bundles.
18.5 Cache safe static content.
18.6 Verify activity transition speed.
18.7 Verify memory behavior on low-end mobile.
18.8 Verify tablet performance.

Acceptance:
- first meaningful child interaction is fast
- no unnecessary media blocks the first activity

## Phase 19 — Deployment

19.1 Configure production environment.
19.2 Configure database.
19.3 Configure secrets.
19.4 Configure backups.
19.5 Configure logging.
19.6 Configure error monitoring.
19.7 Configure HTTPS.
19.8 Configure domain.
19.9 Run production smoke test.
19.10 Verify migration procedure.
19.11 Verify rollback procedure.
19.12 Verify seed/content deployment.

Acceptance:
- production deploy reproducible
- secrets not committed
- database backup strategy documented

## Phase 20 — Post-MVP, Only After Real Usage

Do not implement automatically.

Candidate:
- richer adaptive learning
- parent reports
- more content
- contributor system
- public question bank
- review batches
- scholarly discussion
- reputation
- moderation
- teacher workspace
- donation
- PWA enhancements
- Flutter client

Gate each feature on evidence.

## Final Agent Rule

When uncertain:
1. Prefer existing working architecture.
2. Prefer simplest implementation.
3. Prefer explicit data contracts.
4. Never invent product behavior.
5. Never publish unreviewed educational content.
6. Never expose child data.
7. Never add gamification merely to increase engagement.
8. Never sacrifice learning clarity for visual effects.
