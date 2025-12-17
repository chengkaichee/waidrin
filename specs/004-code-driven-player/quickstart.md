# Quickstart Guide: Natural Language Command Processor

This guide outlines the steps a developer would take to implement the Natural Language Command Processor feature based on the `plan.md`.

## Prerequisites

- Familiarity with the project structure, especially the `game-rule-dnd5e` plugin.
- Understanding of the `AppBackend` service and the `getObject` pattern which uses a `Prompt` and a `Zod` schema.

## Implementation Steps

### 1. Create the Player Action Prompt

- **File:** `plugins/game-rule-dnd5e/src/pluginPrompt.ts`
- **Task:** Create a new function `getPlayerCombatActionPrompt` that takes the player's raw command string and the current battle state and returns a `Prompt` object formatted for the `AppBackend`. This prompt will instruct the AI to parse the string into a `CombatAction` object.

### 2. Refactor `executeCombatRound`

- **File:** `plugins/game-rule-dnd5e/src/main.tsx`
- **Task:** Modify the `executeCombatRound` method to adopt the new sequential action pipeline.

#### a. Remove Placeholder Logic
   - Find the `// TODO:` block where `playerActionObject` is currently hardcoded and delete it.

#### b. Parse the Player's Command
   - At the top of the function, add a `try/catch` block.
   - Inside this block, call the new `getPlayerCombatActionPrompt` function and then use `await this.appBackend.getObject(prompt, CombatActionSchema)` to get a structured `playerActionObject`.
   - The existing `CombatActionSchema` from `pluginData.ts` should be used.

#### c. Update NPC Action Generation
   - Modify the `getCombatRoundActionsPrompt` function in `pluginPrompt.ts` to accept the structured `playerActionObject` instead of the raw `playerAction` string.
   - Update the call within `executeCombatRound` to pass this structured object. This ensures NPCs react to the player's committed action.

#### d. Unify Actions
   - Create a single `allActions` array.
   - Add the `playerActionObject` to this array.
   - Add the `npcActions` (returned from the second backend call) to the array.
   - The rest of the function, which sorts and resolves these actions, should remain the same.

## Verification

- After implementation, run the application and start a combat encounter.
- Enter a natural language command (e.g., "I attack the goblin").
- Check the console logs for "DEBUG: All Actions in Initiative Order:".
- Verify that the player's action is correctly parsed and included in the list.
- Verify that there is no duplicate player action in the list.
- Verify that the game proceeds and the action is resolved correctly in the narrative output.
