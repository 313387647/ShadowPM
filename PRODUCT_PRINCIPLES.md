# ShadowPM Product Constitution

ShadowPM is an AI Native Project Management Platform for fast internal project control, not a traditional task tracker.

Every product, design, architecture, and implementation decision must serve the same outcome: turn messy project information into a dense, editable, reliable project control table with the fewest possible steps.

## Non-Negotiable Principles

1. AI first, not AI as an add-on.
   AI must be part of the primary workflow for creating, updating, explaining, and correcting project data. A feature that treats AI as a side panel only is incomplete.

2. Extreme speed over feature volume.
   If a workflow cannot reduce time, clicks, or cognitive load, remove it or redesign it. More features are not progress by default.

3. Low learning cost.
   A new user should understand the core workflow within minutes: import or describe a project, review the generated control table, fill gaps, and keep it updated.

4. Keyboard first.
   Common actions should be reachable through typing, shortcuts, command patterns, or inline editing. Mouse-heavy workflows are acceptable only when they are clearly faster.

5. Minimum clicks and minimum page switching.
   Prefer inline editing, progressive disclosure, and contextual actions. Avoid making users jump across pages or tabs just to answer one project question.

6. Information density with clarity.
   ShadowPM should feel closer to a sharp operating cockpit than a decorative dashboard. Dense data is good when hierarchy, spacing, and states remain readable.

7. The project control table is the core artifact.
   Control items, owners, departments, deadlines, progress conclusions, watch items, budget links, calendar links, and AI summaries should converge into the control table experience instead of living as disconnected modules. Do not create separate risk or asset centers unless they directly accelerate the control table workflow.
   The canonical project structure is defined in `CANONICAL_PROJECT_SCHEMA.md`; new AI import, data model, and UI work should follow that schema unless it is intentionally revised.

8. Missing information is allowed.
   AI should ask for essential gaps, but it should not block progress on every unknown field. Non-essential gaps should become visible, editable cells in the control table.

9. Consistency beats novelty.
   Use a consistent design system, interaction model, naming system, and data model. Do not create one-off controls or patterns unless they clearly improve speed.

10. Maintainability beats cleverness.
    Choose boring, understandable architecture. Prefer explicit data flow, small modules, typed boundaries, and testable logic over impressive but fragile abstractions.

11. Trust is a product feature.
    Budget, status, timeline, AI actions, and permissions must be auditable. AI-generated or AI-executed changes should be explainable and reversible where business rules allow.

12. Challenge compatibility when compatibility preserves a bad idea.
    Do not keep broken flows, names, APIs, or database shapes only because they already exist. Preserve user value, not accidental implementation details.

## AI Interaction Rules

- AI must support multi-turn clarification before creation or mutation.
- AI should distinguish between required gaps and optional gaps.
- AI should make a draft usable as early as possible.
- AI should let users say: "create it first, I will fill the missing parts in the table."
- AI actions that mutate important project data should show what will change before applying when confidence is low.
- AI output should become structured project data, not just chat text.

## Design Rules

- Default to the working product screen, not marketing or explanation.
- Keep primary actions close to the data they affect.
- Prefer inline editing over modal forms when editing table-like project data.
- Use modals only for focused creation, confirmation, or destructive actions.
- Avoid decorative UI that does not improve understanding or speed.
- Tables, lists, and command interfaces are first-class surfaces.
- Empty states should help the next action, not explain the entire product.

## Engineering Rules

- All new modules must explain how they advance AI-first project control.
- Every substantial change must pass:
  - `npm test`
  - `npm run lint`
  - `npm run build`
- Add tests around business rules before expanding UI complexity.
- Keep Server Actions permission-aware.
- Keep budget and timeline logic append-only unless the product constitution is explicitly updated.
- Use database transactions for multi-step mutations that must succeed or fail together.

## Decision Filter

Before adding or keeping any feature, answer:

1. Does this help users generate, update, or manage a project control table faster?
2. Does this reduce learning cost or cognitive load?
3. Does this support AI-native operation rather than manual administration?
4. Does this keep the system maintainable and consistent?
5. Would removing this make the product simpler without hurting the core workflow?

If the answer is weak, do not build it yet.
