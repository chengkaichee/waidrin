# Implementation Plan: Natural Language Command Processor

**Branch**: `004-code-driven-player` | **Date**: 2025-12-02 | **Spec**: [specs/004-code-driven-player/spec.md](specs/004-code-driven-player/spec.md)
**Input**: Feature specification from `specs/004-code-driven-player/spec.md`

## Summary

This plan details the implementation of the Natural Language Command Processor. The feature will allow players to issue combat commands using natural language. The technical approach involves modifying the existing `game-rule-dnd5e` plugin to parse the player's text command into a structured `CombatAction` object by calling the existing `AppBackend` service. This structured action is then used to inform the generation of NPC actions, and the combined list is resolved by the existing combat engine. This approach extends the existing architecture without creating duplicative code or modifying shared services.

## Technical Context

**Language/Version**: TypeScript (as used in the existing `.tsx` and `.ts` files)
**Primary Dependencies**: React, Zod, and the existing application framework (`AppBackend`, `IGameRuleLogic`).
**Storage**: N/A (State is managed by the application's state manager).
**Testing**: The project appears to lack a dedicated testing framework. Testing will be manual based on the acceptance scenarios in `spec.md`.
**Target Platform**: Web application.
**Project Type**: The feature is a modification to an existing plugin within a larger web application.
**Constraints**: The implementation must not modify the shared `AppBackend` service.

## Constitution Check

*The constitution is a template; a check is not applicable.*

## Project Structure

### Documentation (this feature)

```text
specs/004-code-driven-player/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output (empty)
```

### Source Code (repository root)

The changes will be confined to the existing `game-rule-dnd5e` plugin directory:

```text
plugins/
└── game-rule-dnd5e/
    └── src/
        ├── main.tsx
        ├── pluginData.ts
        ├── pluginPrompt.ts
        └── pluginSpells.ts
```

**Structure Decision**: The implementation will modify existing files within the `plugins/game-rule-dnd5e/src/` directory, adhering to the established project structure.

## Implementation Phases

### Phase 0: Research
No research is required. The implementation path is clear and follows existing patterns in the codebase. The `research.md` file will be created but remain empty.

### Phase 1: Design & Contracts
- **Data Model**: The `CombatAction` data model is already defined in `pluginData.ts` via the `CombatActionSchema`. This will be documented in `data-model.md`.
- **API Contracts**: No new external API contracts are needed as the feature uses the internal `AppBackend` service. The `contracts/` directory will be created but remain empty.

### Phase 2: Implementation Plan

The implementation will be executed in two steps, modifying two files.

**Step 1: Create New Prompt Generation Function**

- **File to Modify:** `plugins/game-rule-dnd5e/src/pluginPrompt.ts`
- **Action:** Add a new exported function `getPlayerCombatActionPrompt`.
- **Details:**
    - **Signature:** `export function getPlayerCombatActionPrompt(playerAction: string, battle: Battle, protagonistId: string): Prompt`
    - **Purpose:** This function will take the raw player command string and the current battle state. It will construct a `Prompt` object that instructs the AI to parse the string into a single, structured `CombatAction` JSON object. It will provide the AI with the list of combatants and the required JSON schema (`CombatActionSchema`) to ensure a valid response.
    - **Invalid Action Handling:** The prompt must explicitly instruct the AI: *"If the user's input is a valid natural language sentence but is NOT a valid combat action in the current context (e.g., 'I want to go fishing'), you MUST return an `actionType` of 'Other' and start the `description` field with 'INVALID_ACTION: ' followed by a brief reason."*

**Step 2: Refactor `executeCombatRound`**

- **File to Modify:** `plugins/game-rule-dnd5e/src/main.tsx`
- **Action:** Modify the `private async executeCombatRound` method to implement the new unified action pipeline.
- **Details:**
    1. **Remove Placeholder:** Delete the existing `// TODO:` block that creates a hardcoded `playerActionObject`.
    2. **Determine Player Action/Guidance:** At the beginning of the function:
        - **Pre-Check: Player Status**: Before processing player input, determine if the player character (`protagonistId`) is currently able to perform an action (e.g., check against `canCombatantAct(playerStatus)`).
        - **If Player Can Act (Standard Flow)**:
            - Initialize `playerActionObject` and `tacticalGuidance = null`.
            - Add a `try/catch` block for parsing the `playerAction` string into `playerActionObject`.
            - Inside `try`: Call `getPlayerCombatActionPrompt` and then `this.appBackend.getObject(prompt, CombatActionSchema)` to get the structured `playerActionObject`.
            - **Validation**: Check if `playerActionObject.actionType === 'Other'` and `playerActionObject.description` starts with `"INVALID_ACTION:"`. If true, throw a new Error with the description content to trigger the catch block.
            - `catch (error)`: This catch block will handle both parsing failures and invalid action flags.
                1. **User Notification:** Display a user-friendly error message indicating the input could not be understood or was invalid.
                2. **Present Options:** The system must offer the user three distinct choices to resolve the failure:
                    - **Option 1: Auto-Resolve (Fallback):** The system constructs a `CombatAction` using safety logic:
                        - **Condition: Life Critical:** Priority 1: **Heal** (if available), Priority 2: **Retreat**, Priority 3: **Dodge**.
                        - **Condition: Life Stable and allies life critical:** Priority 1: **Aid Allies**, Priority 2: **Protect**, Priority 3: **Attack** (best available method).
                        - **Condition: Life Stable:** Priority 1: **Attack** (best available method).
                    - **Option 2: Manual Input:** Provide a UI for the user to manually select: `[Action Type]` - `[Target]` - `[Item]/[Spell]/[Rank]`. The system then constructs the JSON in code, note Rank is for Move actions only, they can move to Front, middle or rear.
                    - **Option 3: Retry:** Allow the user to edit their previous text input and resubmit it to the LLM.
        - **If Player Cannot Act (Incapacitated Flow)**:
            - Set `playerActionObject` to a predefined "unable to act" `CombatAction` (e.g., `{ actorId: protagonistId, actionType: "Wait", description: "Incapacitated and cannot act." }`).
            - Treat the original `playerAction` string as `tacticalGuidance`. This guidance will be used to influence NPC actions.
            - Do NOT run `getPlayerCombatActionPrompt` or `appBackend.getObject` for `playerActionObject`.
            - Do NOT trigger "Invalid Action" error flow for the `tacticalGuidance` content itself (as it's meant as guidance, not a direct action).
    3. **Update NPC Action Prompt:** Modify the call to `getCombatRoundActionsPrompt`. It will now pass either the structured `playerActionObject` (if the player acted normally) or the `tacticalGuidance` (if the player was incapacitated) and the `protagonistId` of the incapacitated player. The `getCombatRoundActionsPrompt` function signature and its internal prompt text must be updated to reflect this, making it clear to the AI that it should generate actions for *non-player* combatants based on the player's committed action OR the player's tactical guidance.
        - **CRITICAL:** The prompt sent to the LLM must explicitly state: "**Do NOT generate an action for the protagonist/player. Only generate actions for the other combatants.**"
        - **CRITICAL:** If `tacticalGuidance` is provided, the prompt must include: *"The protagonist is incapacitated but has issued the following tactical guidance to the party: '[tacticalGuidance]'. Adjust NPC actions to prioritize this request if reasonable."*
    4. **Unify Actions:** After getting the `npcActions`, create a new `allActions` array. First, add the `playerActionObject` (if it exists) to this array. Then, iterate through and add all `npcActions`.
        - **CRITICAL:** Add a filtering step here: `const filteredNpcActions = npcActions.filter(action => action.actorId !== playerActionObject.actorId);` before adding them to `allActions`. This acts as a hard safety net against duplication.
    5. **Resolve:** The rest of the function (sorting `allActions` by initiative and calling `resolveCombatAction` for each) will proceed as it currently does.

This sequential process ensures there is no action duplication and that NPC actions are a strategic response to the player's parsed intent.
