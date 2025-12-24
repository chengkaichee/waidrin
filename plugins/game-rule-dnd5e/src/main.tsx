// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025  chengkaichee@gmail.com

/**
 * @file This file defines the D&D Character Stats plugin.
 * It provides a React component for configuring D&D-style character stats
 * and integrates with the main application's plugin system to persist these settings.
 */

// Type-only imports for shared libraries and core types.
// These imports are crucial for TypeScript type checking but are removed during the build process
// to prevent bundling these libraries within the plugin, thus avoiding the "two Reacts" problem.
import type { WritableDraft } from "immer";
import type { Plugin, PluginWrapper, StoredState, IGameRuleLogic, CheckDefinition } from "@/lib/state";
import type { Context } from "@/app/plugins";
import type { Prompt } from "@/lib/prompts";
import type * as RadixThemes from '@radix-ui/themes';
import type { useShallow } from 'zustand/shallow';
import { DnDStats, generateDefaultDnDStats, DnDClassData, DnDStatsSchema, resolveCheck as getResolveCheck, Combatant, canCombatantAct, CombatAction, CombatActionSchema, CombatRoundActionsSchema, CheckResult, PlotType } from "./pluginData";
import { getBackstory, modifyProtagonistPromptForDnd, getChecksPrompt, getConsequenceGuidancePrompt, getDndNarrationGuidance, getLocationChangePrompt, getCombatantsPrompt, getPlayerCombatActionPrompt, getCombatRoundActionsPrompt, getCombatRoundNarrationPrompt, assignPlotType } from "./pluginPrompt";
import { resolveSpell } from "./pluginSpells";
import { generateEncounter } from "./encounterTable";
import * as z from "zod/v4";

import type { Character, State, CheckResolutionResult } from "@/lib/state"; // Import Character and State


// Declare a module-level React variable.
// This variable will be assigned the main application's React instance during plugin initialization.
// This is essential for JSX transformation and ensuring all React operations within the plugin
// use the same React instance as the main application, preventing "two Reacts" issues.
let React: typeof import('react');

/**
 * Props for the DndStatsCharacterUIPage component.
 */
interface DndStatsCharacterUIPageProps {
  injectedReact: typeof React;
  
  injectedRadixThemes: typeof RadixThemes;
  getGlobalState: () => StoredState;
  onSave: (newSettings: DnDStats) => Promise<void>;
  injectedUseShallow: typeof useShallow;
  injectedRpgDiceRoller: typeof import('@dice-roller/rpg-dice-roller');
}

/**
 * @component DndStatsCharacterUIPage
 * @description The main UI component for D&D Character Stats, intended to be
 * injected into the application's Character Select screen.
 */
const DndStatsCharacterUIPage = ({
  injectedReact,
  injectedRadixThemes,
  getGlobalState,
  onSave,
  injectedUseShallow,
  injectedRpgDiceRoller,
}: DndStatsCharacterUIPageProps) => {
  const pluginSettings = injectedReact.useMemo(() => {
    const state = getGlobalState();
    const plugin = state.plugins.find((p: PluginWrapper) => p.name === "game-rule-dnd5e");
    const settingsToUse = plugin ? (plugin.settings as DnDStats) : generateDefaultDnDStats(injectedRpgDiceRoller);
    return settingsToUse;
  }, [getGlobalState, injectedRpgDiceRoller]);

  const [currentSettings, setCurrentSettings] = injectedReact.useState<DnDStats>(pluginSettings);
  injectedReact.useEffect(() => {
    setCurrentSettings(pluginSettings);
  }, [pluginSettings]);

  const handleChange = (key: keyof DnDStats, value: string | number) => {
    setCurrentSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleApply = async () => {
    await onSave(currentSettings);
    // After saving, explicitly update currentSettings from the global state
    const state = getGlobalState();
    const plugin = state.plugins.find((p: PluginWrapper) => p.name === "game-rule-dnd5e");
    if (plugin) {
      setCurrentSettings(plugin.settings as DnDStats);
    }
  };

  const availableSubclasses = DnDClassData[currentSettings.dndClass] || [];

  return (
    <injectedRadixThemes.Theme>
      <injectedRadixThemes.Box p="4">
        <injectedRadixThemes.Text size="6" mb="4">D&D 5E Character Stats</injectedRadixThemes.Text>

        <injectedRadixThemes.Grid columns="2" gap="3" mb="3">
          {/* Core Attributes (Strength, Dexterity, etc.) */}
          {Object.keys(DnDStatsSchema.shape).filter(key =>
            key !== 'dndClass' && key !== 'dndSubclass' && key !== 'plotType' && key !== 'encounter' && key !== 'backstory' &&
            key !== 'hp' && key !== 'hpMax' && key !== 'dndExp' && key !== 'dndLevel' // Exclude these from this specific loop
          ).map((key) => (
            <injectedRadixThemes.Flex direction="column" gap="2" key={key}>
              <injectedRadixThemes.Text size="3" weight="bold">{key.charAt(0).toUpperCase() + key.slice(1)}:</injectedRadixThemes.Text>
              <injectedRadixThemes.TextField.Root
                size="3"
                type="number"
                value={currentSettings[key as keyof DnDStats] as number}
                onChange={(e) => handleChange(key as keyof DnDStats, parseInt(e.target.value))}
                min="1"
                max="20"
              />
            </injectedRadixThemes.Flex>
          ))}

          {/* HP */}
          <injectedRadixThemes.Flex direction="column" gap="2">
            <injectedRadixThemes.Text size="3" weight="bold">HP:</injectedRadixThemes.Text>
            <injectedRadixThemes.TextField.Root
              size="3"
              type="number"
              value={currentSettings.hp}
              onChange={(e) => handleChange('hp', parseInt(e.target.value))}
              min="1"
            />
          </injectedRadixThemes.Flex>

          {/* Max HP */}
          <injectedRadixThemes.Flex direction="column" gap="2">
            <injectedRadixThemes.Text size="3" weight="bold">Max HP:</injectedRadixThemes.Text>
            <injectedRadixThemes.TextField.Root
              size="3"
              type="number"
              value={currentSettings.hpMax}
              onChange={(e) => handleChange('hpMax', parseInt(e.target.value))}
              min="1"
            />
          </injectedRadixThemes.Flex>

          {/* Experience Points */}
          <injectedRadixThemes.Flex direction="column" gap="2">
            <injectedRadixThemes.Text size="3" weight="bold">Experience Points:</injectedRadixThemes.Text>
            <injectedRadixThemes.TextField.Root
              size="3"
              type="number"
              value={currentSettings.dndExp}
              onChange={(e) => handleChange('dndExp', parseInt(e.target.value))}
              min="0"
            />
          </injectedRadixThemes.Flex>

          {/* Level */}
          <injectedRadixThemes.Flex direction="column" gap="2">
            <injectedRadixThemes.Text size="3" weight="bold">Level:</injectedRadixThemes.Text>
            <injectedRadixThemes.TextField.Root
              size="3"
              type="number"
              value={currentSettings.dndLevel}
              onChange={(e) => handleChange('dndLevel', parseInt(e.target.value))}
              min="1"
              max="20"
            />
          </injectedRadixThemes.Flex>

          {/* Class Selector */}
          <injectedRadixThemes.Flex direction="column" gap="2">
            <injectedRadixThemes.Text size="3" weight="bold">Class:</injectedRadixThemes.Text>
            <injectedRadixThemes.Select.Root            
              size="3"
              value={currentSettings.dndClass}
              onValueChange={(value) => handleChange('dndClass', value)}
            >
              <injectedRadixThemes.Select.Trigger />
              <injectedRadixThemes.Select.Content>
                {Object.keys(DnDClassData).map((className) => (
                  <injectedRadixThemes.Select.Item value={className} key={className}>
                    {className}
                  </injectedRadixThemes.Select.Item>
                ))}
              </injectedRadixThemes.Select.Content>
            </injectedRadixThemes.Select.Root>
          </injectedRadixThemes.Flex>

          {/* Subclass Selector (conditional) */}
          {currentSettings.dndClass && (
            <injectedRadixThemes.Flex direction="column" gap="2">
              <injectedRadixThemes.Text size="3" weight="bold">Subclass:</injectedRadixThemes.Text>
              <injectedRadixThemes.Select.Root
                size="3"
                value={currentSettings.dndSubclass}
                onValueChange={(value) => handleChange('dndSubclass', value)}
              >
                <injectedRadixThemes.Select.Trigger />
                <injectedRadixThemes.Select.Content>
                  {availableSubclasses.map((subclassName) => (
                    <injectedRadixThemes.Select.Item value={subclassName} key={subclassName}>
                      {subclassName}
                    </injectedRadixThemes.Select.Item>
                  ))}
                </injectedRadixThemes.Select.Content>
              </injectedRadixThemes.Select.Root>
            </injectedRadixThemes.Flex>
          )}

        </injectedRadixThemes.Grid>

        {/* Backstory (outside the grid, full width) */}
        <injectedRadixThemes.Flex direction="column" gap="2" mb="3">
          <injectedRadixThemes.Text size="3" weight="bold">Backstory Guidance:</injectedRadixThemes.Text>
          <injectedRadixThemes.TextArea
            size="3"
            value={currentSettings.backstory || ""}
            onChange={(e) => handleChange('backstory', e.target.value)}
            rows={5} // Adjust as needed
            placeholder="Enter prompt guidance for your character's backstory... or leave it blank for the system generate one for you. 
 Use simple sentences to highlight the attribute score's interpretation and to describe your character's background, personality, and motivations."
          />
        </injectedRadixThemes.Flex>

        {/* Buttons (right-aligned) */}
        <injectedRadixThemes.Flex gap="2" mt="4" justify="end"> {/* Added Flex container for buttons and aligned to end */}
          <injectedRadixThemes.Button size="4" onClick={handleApply}>Apply Changes</injectedRadixThemes.Button>
          <injectedRadixThemes.Button size="4" onClick={() => setCurrentSettings(generateDefaultDnDStats(injectedRpgDiceRoller))} variant="outline">Re-roll</injectedRadixThemes.Button> {/* Added Re-roll button */}
        </injectedRadixThemes.Flex>
      </injectedRadixThemes.Box>
    </injectedRadixThemes.Theme>
  );
};

/**
 * Main plugin class for D&D Character Stats.
 * Implements the Plugin interface to integrate with the Waidrin application.
 */
import type { IAppLibs } from "@/app/services/AppLibs";
import type { IAppBackend } from "@/app/services/AppBackend";
import type { IAppStateManager } from "@/app/services/AppStateManager";
import type { IAppUI } from "@/app/services/AppUI";

export default class DndStatsPlugin implements Plugin, IGameRuleLogic {
  private context: Context | undefined; // The plugin's context provided by the application
  private settings: DnDStats | undefined; // The plugin's settings
  private appLibs: IAppLibs | undefined;
  private appBackend: IAppBackend | undefined;
  private appStateManager: IAppStateManager | undefined;
  private appUI: IAppUI | undefined;

  /**
   * Initializes the plugin with its settings and context.
   * Parses and validates incoming settings using DnDStatsSchema,
   * merging them with default values.
   * @param settings - The settings object provided by the application.
   * @param context - The plugin context, providing access to application functionalities.
   */
  async init(settings: Record<string, unknown>, context: Context, appLibs: IAppLibs, appBackend: IAppBackend, appStateManager: IAppStateManager, appUI: IAppUI): Promise<void> {
    this.context = context;
    this.appLibs = appLibs;
    this.appBackend = appBackend;
    this.appStateManager = appStateManager;
    this.appUI = appUI;
    // Parse and validate settings, applying defaults for missing properties
    this.settings = DnDStatsSchema.parse({ ...generateDefaultDnDStats(appLibs.rpgDiceRoller), ...settings });

    // Assign the main application's React instance to the module-level React variable.
    // This is critical for all JSX within this plugin to use the correct React instance.
    React = appLibs.react;

    // Register the D&D 5E tab in the CharacterSelect screen
    this.context.addCharacterUI(
      this.context!.pluginName, // Changed from "D&D 5E" to this.context.pluginName
      <span>D&D 5E</span>, // GameRuleTab: The ReactNode for the tab trigger.
      () => <DndStatsCharacterUIPage
        injectedReact={appLibs.react}
        injectedRadixThemes={appLibs.radixThemes}
        getGlobalState={this.appStateManager!.getGlobalState}
        injectedUseShallow={appLibs.useShallow}
        injectedRpgDiceRoller={appLibs.rpgDiceRoller}
        onSave={async (newSettings) => {
          let finalSettings = { ...newSettings }; // Start with a copy of newSettings

          // Check if backstory is empty or blank
          if (!newSettings.backstory || newSettings.backstory.trim() === "") {
            // Only generate if backstory is empty
            const pc = this.appStateManager!.getGlobalState(); // Get current global state for prompt
            const prompt = getBackstory(newSettings, pc); // Use newSettings for stats

            try {
              const generatedBackstory = await this.appBackend!.getNarration(prompt, (token, count) => {
                this.appUI!.updateProgress("Generating Backstory", "Please wait while your character is going through early life...", count, true);
              }); // Approximately 300 words

              finalSettings = { ...newSettings, backstory: generatedBackstory };
              this.appUI!.updateProgress("Backstory Generated", "Your character's history is ready!", -1, false);
              console.log("DEBUG: Plugin: Backstory Generated.");

              } catch (error) {
                // TODO: Handle error if not user abort, and display console.error("Error generating backstory:", error);
                this.appUI!.updateProgress("Backstory Generation Aborted", "User aborted operation during generation.", -1, false);
              }
          }

          this.appStateManager!.savePluginSettings(this.context!.pluginName, finalSettings);
          this.settings = { ...this.settings, ...finalSettings }; // Update local copy
        }}
      />
    );
  }

  getGameRuleLogic(): IGameRuleLogic {
    return this;
  }

  getBiographyGuidance(): string {
    if (!this.settings) {
        return "";
    }
    return this.settings.backstory || ""; // Return saved backstory
  }
  
  /**
   * @method modifyProtagonistPrompt
   * @description To-do: This is a place holder to rewrite the Biography prompt, currently we are just passing guidance to main app based on character stats based on game rules.
   */
  modifyProtagonistPrompt(originalPrompt: Prompt): Prompt {
    return modifyProtagonistPromptForDnd(originalPrompt);
  }

  /**
   * @method getActionChecks
   * @description Specifies what checks are required for a given action, based on the action and current context.
   * This method is triggered when an action is passed to `narratePrompt`.
   * Its implementation will typically involve constructing an LLM prompt, making an API call, and parsing/validating the LLM's JSON response against the `CheckDefinition` schema.
   * @param {string} action - The raw action string performed by the protagonist.
   * @param {WritableDraft<State>} context - The current game state. (Note: Direct mutation of this `WritableDraft` object is the intended way to update state.)
   * @returns {Promise<CheckDefinition[]>} A promise that resolves to an array of check definitions. If the LLM response is invalid or unparseable, an empty array should be returned as a graceful fallback.
   */
  async getActionChecks(action: string, context: WritableDraft<StoredState>): Promise<CheckDefinition[]> {
    if (!this.appBackend || !this.settings) {
      console.error("Context or settings not available for getActionChecks.");
      return [];
    }

    const PCStats = this.settings as DnDStats;
    const checksPrompt = getChecksPrompt(action, PCStats.plotType);

    try {
      // Define a Zod schema for an array of CheckDefinition
      const CheckDefinitionSchema = z.object({
        type: z.string(),
        difficultyClass: z.number().int(),
        modifiers: z.array(z.string()).optional(),
      });
      const CheckDefinitionsArraySchema = z.array(CheckDefinitionSchema);

      let checks = await this.appBackend!.getObject(checksPrompt, CheckDefinitionsArraySchema);

      // Filter out initiative checks if already in combat
      if (PCStats.plotType === "combat") {
          checks = checks.filter(check => check.type !== "initiative");
      }
      return checks;
    } catch (error) {
      console.error("Error getting action checks from LLM:", error);
      return []; // Graceful fallback
    }
  }

  /**
   * @method resolveCheck
   * @description Resolves a game rule check, utilizing rpg-dice-roller, and returns the result as a statement.
   * The plugin will use its internal rules to determine the character`s appropriate stat and skill modifier.
   *    * This statement will be incorporated into the `narratePrompt`'s output, typically after the action description.
   *    * @param {CheckDefinition} check - The definition of the check to resolve.
   *    * @param {Character} characterData - The global `Character` object. The plugin will map this to its internal representation of the character's stats.
   *    *   (Note: The `Character` type is defined in `lib/schemas.ts` and includes properties like `name`, `gender`, `race`, `biography`, `locationIndex`.)
   *    * @returns {string} A statement describing the check's result and any consequences.
   */
    async resolveCheck(check: CheckDefinition, characterData: Character, context: WritableDraft<State>, action?: string): Promise<CheckResolutionResult> {
    if (!this.settings || !this.context || !this.appLibs) {
      return { resultStatement: `Check for ${check.type} could not be resolved due to missing context, settings, or appLibs.`, consequenceLog: [] };
    }
    const PCStats = this.settings as DnDStats;
    const rpgDiceRoller = this.appLibs.rpgDiceRoller;

    const checkResult = getResolveCheck(check, characterData, PCStats, rpgDiceRoller);
    const resultStatement = checkResult.statement; // Extract the string statement
    let consequenceLog: string[] = [];

    // Example: If it's an initiative check, trigger combat initialization
    if (check.type === "initiative") {
      // Pass the full statement to handleConsequence and await its completion
      await this.handleConsequence("initiative_triggered", context, [resultStatement], action);
      consequenceLog.push("Combat initiated! Initiative order determined.");
    }
    // To-Do: Add more complex logic here for other check types (e.g., attack, spell, dash, disengage, dodge, help, hide, ready, search, use an object)
    // where you would calculate damage, apply status effects, etc., and call handleConsequence.

    return { resultStatement, consequenceLog };
  }

  /**
   * @method getNarrativeGuidance
   * @description Generates a narration prompt, influenced by the outcome of performed checks and consequences (e.g., HP, item, relationship, story/plot branch changes).
   * @param {string} eventType - The type of event triggering narration.
   * @param {WritableDraft<State>} context - The current game state. (Note: Direct mutation of this `WritableDraft` object is the intended way to update state.)
   * @param {string[]} [checkResultStatements] - Optional: Statements describing results of checks performed for the event, provided by `resolveCheck`.
   * @param {string} [action] - Optional: The action that triggered the narration.
   * @returns {Promise<string[]>} The generated narration prompt.
   */
  async getNarrativeGuidance(eventType: string, context: WritableDraft<State>, checkResolutionResults?: CheckResolutionResult[], action?: string): Promise<string[]> {
    if (!this.appBackend || !this.settings) {
      console.error("Context or settings not available for getNarrativeGuidance.");
      return [];
    }

    console.log("DEBUG: getNarrativeGuidance - plotType:", this.settings.plotType); // Troubleshoot Combat Narration issues
    console.log("DEBUG: getNarrativeGuidance - action:", action);                   // Troubleshoot Combat Narration issues

    // If in combat and the user provided an action, execute the combat round and generate narration from it.
    if (this.settings.plotType === "combat" && action) {
      const combatNarration = await this.executeCombatRound(action, context);
      console.log("DEBUG: Combat Narration from executeCombatRound:", combatNarration); // Troubleshoot Combat Narration issues
      const dndStyleGuidance = getDndNarrationGuidance(eventType);
      const consolidatedGuidance = `${dndStyleGuidance}\n\n${combatNarration}`;
      return [consolidatedGuidance];
    }

    const PCStats = this.settings as DnDStats;
    const checkResultStatements = checkResolutionResults?.map(cr => cr.resultStatement) || [];

    // Logic for other event types (user actions, etc.). Find the most recent *completed* narration event
    let sceneNarration = "";
    for (let i = context.events.length - 1; i >= 0; i--) {
      const event = context.events[i];
      if (event.type === "narration" && event.text !== "") {
        sceneNarration = event.text;
        break;
      }
    }

    // Handle location change narration specifically
    // console.log(`DEBUG: Plugin: action:`, action, `# of checkResolutionResults:`, checkResolutionResults?.length, `# of events:`, context.events.length, `last event type:`, context.events.length > 0 ? context.events[context.events.length - 2].type : "N/A");
    if (!action && (!checkResolutionResults || checkResultStatements.length === 0) && context.events.length > 0 && context.events[context.events.length - 2].type === "location_change") {
      let previousLocationName = `a location from protagonist's backstory: ${this.settings.backstory || ""}`;
      let newLocationName = "new plot line location";
      let newLocationDescription = "";
      let presentCharactersInfo = "";
      let newLocationTrigger = "N/A"; // Initialize with a default value      
      console.log("DEBUG: Plugin: Handling location change narration...");

      // Find the most recent LocationChangeEvent
      for (let i = context.events.length - 1; i >= 0; i--) {
        const event = context.events[i];
        if (event.type === "location_change") {
          newLocationName = context.locations[event.locationIndex].name;
          newLocationDescription = context.locations[event.locationIndex].description;
          // console.log("DEBUG: Plugin: found New Location Name:", newLocationName);
          
          // Try to find the previous location from the event history
          // This is a heuristic and might not always be accurate if events are reordered or missing
          if (i > 0) {
            for (let j = i - 1; j >= 0; j--) {
              const prevEvent = context.events[j];
              if (prevEvent.type === "location_change") {
                previousLocationName = context.locations[prevEvent.locationIndex].name;
                break;
              } else if (prevEvent.type === "narration" && prevEvent.locationIndex !== undefined) {
                // If a narration event has a location index, it might indicate the previous location
                previousLocationName = context.locations[prevEvent.locationIndex].name;
                newLocationTrigger = prevEvent.text; // Use this narration as the trigger
                break;
              }
            }
          }
          // console.log("DEBUG: Plugin: found Previous Location Name:", previousLocationName);

          if (event.presentCharacterIndices && event.presentCharacterIndices.length > 0) {
            presentCharactersInfo = `Present characters: ${event.presentCharacterIndices.map(idx => context.characters[idx].name).join(", ")}.`;
            // console.log ("DEBUG: Plugin: Present Characters Info:", presentCharactersInfo);
          }
          break;
        }
      }

      const locationChangePrompt = getLocationChangePrompt(previousLocationName, newLocationName, newLocationDescription, presentCharactersInfo, newLocationTrigger);
      const narration = await this.appBackend!.getNarration(locationChangePrompt); // Approx 200 words
      // console.log ("DEBUG: Plugin: Guidance for New Location Prompt:", locationChangePrompt);
      return [narration];
    }

    let combatNarration = "";
    if (PCStats.plotType === "combat" && PCStats.encounter) {
      combatNarration = `Combat Round ${PCStats.encounter.roundNumber}. Combat Log: ${PCStats.encounter.combatLog.map(log => log.replace(/\n/g, ' ')).join("; ")}.`;
    }

    // 1. Get consequence guidance from internal LLM call
    let consequenceGuidance: string;

    if (!action && checkResultStatements.length === 0) {
      consequenceGuidance = "N/A. ";
      console.log ("DEBUG: Plugin: Consequence Guidance not applicable.");
    } else {
      const internalGuidancePrompt = getConsequenceGuidancePrompt(sceneNarration, action || "", checkResultStatements);
      consequenceGuidance = await this.appBackend!.getNarration(internalGuidancePrompt);
      console.log ("DEBUG: Plugin: Consequence Guidance provided.", consequenceGuidance);
      /* console.log ("DEBUG: Plugin: Scene for Narration:", sceneNarration);
      console.log ("DEBUG: Plugin: Action for Narration:", action);
      console.log ("DEBUG: Plugin: Check Results for Narration Prompt:", checkResultStatements); */
    }

    // 2. Get general D&D style guidance
    //To-Do: add rules for timing ie combat round is 6 sec, day/night
    const dndStyleGuidance = getDndNarrationGuidance(eventType);

    // 3. Combine guidance into a string array
    const consolidatedGuidance = `${consequenceGuidance}\n\n${dndStyleGuidance}\n\n${combatNarration}`;
    //console.log ("DEBUG: Consolidated Guidance for Narration Prompt:", consolidatedGuidance);

    // Return the consolidated guidance as a string array
    return [consolidatedGuidance];
  }

  /**
   * @method executeCombatRound
   * @description Executes a single round of combat. This method orchestrates the entire combat flow for a round:
   * 1. Checks for combat end conditions.
   * 2. Parses the player's natural language action into a CombatAction object.
   * 3. Handles parsing errors with Auto-Resolve, Manual Input, or Retry options.
   * 4. Determines NPC actions based on the player's committed action or tactical guidance.
   * 5. Unifies and resolves all actions in initiative order.
   * @param {string} playerAction - The action taken by the player character.
   * @returns {Promise<string>} A promise that resolves to a string containing the combat round's narration.
   */
  private async executeCombatRound(playerAction: string, context: WritableDraft<State>): Promise<string> {
    if (!this.settings || !this.appBackend || !this.appUI || !this.settings.encounter) {
      console.error("Settings, backend, UI, or encounter not available for executing combat round.");
      return "";
    }

    const battle = this.settings.encounter;
    const protagonistId = context.protagonist.name;
    const playerCombatant = battle.combatants.find(c => c.characterIndex === -1);

    // T004: Legacy hardcoded logic removed.

    // Pre-check: Combat End Conditions
    const initialEnemies = battle.combatants.filter(c => !c.isFriendly && canCombatantAct(c.status));
    if (initialEnemies.length === 0) {
      this.settings.plotType = "general";
      this.settings.encounter = undefined;
      return "The enemies have been defeated. Victory!";
    }

    let playerActionObject: CombatAction | null = null;
    let tacticalGuidance: string | null = null;

    // T005: Implement player status check logic
    if (playerCombatant && canCombatantAct(playerCombatant.status)) {
        let parsingDone = false;
        let currentActionInput = playerAction;

        while (!parsingDone) {
            // T006: Implement the try/catch parsing block
            try {
                const prompt = getPlayerCombatActionPrompt(currentActionInput, battle, protagonistId);
                playerActionObject = await this.appBackend.getObject(prompt, CombatActionSchema);
                
                // Validation: Check if INVALID_ACTION flag returned by LLM
                if (playerActionObject.actionType === 'Other' && playerActionObject.description.startsWith("INVALID_ACTION:")) {
                    throw new Error(playerActionObject.description);
                }
                parsingDone = true;

            } catch (error: any) {
                // T007: Implement robust error handling strategies
                const errorMessage = error.message || "We were unable to parse your last prompt into a valid D&D action.";
                
                // DEC 21 - The following line is commented out as it caused a persistent, non-dismissible error box.
                // this.appUI.showError(errorMessage);
                
                // The window.prompt now serves as the sole error notification and decision point.
                const choice = window.prompt(
                    `${errorMessage}\n\nHow would you like to proceed?\n1. Auto-Resolve (System picks a safe action)\n2. Manual Input (Choose from lists)\n3. Retry (Rewrite your command)`, 
                    "1"
                );

                // T007: Option 1 - Auto-Resolve (Fallback)
                if (choice === "1" || choice === null) {
                    const hpPercent = (playerCombatant.currentHp / playerCombatant.maxHp) * 100;
                    const canHeal = ["Cleric", "Druid", "Bard", "Paladin"].includes(this.settings.dndClass);

                    if (hpPercent < 25) { // Condition: Life Critical
                        if (canHeal) { // Priority 1: Heal
                            playerActionObject = {
                                actorId: protagonistId,
                                actionType: "CastSpell",
                                targetId: protagonistId,
                                spellName: "cure wounds",
                                description: "Life critical! Casting Cure Wounds on self."
                            };
                        } else { // Priority 3: Dodge (Priority 2: Retreat skipped)
                            playerActionObject = {
                                actorId: protagonistId,
                                actionType: "Dodge",
                                description: "Life critical! Taking a defensive stance."
                            };
                        }
                    } else { // Life Stable
                        const criticalAlly = battle.combatants.find(c => c.isFriendly && c.characterIndex !== -1 && (c.currentHp / c.maxHp) < 0.25 && canCombatantAct(c.status));
                        
                        if (criticalAlly) { // Priority 1: Aid Allies
                            playerActionObject = {
                                actorId: protagonistId,
                                actionType: "Help",
                                targetId: criticalAlly.id,
                                description: `Aiding ${criticalAlly.id} who is in critical condition.`
                            };
                        } else { // Priority 3: Attack (Priority 2: Protect skipped)
                            const enemies = battle.combatants.filter(c => !c.isFriendly && canCombatantAct(c.status));
                            const target = enemies.length > 0 ? enemies[0] : null;
                            playerActionObject = {
                                actorId: protagonistId,
                                actionType: "Attack",
                                targetId: target?.id,
                                description: `Attacking ${target?.id || "the enemy"}.`
                            };
                        }
                    }
                    parsingDone = true;

                // T007: Option 2 - Manual Input (Simulated Dropdowns)
                } else if (choice === "2") {
                    // 1. Select Action Type
                    const actionTypes = CombatActionSchema.shape.actionType.options;
                    const actionList = actionTypes.map((a, i) => `${i + 1}. ${a}`).join("\n");
                    const actionChoice = window.prompt(`Select Action Type:\n${actionList}`, "1");
                    const chosenActionType = actionTypes[parseInt(actionChoice || "1") - 1] || "Attack";

                    // 2. Select Target (if required)
                    let targetId: string | undefined = undefined;
                    if (["Attack", "CastSpell", "Help", "UseObject"].includes(chosenActionType)) {
                        const validTargets = battle.combatants.filter(c => canCombatantAct(c.status));
                        if (validTargets.length > 0) {
                            const targetList = validTargets.map((t, i) => `${i + 1}. ${t.id} (${t.isFriendly ? 'Ally' : 'Enemy'}, HP: ${t.currentHp})`).join("\n");
                            const targetChoice = window.prompt(`Select Target for ${chosenActionType}:\n${targetList}`, "1");
                            targetId = validTargets[parseInt(targetChoice || "1") - 1]?.id;
                        }
                    }

                    // 3. Select Item/Spell/Rank
                    let spellName: string | undefined = undefined;
                    let extraInfo = "";
                    if (chosenActionType === "CastSpell") {
                        const spells = ["healing word", "cure wounds", "magic missile", "fireball"];
                        const spellList = spells.map((s, i) => `${i + 1}. ${s}`).join("\n");
                        const spellChoice = window.prompt(`Select Spell:\n${spellList}`, "1");
                        spellName = spells[parseInt(spellChoice || "1") - 1];
                    } else if (chosenActionType === "Move") {
                        const ranks = ["Front", "Middle", "Rear"];
                        const rankList = ranks.map((r, i) => `${i + 1}. ${r}`).join("\n");
                        const rankChoice = window.prompt(`Select Rank:\n${rankList}`, "2");
                        extraInfo = ` Moving to ${ranks[parseInt(rankChoice || "2") - 1]} rank.`;
                    }

                    playerActionObject = {
                        actorId: protagonistId,
                        actionType: chosenActionType,
                        targetId: targetId,
                        spellName: spellName as any,
                        description: `Manually selected: ${chosenActionType}${targetId ? ` on ${targetId}` : ""}.${extraInfo}`
                    };
                    parsingDone = true;

                // T007: Option 3 - Retry
                } else if (choice === "3") {
                    const newAction = window.prompt("Edit your command:", currentActionInput);
                    if (newAction) {
                        currentActionInput = newAction;
                    } else {
                        // User cancelled retry prompt
                        playerActionObject = { actorId: protagonistId, actionType: "Dodge", description: "Taking a defensive stance." };
                        parsingDone = true;
                    }
                }
            }
        }
    } else {
        // T005: Incapacitated Flow
        playerActionObject = { actorId: protagonistId, actionType: "Other", description: "Incapacitated and cannot act." };
        tacticalGuidance = playerAction;
    }

    // T008: Implement unified action list generation
    battle.combatLog = [];
    const npcPrompt = getCombatRoundActionsPrompt(battle, playerActionObject, tacticalGuidance, protagonistId);
    let npcActions: CombatAction[] = [];
    try {
      const TempCombatRoundActionsResponseSchema = z.object({ actions: CombatRoundActionsSchema });
      const combatRoundResponse = await this.appBackend.getObject(npcPrompt, TempCombatRoundActionsResponseSchema);
      npcActions = combatRoundResponse.actions;
    } catch (error) {
      console.error("Error getting NPC actions from LLM, using fallback.", error);
      npcActions = []; 
    }

    // T008: Duplication Protection (filter out player from NPC actions)
    const filteredNpcActions = npcActions.filter(action => action.actorId !== protagonistId);

    // Fallback logic for missing NPCs
    const activeNonPlayerCombatants = battle.combatants.filter(c => c.characterIndex !== -1 && canCombatantAct(c.status));
    const npcsWithActions = filteredNpcActions.map(a => a.actorId);

    for (const combatant of activeNonPlayerCombatants) {
        if (!npcsWithActions.includes(combatant.id)) {
            const potentialTargets = battle.combatants.filter(c => c.isFriendly !== combatant.isFriendly && canCombatantAct(c.status));
            if (potentialTargets.length > 0) {
                const target = potentialTargets[0];
                filteredNpcActions.push({
                    actorId: combatant.id,
                    actionType: "Attack",
                    targetId: target.id,
                    description: `${combatant.id} attacks ${target.id} as a fallback.`
                });
            }
        }
    }

    // Combine actions and sort by initiative
    const allActions: (CombatAction & { initiative: number })[] = [];
    if (playerActionObject) {
        allActions.push({ ...playerActionObject, initiative: playerCombatant?.initiativeRoll || 0 });
    }
    filteredNpcActions.forEach(action => {
        const combatant = battle.combatants.find(c => c.id === action.actorId);
        if (combatant) {
            allActions.push({ ...action, initiative: combatant.initiativeRoll });
        }
    });

    allActions.sort((a, b) => b.initiative - a.initiative);
    console.log("DEBUG: All Actions in Initiative Order:", allActions);

    // Process all actions
    for (const action of allActions) {
        const combatant = battle.combatants.find(c => c.id === action.actorId);
        if (combatant && canCombatantAct(combatant.status)) {
            this.resolveCombatAction(action, context);
        }
    }

    // Check for combat end conditions
    const remainingEnemies = battle.combatants.filter(c => !c.isFriendly && canCombatantAct(c.status));
    const remainingFriendlies = battle.combatants.filter(c => c.isFriendly && canCombatantAct(c.status));

    if (remainingEnemies.length === 0) {
      battle.combatLog.push("All enemies defeated! Victory!");
      this.settings.plotType = "general";
      this.settings.encounter = undefined;
    } else if (remainingFriendlies.length === 0) {
        battle.combatLog.push("All friendlies defeated! Game over.");
        this.settings.plotType = "general";
        this.settings.encounter = undefined;
    } else {
        battle.combatLog.push("The battle continues...");
        battle.roundNumber++;
    }

    const narrationPrompt = getCombatRoundNarrationPrompt(battle.combatLog);
    return await this.appBackend.getNarration(narrationPrompt);
  }

  /**
   * @method resolveCombatAction
   * @description Resolves a single combat action, updating the battle state and combat log accordingly.
   * This method handles different action types (e.g., Attack, CastSpell) and their effects on combatants.
   * For "Attack" actions, it performs an attack roll, calculates damage on a success, updates the target's HP,
   * and checks if the target is defeated. For other actions, it logs a descriptive message.
   * @param {CombatAction} action - The combat action to resolve.
   */
  private resolveCombatAction(action: CombatAction, context: WritableDraft<State>): void {
    // Ensure all necessary components are available before proceeding.
    if (!this.settings || !this.settings.encounter || !this.appLibs || !this.appStateManager) {
      console.error("Cannot resolve combat action: missing settings, encounter, appLibs, or appStateManager.");
      return;
    }

    const battle = this.settings.encounter;
    const attacker = battle.combatants.find(c => c.id === action.actorId);
    const target = battle.combatants.find(c => c.id === action.targetId);

    // Validate that the attacker exists.
    if (!attacker) {
        battle.combatLog.push(`Attacker ${action.actorId} not found.`);
        return;
    }

    // Handle action types with a switch statement for clarity and extensibility.
    switch (action.actionType) {
        case "Attack":
            // Validate that the target exists for an attack.
            if (!target) {
                battle.combatLog.push(`${attacker.id} attacks, but the target is invalid.`);
                return;
            }

            // Retrieve the full character data for the attacker from the provided context.
            const attackerCharacter = attacker.characterIndex === -1
                ? context.protagonist
                : context.characters[attacker.characterIndex];

            if (!attackerCharacter) {
                battle.combatLog.push(`Character data for ${attacker.id} not found.`);
                return;
            }

            // Define the attack check. Armor Class (AC) is hardcoded to 10 for now.
            const attackCheck: CheckDefinition = { type: 'attack', difficultyClass: 10 };
            // Resolve the attack roll using the helper function.
            const attackResult = getResolveCheck(attackCheck, attackerCharacter, this.settings, this.appLibs.rpgDiceRoller);
            
            // Combine action description with attack result statement
            battle.combatLog.push(`${action.description} ${attackResult.statement}`);

            // If the attack is successful, calculate and apply damage.
            if (attackResult.success) {
                // Roll for damage, hardcoded to 1d6 for now.
                const damageRoll = new this.appLibs.rpgDiceRoller.DiceRoll('1d6');
                const damage = damageRoll.total;
                // Apply damage to the target.
                target.currentHp -= damage;
                // Calculate percentage of HP lost
                const percentageLost = Math.round((damage / target.maxHp) * 100);
                battle.combatLog.push(`${attacker.id} deals ${damage} damage to ${target.id}. Took away ${percentageLost}% of ${target.id}'s life, ${target.id} has ${target.currentHp} HP remaining.`);
            }
            break;

        case "CastSpell":
            resolveSpell(action, battle, this.appLibs, this.settings);
            break;

        case "Help":
        case "UseObject":
            // Actions that typically have a target.
            const targetLogWithTarget = action.targetId ? ` on ${action.targetId}` : '';
            battle.combatLog.push(`${action.actorId} uses the ${action.actionType} action${targetLogWithTarget}.`);
            break;

        case "Dash":
        case "Dodge":
        case "Disengage":
        case "Hide":
        case "Ready":
            /* TODO: Implement the Ready action based on 5th Edition SRD rules.
            // 1. Set a Trigger: The user must be able to declare a perceivable circumstance that will trigger the action (e.g., "If the goblin steps next to me").
            // 2. Choose an Action: The user must be able to choose the action to take when the trigger occurs (e.g., "I will move away") or choose to move up to their speed.
            // 3. Use Your Reaction: When the trigger occurs, the system must use the character's reaction to perform the chosen action. A character only has one reaction per round.
            // Readying a Spell:
            // - If a spell is readied, it is cast on the character's turn, but the energy is held, requiring concentration.
            // - If concentration is broken before the trigger occurs, the spell slot is wasted.
            // - The spell must have a casting time of 1 action.            
            const targetLogWithTarget = action.targetId ? ` on ${action.targetId}` : '';
            battle.combatLog.push(`${action.actorId} set {trigger condition} and {reaction action}.`);
            break;
            */
        case "Search":
        case "Move":
            // TODO: Move action will allow a combatant to move up or back in rank, so only enemies within range can be attacked. 
            // Frontline, middle and rear mechanics where 1 character can block upto 2 enemies from attacking friendlies behind them.
            battle.combatLog.push(`${action.actorId} uses the ${action.actionType} action.`);
            break;

        case "Other":
        default:
            // Generic handler for any other actions.
            const targetLogDefault = action.targetId ? ` on ${action.targetId}` : '';
            battle.combatLog.push(`${action.actorId} performs an action: ${action.description}${targetLogDefault}.`);
            break;
    }

    // Check if the target has been defeated.
    if (target && target.currentHp <= 0) {
        target.status = 'dead';
        battle.combatLog.push(`${target.id} has been defeated.`);
        
        // If the defeated character is a globally managed one, update its state.
        if (target.characterIndex !== -1 && context.characters[target.characterIndex]) {
            // Directly modify the character in the current context draft
            const character = context.characters[target.characterIndex];
            // Append a note to the character's biography to indicate they were defeated.
            if(character) {
                character.biography += '\n(DEFEATED IN COMBAT)';
            }
        }
    }
  }

  /**
   * @method handleConsequence
   * @description Applies state changes based on the outcome of a check or event.
   * This method is called internally by `resolveCheck` and is solely responsible for modifying the plugin's internal state.
   * @param {string} eventType - The type of event triggering the consequence (e.g., "damage_dealt", "status_effect_applied").
   * @param {string[]} [checkResultStatements] - Optional: Statements describing results of checks that led to this consequence.
   * @param {string} [action] - Optional: The action that triggered the consequence.
   * @returns {void}
   */
  async handleConsequence(eventType: string, context: WritableDraft<State>, checkResultStatements?: string[], action?: string): Promise<void> {
    if (!this.settings || !this.appLibs || !this.appBackend) {
      console.error("ERROR: Plugin: Settings, AppLibs, or AppBackend not available for handleConsequence.");
      return;
    }

    const PCStats = this.settings as DnDStats;
    const rpgDiceRoller = this.appLibs.rpgDiceRoller;

    // Example: If "initiative_triggered" event, set plotType to combat and initialize encounter
    if (eventType === "initiative_triggered" && PCStats.plotType !== "combat") {
      console.log("DEBUG: COMBAT STARTED");
      PCStats.plotType = "combat";

      // Define the new, more detailed schema for the LLM's response.
      const CombatantsLLMSchema = z.object({
        knownCharacters: z.array(z.object({
          name: z.string(),
          isFriendly: z.boolean(),
        })).optional(),
        newNamedCharacters: z.array(z.object({
          name: z.string(),
          isFriendly: z.boolean(),
          description: z.string(),
        })).optional(),
        unnamedEnemies: z.object({
          count: z.number().int().min(0),
          type: z.string(),
        }).optional(),
        encounterDescription: z.string().optional(),
      });

      // Construct LLM prompt
      let sceneNarration = "";
      if (context) {
        for (let i = context.events.length - 1; i >= 0; i--) {
          const event = context.events[i];
          if (event?.type === "narration") {
            sceneNarration = event.text;
            break;
          }
        }
      }

      // Gather all known character names to provide context to the LLM to determine each character's action.
      const knownCharacterNames = context.characters.map(c => c.name);
      const combatantsPrompt = getCombatantsPrompt(sceneNarration, context.protagonist.name || "", knownCharacterNames);
      const combatantsLLMResponse = await this.appBackend.getObject(combatantsPrompt, CombatantsLLMSchema);

      const allCombatants: Combatant[] = [];

      // Explicitly add protagonist as a friendly combatant with a special index (-1)
      if (context.protagonist) {
        const dexterityModifier = Math.floor((PCStats.dexterity - 10) / 2);
        const initiativeRoll = new rpgDiceRoller.DiceRoll(`1d20+${dexterityModifier}`);
        allCombatants.push({
          id: context.protagonist.name, // Add id for protagonist
          characterIndex: -1, // Special index for protagonist
          currentHp: PCStats.hp,
          maxHp: PCStats.hpMax,
          status: "active",
          initiativeRoll: initiativeRoll.total,
          isFriendly: true,
        });
      }

      // Process known characters from the LLM response
      // TODO: Get LLM to provide race, gender, HD, description
      // TODO: create a permanent stat block for known characters in the global state for future encounters
      if (combatantsLLMResponse.knownCharacters) {
        for (const char of combatantsLLMResponse.knownCharacters) {
          if (context.protagonist && char.name === context.protagonist.name) {
            continue; // Skip protagonist, already added
          }
          const charIndex = context.characters.findIndex(c => c.name === char.name);
          if (charIndex !== -1) {
            const initiativeRoll = new rpgDiceRoller.DiceRoll(`1d20`);
            allCombatants.push({
              id: char.name,
              characterIndex: charIndex,
              currentHp: 24, // Placeholder HP, ideally get from character state
              maxHp: 24, // Placeholder HP
              status: "active",
              initiativeRoll: initiativeRoll.total,
              isFriendly: char.isFriendly,
            });
          }
        }
      }

      //Process and create new named characters
      // TODO: Get LLM to provide race, gender, HD, description      
      if (combatantsLLMResponse.newNamedCharacters) {
        for (const char of combatantsLLMResponse.newNamedCharacters) {
          const newChar: Character = {
            name: char.name,
            biography: char.description,
            gender: "male", // Placeholder
            race: "human", // Placeholder
            locationIndex: context.protagonist.locationIndex, // Assume same location
          };
          context.characters.push(newChar);
          const charIndex = context.characters.length - 1;
          const initiativeRoll = new rpgDiceRoller.DiceRoll(`1d20`);
          allCombatants.push({
            id: char.name,
            characterIndex: charIndex,
            currentHp: 24, // Placeholder HP
            maxHp: 24, // Placeholder HP
            status: "active",
            initiativeRoll: initiativeRoll.total,
            isFriendly: char.isFriendly,
          });
        }
      }

      // Process and create unnamed enemies
      // TODO: Get LLM to provide race, gender, HD, description
      if (combatantsLLMResponse.unnamedEnemies && combatantsLLMResponse.unnamedEnemies.count > 0) {
        for (let i = 0; i < combatantsLLMResponse.unnamedEnemies.count; i++) {
          const enemyName = `${combatantsLLMResponse.unnamedEnemies.type} ${i + 1}`;
          const enemyChar: Character = {
            name: enemyName,
            gender: "male",
            race: "monster",
            biography: `A generic ${combatantsLLMResponse.unnamedEnemies.type}.`,
            locationIndex: context.protagonist.locationIndex,
          };
          context.characters.push(enemyChar);
          const charIndex = context.characters.length - 1;
          const initiativeRoll = new rpgDiceRoller.DiceRoll(`1d20`);
          allCombatants.push({
            id: enemyName,
            characterIndex: charIndex,
            currentHp: 8, // Placeholder HP
            maxHp: 8, // Placeholder HP
            status: "active",
            initiativeRoll: initiativeRoll.total,
            isFriendly: false,
          });
        }
      }

      // Sort combatants by initiative (descending)
      allCombatants.sort((a, b) => b.initiativeRoll - a.initiativeRoll);

      PCStats.encounter = {
        roundNumber: 1,
        combatants: allCombatants,
        combatLog: ["Combat initiated."],
      };

      console.log("DEBUG: Characters at end of handleConsequence:", JSON.stringify(context.characters, null, 2));
    }
  }

  /**
   * @method getActions
   * @description Provides a list of available actions based on the current game state and plot type.
   * @returns {Promise<string[]>} A promise that resolves to an array of action strings.
   */
  async getActions(): Promise<string[]> {
    if (!this.settings || !this.appBackend || !this.appStateManager) {
      console.error("Settings, backend, or state manager not available for getActions.");
      return [];
    }

    // If combat is properly initiated, return combat actions.
    if (this.settings.plotType === "combat" && this.settings.encounter) {
      return ["Attack", "Defend", "Cast Spell", "Use Item", "Flee"];
    }

    const latestNarrationEvent = [...this.appStateManager.getGlobalState().events].reverse().find(event => event.type === "narration");
    if (latestNarrationEvent && latestNarrationEvent.text) {
      const plotTypePrompt = assignPlotType(latestNarrationEvent.text, Object.values(PlotType.enum));
      try {
        const startTime = Date.now(); // DEBUG: Start timing
        const llmResponse = await this.appBackend.getNarration(plotTypePrompt);
        const parsedPlotType = PlotType.parse(llmResponse.trim());
        const endTime = Date.now(); // DEBUG: End timing
        const duration = (endTime - startTime) / 1000; // DEBUG: duration in seconds
        console.log(`DEBUG: @getActions PlotType updated to: ${this.settings.plotType} in ${duration} seconds`);        

        if (parsedPlotType === "combat" && !this.settings.encounter) {
          console.log("DEBUG: @getActions detected combat, calling setGlobalState to initialize.");          
          // Call setGlobalState to get a writable draft and then call handleConsequence.
          // CRITICAL FIX: Do not await this. The engine currently holds the state lock. 
          // Awaiting here causes a deadlock. By calling void, we queue this update to happen 
          // immediately after the engine releases the lock.
          void this.appStateManager.setGlobalState(async (draft) => {
            await this.handleConsequence("initiative_triggered", draft as WritableDraft<State>, [], "Combat started from narration");
          });

          // After initialization, return combat actions.
          return ["Attack", "Defend", "Cast Spell", "Use Item", "Flee"];
        }        
        this.settings.plotType = parsedPlotType;
      } catch (error) {
        console.error("Error assigning plot type:", error);
      }
    }

    // Default to general actions if not in combat.
    if (this.settings.plotType === "combat" && this.settings.encounter) {
      return ["Attack", "Defend", "Cast Spell", "Use Item", "Flee"];
    } else {
      return ["Explore", "Talk", "Rest", "Search", "Use Item", "Examine", "Use non-combat magic", "Use skill"];
    }
  }

}
