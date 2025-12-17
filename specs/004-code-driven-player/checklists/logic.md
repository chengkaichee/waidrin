# Checklist: Implementation Logic

**Purpose**: A pre-implementation sanity check to validate the correctness and completeness of the logic described in the implementation plan.
**Created**: 2025-12-02

---

## Requirement Clarity

- [x] **CHK001** Is the sequence of operations within `executeCombatRound` explicitly defined? [Clarity, plan.md §Phase 2]
  - **Analysis**: Yes, the `plan.md` under "Phase 2: Implementation Plan" and the `spec.md` under "Integration with Existing Systems" clearly define the sequence: Here is a detailed breakdown of the "as-is" and "to-be" sequence of operations within `executeCombatRound`, along with where each is documented.

  ### As-Is Sequence (The Current Flawed Logic)

  The current process is inefficient and prone to error because it handles the player's action and NPC actions in separate, conflicting ways, causing the action duplication you identified.

  **Documentation:** This logic exists entirely within the `private async executeCombatRound` method in `plugins/game-rule-dnd5e/src/main.tsx`.

  **Detailed Steps (As-Is):**

  1.  **Generate NPC Actions:** The function immediately calls `getCombatRoundActionsPrompt`, passing it the raw `playerAction` string to get a list of `npcActions` from the `appBackend`. This is premature, as the player's action hasn't been properly parsed.
  2.  **NPC Fallback:** It then runs fallback logic to generate basic "Attack" actions for any NPC the AI might have missed.
  3.  **Create Separate Player Action:** A hardcoded `playerActionObject` is created for the player.
      *   This logic completely ignores the natural language input, defaulting to `actionType: "Attack"`.
      *   It simplistically targets the first available enemy.
  4.  **Combine with Duplication:** This hardcoded player action is pushed into an `allActions` array. Then, the `npcActions` from step 1 are also added to this same array. **This is the critical flaw where duplication occurs.**
  5.  **Sort & Resolve:** The combined (and incorrect) list is sorted by initiative and then resolved.

  ### To-Be Sequence (The Corrected Plan)

  The "to-be" process creates a clean, sequential pipeline that correctly uses the natural language processing feature and eliminates all duplication.

  **Documentation:** This new, corrected process is documented in detail in the following files you helped create:
  *   `specs/004-code-driven-player/plan.md` (§ Implementation Plan, Step 2)
  *   `specs/004-code-driven-player/quickstart.md` (§ Implementation Steps)
  *   The high-level requirements driving this change are in `specs/004-code-driven-player/spec.md` (§ Functional Requirements and § Integration with Existing Systems).

  **Detailed Steps (To-Be):**

  1.  **Parse Player's Action First:** The first operation in the function will be to parse the `playerAction` string.
      *   It will call a new prompt function (`getPlayerCombatActionPrompt`) specifically for this task.
      *   It will then call `this.appBackend.getObject()` with this prompt and the `CombatActionSchema` to get a single, structured `playerActionObject`.
      *   A `try/catch` block will ensure that if the NLP parsing fails, a safe fallback action is created instead of crashing the game.
  2.  **Generate NPC Actions (Informed):** The structured `playerActionObject` is then passed to a *modified* `getCombatRoundActionsPrompt`.
      *   This provides the AI with the player's exact, committed action, allowing it to generate intelligent and strategic responses for all non-player combatants.
      *   The `appBackend` is called a second time to get the list of these context-aware `npcActions`.
  3.  **Unify Actions (No Duplication):**
      *   A new, empty `allActions` array is created.
      *   The single `playerActionObject` from step 1 is added to the list.
      *   The `npcActions` from step 2 are added to the list. There is no longer a separate, hardcoded player action.
  4.  **Sort & Resolve:** The final, unified `allActions` list is sorted by initiative and then passed to the existing `resolveCombatAction` method to be executed one by one. This part of the logic does not need to change.
  - This sequence is unambiguous and well-documented.
- [x] **CHK002** Does the plan specify the exact inputs and expected output for the new `getPlayerCombatActionPrompt` function? [Clarity, plan.md §Step 1]
  - **Analysis**: Yes, `plan.md` under "Phase 2: Implementation Plan," "Step 1: Create New Prompt Generation Function," explicitly defines the signature: `export function getPlayerCombatActionPrompt(playerAction: string, battle: Battle, protagonistId: string): Prompt`. It specifies inputs (`playerAction` string, `battle` state, `protagonistId`) and the expected output (`Prompt` object) with its purpose.
- [x] **CHK003** Is the schema for the `playerActionObject` (`CombatActionSchema`) explicitly referenced as the single source of truth for validation? [Clarity, data-model.md] (See separate detailed analysis.)
  - **Analysis**: Yes.
    **1. `CombatActionSchema` Definition:**
      *   **File:** `plugins/game-rule-dnd5e/src/pluginData.ts`
      *   **Purpose:** To define the structure of a single, discrete action a combatant can take, capturing `actorId`, `actionType`, `targetId`, `description`, and `spellName`. It is the fundamental unit of "what happens" in a turn.

    **2. Deep Dive into Other Schemas (Confirmation of No Overlap):**
      *   **`CombatantSchema` (`pluginData.ts`):** Defines combat participants. `CombatActionSchema.actorId` and `CombatActionSchema.targetId` refer to `CombatantSchema.id`. Related, but distinct.
      *   **`BattleSchema` (`pluginData.ts`):** Describes the entire encounter state, containing `Combatant`s. `CombatActionSchema` defines individual actions within this state.
      *   **`CombatRoundActionsSchema` (`pluginData.ts`):** This is `z.array(CombatActionSchema)`, a list of `CombatAction`s. It *uses* `CombatActionSchema`, confirming its foundational role, not overlapping.
      *   **`DnDStatsSchema` (`pluginData.ts`):** Defines character stats, used for *resolving* actions, not for defining the action structure itself.
      *   **`CheckDefinitionSchema` (`main.tsx`):** Defines a "skill check" mechanic. A `CombatAction` might *trigger* a `CheckDefinition`, but they are different concepts.
      *   **`CombatantsLLMSchema` (`main.tsx`):** Used for initializing combat by identifying participants. Operates at a different phase than `CombatActionSchema`.
      *   **External/Conceptual Schemas (Cassandra, Alembic, AWS, `FuncSchema` for AI tool-use):** These are entirely unrelated. They deal with database structures, cloud resources, or AI function-calling meta-definitions, not the game's core action data.

    **Conclusion:**
    There is **no functional overlap** with `CombatActionSchema`. It serves a unique and necessary purpose within the game's combat loop, specifically designed for "What is a single character doing this turn?" All other schemas serve entirely different purposes or are higher-level aggregations of `CombatActionSchema`. The `plan.md` and `data-model.md` explicitly direct the use of this schema for validation.
- [x] **CHK004** Does the plan clarify that the prompt for generating NPC actions (`getCombatRoundActionsPrompt`) must be modified to accept the *structured* `playerActionObject`? [Clarity, plan.md §Step 2]
    - **Analysis**: Yes, the plan provides explicit and clear clarification that the `getCombatRoundActionsPrompt` function must be modified to accept the *structured* `playerActionObject`. This is documented across multiple interlinked artifacts:

    **1. High-Level Requirement (`spec.md`):**
    *   **File:** `specs/004-code-driven-player/spec.md`
    *   **Section:** `### Functional Requirements`
    *   **Item `FR-003`:** "The resulting `playerActionObject` MUST then be used to construct a *second* prompt to generate actions for all non-player combatants (`npcActions`)."
        *   **Clarification:** This establishes the **mandatory dependency**. It dictates that the `playerActionObject` (which is already defined as a structured `CombatAction` JSON object) is a necessary input for the *next stage* of prompt construction. It implies that the function responsible for that next stage (the NPC prompt generation) *must* be capable of accepting this structured input.

    **2. Detailed Implementation Plan (`plan.md`):**
    *   **File:** `specs/004-code-driven-player/plan.md`
    *   **Section:** `### Phase 2: Implementation Plan`, `Step 2: Refactor executeCombatRound`
    *   **Sub-point:** `c. Update NPC Action Prompt`
        *   **Clarification:** This section provides the most direct and actionable instructions:
            *   "**Modify the `getCombatRoundActionsPrompt` function in `plugins/game-rule-dnd5e/src/pluginPrompt.ts` to accept the structured `playerActionObject` instead of the raw `playerAction` string.**"
                *   This is unambiguous. It names the exact function (`getCombatRoundActionsPrompt`), its file location (`pluginPrompt.ts`), and explicitly states the change in parameter type (from `string` to `structured playerActionObject`).
            *   "**The `getCombatRoundActionsPrompt` function signature and its internal prompt text must be updated to reflect this, making it clear to the AI that it should generate actions for *non-player* combatants based on the player's committed action.**"
                *   This further clarifies that the modification extends beyond just the function signature; the actual *content* of the prompt generated by this function must incorporate the `playerActionObject` to provide the AI with the necessary context for strategic NPC responses.

    **3. Quickstart Guide (`quickstart.md`):**
    *   **File:** `specs/004-code-driven-player/quickstart.md`
    *   **Section:** `## Implementation Steps`, `2.c. Update NPC Action Generation`
        *   **Clarification:** This guide for developers reiterates the requirement as an explicit implementation task: "Modify the `getCombatRoundActionsPrompt` function in `pluginPrompt.ts` to accept the structured `playerActionObject` instead of the raw `playerAction` string." This ensures the developer is aware of this specific change.

    **4. Context from `main.tsx` (`executeCombatRound`):**
    *   **File:** `plugins/game-rule-dnd5e/src/main.tsx`
    *   **Method:** `private async executeCombatRound(...)`
        *   **Clarification:** The plan for `executeCombatRound` (as detailed in `plan.md`) directly shows the call to `getCombatRoundActionsPrompt` *after* `playerActionObject` has been parsed. This contextual usage confirms the necessity of the `getCombatRoundActionsPrompt` function accepting the structured object. It removes the old placeholder logic that was creating an independent `playerActionObject` and ensures the NPC actions are generated *after* the player's action is known and formatted.

    ### Conclusion:
    The plan is clear on the requirement that `getCombatRoundActionsPrompt` must be modified to accept the structured `playerActionObject`. This is not only stated directly but also supported by the overall functional requirements and the sequence of operations defined in the implementation plan.

## Requirement Completeness

- [x] **CHK005** Are requirements for the fallback behavior defined in the case that the `appBackend.getObject()` call for the player's action fails? [Completeness, plan.md §Step 2]
  - **Analysis**: **PASS**
    The `plan.md` has been updated in "Phase 2: Implementation Plan", "Step 2: Refactor executeCombatRound" to include a robust error handling strategy for when `appBackend.getObject()` fails or returns an invalid structure. This now explicitly defines:
    1.  **User Notification**: Display a user-friendly error message.
    2.  **Presentation of 3 Options**:
        *   **Auto-Resolve (Fallback)**: System constructs a `CombatAction` based on defined safety logic (Life Critical, Life Stable/Allies Critical, Life Stable).
        *   **Manual Input**: UI for manual `[Action Type]` - `[Target]` - `[Item]/[Spell]/[Rank]` selection.
        *   **Retry**: Allow user to edit and resubmit.
    This comprehensive approach addresses the previous "generic fallback" deficiency and ensures player agency is respected while providing clear recovery paths.
- [x] **CHK006** Does the plan specify that the original hardcoded player action logic must be *removed* and not just commented out? [Completeness, plan.md §Step 2]
  - **Analysis**: **PASS**
    I reviewed `specs/004-code-driven-player/plan.md` under "Phase 2: Implementation Plan", "Step 2: Refactor executeCombatRound".
    The plan explicitly states:
    > "1. **Remove Placeholder:** Delete the existing `// TODO:` block that creates a hardcoded `playerActionObject`."
    The use of the verbs "**Remove**" and "**Delete**" leaves no ambiguity. It does not suggest commenting out or deprecating the code; it mandates its deletion.
- [x] **CHK007** Does the data model for `CombatAction` account for all necessary action types the player might input (e.g., "Attack", "CastSpell", "UseItem")? [Completeness, data-model.md]
  - **Analysis**: **PASS**
    I have examined `specs/004-code-driven-player/data-model.md` and the `CombatActionSchema` defined in `plugins/game-rule-dnd5e/src/pluginData.ts`.
    
    **`data-model.md` states:**
    The `actionType` field is an `enum` with examples: "Attack", "CastSpell", "UseItem", "Move", "Other".
    
    **`plugins/game-rule-dnd5e/src/pluginData.ts` defines `CombatActionSchema.actionType` as:**
    `actionType: z.enum(["Attack", "CastSpell", "Dash", "Dodge", "Disengage", "Help", "Hide", "Ready", "Search", "UseObject", "Move", "Other"])`
    
    **Comparison:**
    The `CombatActionSchema` in `pluginData.ts` provides a comprehensive list of standard D&D 5th Edition combat actions, including:
    *   "Attack"
    *   "CastSpell"
    *   "Dash"
    *   "Dodge"
    *   "Disengage"
    *   "Help"
    *   "Hide"
    *   "Ready"
    *   "Search"
    *   "UseObject" (which covers "UseItem")
    *   "Move"
    *   "Other" (as a catch-all)
    
    This list covers all the examples provided in the checklist item ("Attack", "CastSpell", "UseItem") and significantly more, representing a robust set of standard combat actions. The inclusion of "Other" also provides a flexible escape hatch for any unforeseen or non-standard actions.
    
    Therefore, the data model for `CombatAction` adequately accounts for all necessary and foreseeable action types a player might input, adhering to the principles of completeness.

## Requirement Consistency

- [x] **CHK008** Does the plan to combine `playerActionObject` and `npcActions` into a single `allActions` list ensure there is no possibility for action duplication? [Consistency, plan.md §Integration with Existing Systems]
  - **Analysis**: **PASS**
    The `plan.md` has been updated in "Phase 2: Implementation Plan", "Step 2: Refactor executeCombatRound" to explicitly address this:
    1.  **Prompt Instruction**: It mandates that the prompt sent to the LLM must state: "**Do NOT generate an action for the protagonist/player. Only generate actions for the other combatants.**"
    2.  **Code Filter**: It adds a critical safety net: "**CRITICAL:** Add a filtering step here: `const filteredNpcActions = npcActions.filter(action => action.actorId !== playerActionObject.actorId);` before adding them to `allActions`."
    These two measures combined ensure that action duplication is impossible.
- [x] **CHK009** Is the data contract for `CombatAction` consistent between `data-model.md` and the existing `CombatActionSchema` in `pluginData.ts`? [Consistency, data-model.md]
  - **Analysis**: **PASS**
    The `CombatAction` data contract is fully consistent between `data-model.md` and the `CombatActionSchema` in `plugins/game-rule-dnd5e/src/pluginData.ts`. All fields (`actorId`, `actionType`, `targetId`, `description`, `spellName`) match in type and optionality. The validation rules for `targetId` (required for "Attack", "CastSpell", "Help", "UseObject") and `spellName` (required for "CastSpell") are also identically defined and implemented in both the documentation and the Zod schema. The code correctly implements a superset of the `actionType` examples given in the documentation, ensuring full coverage and consistency.
- [x] **CHK010** Do the functional requirements align with the integration plan, ensuring the `executeCombatRound` is the single entry point for this logic? [Consistency, spec.md §Functional Requirements vs. §Integration with Existing Systems]
  - **Analysis**: **PASS**
    Both the functional requirements in `spec.md` and the implementation plan in `plan.md` consistently designate `executeCombatRound` as the central and sole entry point for the new combat action processing logic.

    *   **`spec.md` clearly states FR-001**, explicitly mandating `executeCombatRound` as the entry point for *all* actions in a round. The "Integration with Existing Systems" section further reinforces this by detailing the entire action resolution pipeline as occurring within `executeCombatRound`. This ensures a unified and centralized approach to combat logic.
    *   **`plan.md` directly translates this requirement into actionable steps**. "Step 2: Refactor `executeCombatRound`" focuses entirely on modifying this single method to incorporate the new logic for parsing player commands, generating NPC responses, combining actions, and resolving them. There are no other methods or new entry points proposed for this core combat logic.

    This alignment confirms that the design ensures `executeCombatRound` will serve as the single, authoritative orchestrator for combat actions, preventing dispersed or duplicated logic.

## Scenario Coverage

- [x] **CHK011** Are requirements defined for how to handle a player command that is valid natural language but is not a valid combat action in the current context? [Edge Case, Gap]
  - **Analysis**: **PASS**
    The `plan.md` now explicitly handles this scenario in "Phase 2: Implementation Plan":
    1.  **Prompt Instruction**: The `getPlayerCombatActionPrompt` must instruct the AI: *"If the user's input is a valid natural language sentence but is NOT a valid combat action... you MUST return an `actionType` of 'Other' and start the `description` field with 'INVALID_ACTION: ' followed by a brief reason."*
    2.  **Validation Logic**: The `executeCombatRound` method will check for this specific `INVALID_ACTION` flag and throw a specific error.
    3.  **User Handling**: This specific error triggers the `catch` block which now offers 3 distinct options (Auto-Resolve, Manual Input, Retry), ensuring the user is informed and has agency to correct the issue rather than being forced into a generic fallback.
- [x] **CHK012** Does the plan address what happens if the player is unable to act (e.g., stunned)? Is the NLP parsing step skipped correctly? [Coverage, Gap]
  - **Analysis**: **PASS**
    The `plan.md` has been updated to address scenarios where the player is unable to act. Specifically:
    1.  **Pre-Check for Player Status (Step 2)**: Before processing player input, `executeCombatRound` will now include a pre-check to determine if the player character (`protagonistId`) can perform an action (e.g., using `canCombatantAct(playerStatus)`).
    2.  **Branching Logic (Step 2)**:
        *   **If Player Can Act**: The standard flow for parsing `playerActionObject` and handling errors (including `INVALID_ACTION:` as per CHK011) is followed.
        *   **If Player Cannot Act (Incapacitated Flow)**:
            *   `playerActionObject` is set to a predefined "unable to act" `CombatAction` (e.g., "Wait", "Incapacitated").
            *   The original `playerAction` string is treated as `tacticalGuidance` for NPCs.
            *   The NLP parsing for `playerActionObject` is skipped, and the "Invalid Action" error flow is bypassed for `tacticalGuidance`.
    3.  **NPC Prompting with Guidance (Step 3)**: The `getCombatRoundActionsPrompt` now accepts and uses `tacticalGuidance` to inform NPC actions when the player is incapacitated, with a specific instruction in the prompt: *"The protagonist is incapacitated but has issued the following tactical guidance to the party: '[tacticalGuidance]'. Adjust NPC actions to prioritize this request if reasonable."*
    This revised plan provides a comprehensive and player-centric approach to handling incapacitated players, allowing their input to guide the party even when they cannot directly act.
