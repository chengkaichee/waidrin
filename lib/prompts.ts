// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025  Philipp Emanuel Weidmann <pew@worldwidemann.com>

import { convertLocationChangeEventToText, getApproximateTokenCount, getContext } from "./context";
import * as schemas from "./schemas";
import type { LocationChangeEvent, State } from "./state";
import { getActiveGameRuleLogic } from "./engine";

export interface Prompt {
  system: string;
  user: string;
}

/**
 * @function normalize
 * @description Normalizes prompt text by collapsing single newlines into spaces.
 * This helps in creating cleaner-looking prompt strings in code.
 * @param {string} text - The input text to normalize.
 * @returns {string} The normalized text.
 */
function normalize(text: string): string {
  const singleNewline = /(?<!\n)\n(?!\n)/g;
  return text.replaceAll(singleNewline, " ").trim();
}

/**
 * @function makePrompt
 * @description Creates a Prompt object with a default system message.
 * @param {string} userPrompt - The user-specific part of the prompt.
 * @returns {Prompt} A Prompt object.
 */
function makePrompt(userPrompt: string): Prompt {
  return {
    system: "You are the game master of a text-based fantasy role-playing game.",
    user: normalize(userPrompt),
  };
}

/**
 * @constant generateWorldPrompt
 * @description Prompt to generate a fictional world for the RPG.
 * The prompt asks for the world's name and a short description (max 100 words) in JSON format.
 * It specifies that the name should not be cliched and the world should be populated by humans, elves, and dwarves.
 */
export const generateWorldPrompt = makePrompt(`
Create a fictional world for a fantasy adventure RPG and return its name
and a short description (100 words maximum) as a JSON object.
Do not use a cliched name like 'Eldoria'.
The world is populated by humans, elves, and dwarves.
`);

/**
 * @function generateProtagonistPrompt
 * @description Generates a prompt for creating the protagonist character.
 * The prompt includes the protagonist's gender and race, and the world's name and description.
 * It asks for the character description as a JSON object, including a short biography (max 100 words).
 * @param {State} state - The current game state, containing world and protagonist gender/race.
 * @returns {Prompt} A Prompt object for protagonist generation.
 */
export function generateProtagonistPrompt(state: State, initialProtagonistStats: string): Prompt {
  return makePrompt(`
Create a ${state.protagonist.gender} ${state.protagonist.race} protagonist
for a fantasy adventure set in the world of ${state.world.name}.

${state.world.description}

${initialProtagonistStats}

Return the character description as a JSON object. Include a short biography (250 words maximum).
`);
}

/**
 * @function generateStartingLocationPrompt
 * @description Generates a prompt for creating the initial game location.
 * The prompt includes the world's name and description.
 * It asks for the name, type, and a short description (max 100 words) of the location in JSON format.
 * It also specifies a list of allowed location types.
 * @param {State} state - The current game state, containing world information.
 * @returns {Prompt} A Prompt object for starting location generation.
 */
export function generateStartingLocationPrompt(state: State): Prompt {
  return makePrompt(`
Create a starting location for a fantasy adventure set in the world of ${state.world.name}.

${state.world.description}

Return the name and type of the location, and a short description (100 words maximum), as a JSON object.
Choose from the following location types: ${Object.values(schemas.LocationType.enum).join(", ")}
`);
}

/**
 * @function generateStartingCharactersPrompt
 * @description Generates a prompt for creating initial characters at the starting location.
 * The prompt provides context about the world, protagonist, and the starting location.
 * It asks for 5 character descriptions as an array of JSON objects, each with a short biography (max 100 words).
 * @param {State} state - The current game state, including protagonist and location details.
 * @returns {Prompt} A Prompt object for starting characters generation.
 */
export function generateStartingCharactersPrompt(state: State): Prompt {
  const location = state.locations[state.protagonist.locationIndex];

  return makePrompt(`
This is the start of a fantasy adventure set in the world of ${state.world.name}. ${state.world.description}

The protagonist is ${state.protagonist.name}. ${state.protagonist.biography}

${state.protagonist.name} is about to enter ${location.name}. ${location.description}

Create 5 characters that ${state.protagonist.name} might encounter at ${location.name}.
Return the character descriptions as an array of JSON objects.
Include a short biography (100 words maximum) for each character.
`);
}

const makeMainPromptPreamble = (
  state: State,
): string => `This is a fantasy adventure RPG set in the world of ${state.world.name}. ${state.world.description}

The protagonist (who you should refer to as "you" in your narration, as the adventure happens from their perspective)
 is ${state.protagonist.name}. ${state.protagonist.biography}`;

/**
 * @function makeMainPrompt
 * @description Constructs a main prompt by combining a user-provided prompt with the current game context.
 * The context includes narration, character introductions, and location changes.
 * It formats the context to be easily digestible by the language model.
 * @param {string} prompt - The specific user prompt to include.
 * @param {State} state - The current game state.
 * @returns {Prompt} A complete Prompt object with system and user messages.
 */
function makeMainPrompt(prompt: string, state: State): Prompt {
  const promptPreamble = makeMainPromptPreamble(state);

  // get the tokens used by the prompt and the preamble
  const normalizedPrompt = normalize(prompt);
  const promptTokens = getApproximateTokenCount(normalizedPrompt);
  const preambleTokens = getApproximateTokenCount(promptPreamble);

  // get the context based on the token budget minus the prompt and preamble tokens
  const contextTokenBudget = state.inputLength - promptTokens - preambleTokens;
  const context = getContext(state, contextTokenBudget);

  return makePrompt(`
${promptPreamble}

Here is what has happened so far:
${context}



${normalizedPrompt}
`);
}

/**
 * @function narratePrompt
 * @description Generates a prompt for narrating the next part of the story.
 * The prompt instructs the LLM to use novel-style prose, present tense, prioritize dialogue,
 * limit character mentions, bold character names, and write 2-3 paragraphs (max 200 words).
 * It also specifies to stop when it's the protagonist's turn to speak or act and to refer to the protagonist as "you".
 * @param {State} state - The current game state.
 * @param {string} [action] - The action the protagonist has just taken, if any.
 * @returns {Prompt} A prompt for the LLM to generate narration.
 */
export function narratePrompt(state: State, action?: string, checkResultStatements?: string[]): Prompt {
  const checkResultsText = checkResultStatements && checkResultStatements.length > 0 ? `\n\nCheck Results:\n${checkResultStatements.join('\n')}` : '';
  return makeMainPrompt(
    `
${action ? `The protagonist (${state.protagonist.name}) has chosen to do the following: ${action}.` : ""}${checkResultsText}
Narrate what happens next, using novel-style prose, in the present tense.
Prioritize dialogue over descriptions.
Mention as many characters as necessary, but no more than 2 different characters should have dialogue lines in your narration.
Mention who is in protagonist's adventure party, subtly weaving them into the story.
Refer to characters using their first names.
Make all character names bold by surrounding them with double asterisks (**Name**).
Write 2-3 paragraphs (no more than 200 words in total).
Stop when it is the protagonist's turn to speak or act.
Remember to refer to the protagonist (${state.protagonist.name}) as "you" in your narration.
Do not explicitly ask the protagonist for a response at the end; they already know what is expected of them.
`,
    state,
  );
}

/**
 * @function generateActionsPrompt
 * @description Generates a prompt for suggesting possible actions the protagonist can take.
 * The prompt asks for 3 options, each a single, short sentence starting with a verb,
 * returned as a JSON array of strings.
 * @param {State} state - The current game state.
 * @returns {Prompt} A prompt for the LLM to generate action options.
 */
export async function generateActionsPrompt(state: State): Promise<Prompt> {
  const gameRuleLogic = getActiveGameRuleLogic();
  let gameRuleActionsText = "";

  if (gameRuleLogic.getActions) {
    const actions = await gameRuleLogic.getActions();
    gameRuleActionsText = `
Here are the possible actions allowed in the game rule logic:
${actions.map((a: string) => `- ${a}`).join('\n')}
`;
  }

  return makeMainPrompt(
    `${gameRuleActionsText}
Suggest 3 options for what the protagonist (${state.protagonist.name}) could do or say next.
Each option should be a single, short sentence that starts with a verb.
Return the options as a JSON array of strings.
`,
    state,
  );
}

/**
 * @function checkIfSameLocationPrompt
 * @description Generates a prompt to check if the protagonist is still in the same location.
 * The prompt asks for a "yes" or "no" answer.
 * @param {State} state - The current game state.
 * @returns {Prompt} A prompt for the LLM to answer "yes" or "no".
 */
export function checkIfSameLocationPrompt(state: State): Prompt {
  return makeMainPrompt(
    `
Is the protagonist (${state.protagonist.name}) still at ${state.locations[state.protagonist.locationIndex].name}?
Answer with "yes" or "no".
`,
    state,
  );
}

/**
 * @function generateNewLocationPrompt
 * @description Generates a prompt for creating a new location after the protagonist leaves the current one.
 * The prompt asks for the new location's name, type, and a short description (max 100 words) in JSON format.
 * It also asks for the names of any accompanying characters.
 * @param {State} state - The current game state.
 * @returns {Prompt} A prompt for the LLM to generate new location details.
 */
export function generateNewLocationPrompt(state: State): Prompt {
  return makeMainPrompt(
    `
The protagonist (${state.protagonist.name}) has left ${state.locations[state.protagonist.locationIndex].name}.
Return the name and type of their new location, and a short description (100 words maximum), as a JSON object.
Also include the names of the characters that are going to accompany ${state.protagonist.name} there, if any.
`,
    state,
  );
}

/**
 * @function generateNewCharactersPrompt
 * @description Generates a prompt for creating new characters at a new location.
 * This function should be called *before* adding the location change event to the state.
 * The prompt provides context about the new location and any accompanying characters.
 * It asks for 5 additional, new character descriptions as an array of JSON objects,
 * each with a short biography (max 100 words), ensuring no reuse of existing characters.
 * @param {State} state - The current game state.
 * @param {string[]} accompanyingCharacters - An array of names of characters accompanying the protagonist.
 * @returns {Prompt} A prompt for the LLM to generate new character descriptions.
 */
export function generateNewCharactersPrompt(state: State, accompanyingCharacters: string[]): Prompt {
  const location = state.locations[state.protagonist.locationIndex];

  return makeMainPrompt(
    `
The protagonist (${state.protagonist.name}) is about to enter ${location.name}. ${location.description}

${accompanyingCharacters.length > 0 ? `${state.protagonist.name} is accompanied by the following characters: ${accompanyingCharacters.join(", ")}.` : ""}

Create 5 additional, new characters that ${state.protagonist.name} might encounter at ${location.name}.
Do not reuse characters that have already appeared in the story.
Return the character descriptions as an array of JSON objects.
Include a short biography (100 words maximum) for each character.
`,
    state,
  );
}

export function summarizeScenePrompt(state: State): Prompt {
  const protagonistName = state.protagonist.name;

  // Find the start of the current scene (most recent location change in state).
  let sceneStartIndex = -1;
  for (let i = state.events.length - 1; i >= 0; i--) {
    if (state.events[i].type === "location_change") {
      sceneStartIndex = i;
      break;
    }
  }

  // Build location + cast context from that location change
  const mostRecentLocationChangeEvent = state.events[sceneStartIndex];
  const sceneContext = convertLocationChangeEventToText(mostRecentLocationChangeEvent as LocationChangeEvent, state);

  // Gather all narration texts from this scene (after the last location change).
  const narrationTexts = state.events
    .slice(sceneStartIndex + 1)
    .map((ev) => (ev.type === "narration" ? ev.text : null))
    .filter((t): t is string => !!t)
    .join("\n\n");

  const userPrompt = `
${makeMainPromptPreamble(state)}

You will create a compact memory of the just-completed scene. This memory is used as long-term context for future generations.
Write a 1-2 paragraph scene summary (no more than 300 words in total).
Use proper names and refer to the protagonist as "you".
Capture only plot-relevant facts that will matter later such as:
what ${protagonistName} does/learns/decides,
changes to location, inventory, injuries, or relationships,
discoveries/clues,
unresolved goals, promises, threats, or deadlines.
Do not quote dialogue, add new facts, or include stylistic prose.
Return only the summary with no preamble, labels, markdown or quotes.

Here's the context for the scene to summarize:

${sceneContext}

Here's the scene to summarize:

${narrationTexts}
`;

  return makePrompt(userPrompt);
  console.log("DEBUG: summarizeScenePrompt:", userPrompt); 
}
