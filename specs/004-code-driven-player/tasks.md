# Tasks: Natural Language Command Processor

**Feature**: Natural Language Command Processor (`004-code-driven-player`)
**Status**: Pending

## Phase 1: Setup
- [X] T001 Verify `CombatActionSchema` availability in `plugins/game-rule-dnd5e/src/pluginData.ts` and ensure it exports the necessary `actionType` enum.

## Phase 2: Foundational
*No foundational tasks required.*

## Phase 3: Natural Language Command Processor
**Goal**: Enable players to issue combat commands in natural language and have them parsed into structured actions.
**Story**: [US1] As a Player, I want to declare actions in natural language so that the system understands my intent.

### Prompt Engineering (`pluginPrompt.ts`)
- [X] T002 [P] [US1] Implement `getPlayerCombatActionPrompt` function in `plugins/game-rule-dnd5e/src/pluginPrompt.ts`.
    - *Detail*: Function must accept `playerAction` string, `battle` object, and `protagonistId`. It must return a `Prompt` that instructs the AI to use `CombatActionSchema`.
    - *Constraint*: Must include explicit instruction: "If input is valid language but invalid or vague (e.g., just 'attack'), return `actionType: 'Other'` and description starting with `INVALID_ACTION:`".

- [X] T003 [P] [US1] Update `getCombatRoundActionsPrompt` signature and logic in `plugins/game-rule-dnd5e/src/pluginPrompt.ts`.
    - *Detail*: Modify signature to accept `playerActionObject` (CombatAction | null), `tacticalGuidance` (string | null), and `protagonistId`.
    - *Constraint*: Update prompt text to explicitly state: "Do NOT generate an action for the protagonist/player" and incorporate `tacticalGuidance` if provided.

### Core Logic Refactoring (`main.tsx`)
- [X] T004 [US1] Remove legacy hardcoded player action logic in `executeCombatRound` in `plugins/game-rule-dnd5e/src/main.tsx`.
    - *Detail*: Delete the `// TODO:` block and the manual creation of the placeholder `playerActionObject`.

- [X] T005 [US1] Implement player status check logic in `executeCombatRound` in `plugins/game-rule-dnd5e/src/main.tsx`.
    - *Detail*: Check `canCombatantAct`.
    - *Logic*: If true, proceed to parsing. If false, set `playerActionObject` to "Wait"/"Incapacitated" and treat input as `tacticalGuidance`.

- [X] T006 [US1] Implement the `try/catch` parsing block in `executeCombatRound` in `plugins/game-rule-dnd5e/src/main.tsx`.
    - *Detail*: Inside `try`, call `getPlayerCombatActionPrompt` then `appBackend.getObject`.
    - *Validation*: Throw error if result contains `INVALID_ACTION:` prefix in description.

- [X] T007 [US1] Implement robust error handling strategies in the `catch` block in `plugins/game-rule-dnd5e/src/main.tsx`.
    - *Detail*: Implement logic to offer 3 choices:
        1. Auto-Resolve (Heal/Retreat/Dodge logic based on HP).
        2. Manual Input (use simple `window.prompt` or existing UI mechanism; do not build new UI components).
        3. Retry (Prompt user to edit previous prompt then Loop back to Input step).

- [X] T008 [US1] Implement unified action list generation with duplication protection in `plugins/game-rule-dnd5e/src/main.tsx`.
    - *Detail*: Call updated `getCombatRoundActionsPrompt` using result from T006/T005.
    - *Critical*: Filter the resulting NPC list: `npcActions.filter(a => a.actorId !== playerActionObject.actorId)` before combining into `allActions`.

## Phase 4: Polish & Cross-Cutting Concerns
- [X] T009 Perform manual verification of the command processor flow per `specs/004-code-driven-player/quickstart.md`.
    - *Check*: Verify "Attack", "Cast Fireball", and "Invalid/Vague" commands.
    - *Check*: Verify Incapacitated state handling (Tactical Guidance).

## Dependencies
- **Story Order**: US1 (Independent)
- **Task Dependencies**:
    - T006 requires T002 (Prompt function) and T005 (Status check).
    - T008 requires T003 (Updated NPC prompt) and T006 (Player action object).

## Implementation Strategy
- **MVP**: Complete all tasks in Phase 3.
- **Parallelization**: T002 and T003 can be implemented in parallel. T004 can be done independently.
