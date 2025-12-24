// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025  chengkaichee@gmail.com

/**
 * INITIAL STAGE: Random Encounter Generator
 * 
 * This module provides context-aware random encounter generation based on 5e SRD data.
 * It uses narration keywords, location context, and party statistics to generate appropriate threats.
 * 
 * FUTURE EXPANSIONS PLANNED:
 * 1. Expanded Monster Bestiary: Including Dragons, Giants, Fey, Fiends, Celestials, and high-level threats to cover all CR ranges.
 * 2. Diverse Biomes: Detailed tables for Arctic, Desert, Underwater, Planar, Coastal, and more granular environments.
 * 3. Signature/Special Attacks: Incorporating SRD specific abilities (e.g., Breath Weapons, Pack Tactics, Web, Poison, Regeneration) into the CombatAction logic.
 * 4. Game AI & Tactics:
 *    - Grouping behaviors (e.g., Goblins swarm, Wolves use pack tactics to flank).
 *    - Advanced tactical decision making based on monster intelligence and roles (Leader, Controller, Skirmisher, Brute).
 *    - Morale systems (enemies fleeing when leader falls).
 */

import * as RpgDiceRoller from '@dice-roller/rpg-dice-roller';

export interface MonsterStatBlock {
  id: string;          // Unique ID/Key
  name: string;        // Display name
  type: string;        // Humanoid, Beast, Undead, etc.
  keywords: string[];  // Words the LLM might use in narration that match this monster
  biomes: string[];    // Where they appear: Forest, Mountain, Swamp, Dungeon, Urban, etc.
  ac: number;
  hp: number;
  cr: number;          // Challenge Rating (used for XP budget)
  alignment?: string;
  attacks?: string[];  // Simplified strings for the log
  description: string; // Flavor text
}

export const MonsterDatabase: MonsterStatBlock[] = [
  // --- 1. Humanoids (Bandits, Orcs, Goblins) ---
  {
    id: "goblin", name: "Goblin", type: "Humanoid",
    keywords: ["goblin", "small", "horde", "ambush", "greenskin", "runt"],
    biomes: ["Forest", "Cave", "Dungeon", "Hill"],
    ac: 15, hp: 7, cr: 0.25,
    description: "A small, malicious humanoid with nimble movements."
  },
  {
    id: "bandit", name: "Bandit", type: "Humanoid",
    keywords: ["bandit", "thug", "human", "robber", "outlaw", "criminal", "highwayman"],
    biomes: ["Road", "Forest", "Urban", "Hill"],
    ac: 12, hp: 11, cr: 0.125,
    description: "A rough-looking human looking for easy prey."
  },
  {
    id: "orc", name: "Orc", type: "Humanoid",
    keywords: ["orc", "savage", "warrior", "raid", "brute", "tusks"],
    biomes: ["Mountain", "Hill", "Cave", "Badland"],
    ac: 13, hp: 15, cr: 0.5,
    description: "A hulking grey-skinned warrior with a greataxe."
  },
  {
    id: "hobgoblin", name: "Hobgoblin", type: "Humanoid",
    keywords: ["hobgoblin", "soldier", "leader", "armored", "disciplined", "captain"],
    biomes: ["Forest", "Hill", "Dungeon"],
    ac: 18, hp: 11, cr: 0.5,
    description: "A disciplined, orange-skinned humanoid in chain mail."
  },
  {
    id: "thug", name: "Thug", type: "Humanoid",
    keywords: ["thug", "enforcer", "brute", "gang", "heavy"],
    biomes: ["Urban", "Road", "Dungeon"],
    ac: 11, hp: 32, cr: 0.5,
    description: "A ruthless enforcer with a mace."
  },

  // --- 2. Undead (Skeletons, Zombies) ---
  {
    id: "skeleton", name: "Skeleton", type: "Undead",
    keywords: ["skeleton", "bones", "undead", "rattle", "archer", "skeletal"],
    biomes: ["Dungeon", "Crypt", "Ruins", "Graveyard"],
    ac: 13, hp: 13, cr: 0.25,
    description: "Animated bones holding a weapon."
  },
  {
    id: "zombie", name: "Zombie", type: "Undead",
    keywords: ["zombie", "rot", "corpse", "undead", "shambling", "walker"],
    biomes: ["Swamp", "Dungeon", "Crypt", "Graveyard"],
    ac: 8, hp: 22, cr: 0.25,
    description: "A rotting corpse animated by dark magic."
  },
  {
    id: "ghoul", name: "Ghoul", type: "Undead",
    keywords: ["ghoul", "flesh-eater", "paralyzing", "undead", "hungry"],
    biomes: ["Dungeon", "Crypt", "Ruins", "Graveyard"],
    ac: 12, hp: 22, cr: 1,
    description: "A feral, flesh-eating undead creature."
  },
  {
    id: "specter", name: "Specter", type: "Undead",
    keywords: ["specter", "ghost", "spirit", "incorporeal", "wraith", "phantom"],
    biomes: ["Dungeon", "Ruins", "Haunted", "Crypt"],
    ac: 12, hp: 22, cr: 1,
    description: "A hateful, incorporeal spirit."
  },

  // --- 3. Beasts & Naturals ---
  {
    id: "wolf", name: "Wolf", type: "Beast",
    keywords: ["wolf", "wolves", "pack", "howl", "canine", "beast"],
    biomes: ["Forest", "Hill", "Plains", "Cave"],
    ac: 13, hp: 11, cr: 0.25,
    description: "A large predatory canine."
  },
  {
    id: "giant_spider", name: "Giant Spider", type: "Beast",
    keywords: ["spider", "web", "arachnid", "venom", "poison", "legs"],
    biomes: ["Forest", "Cave", "Dungeon", "Underdark"],
    ac: 14, hp: 26, cr: 1,
    description: "A spider the size of a horse."
  },
  {
    id: "black_bear", name: "Black Bear", type: "Beast",
    keywords: ["bear", "beast", "claw", "maul", "ursine"],
    biomes: ["Forest", "Cave", "Hill"],
    ac: 11, hp: 19, cr: 0.5,
    description: "A medium-sized bear."
  },
  {
    id: "dire_wolf", name: "Dire Wolf", type: "Beast",
    keywords: ["dire wolf", "giant wolf", "alpha", "large beast", "worg"],
    biomes: ["Forest", "Hill", "Plains"],
    ac: 14, hp: 37, cr: 1,
    description: "An enormous wolf, primal and fierce."
  },
  {
    id: "giant_rat", name: "Giant Rat", type: "Beast",
    keywords: ["rat", "vermin", "rodent", "swarm", "squeak"],
    biomes: ["Urban", "Dungeon", "Sewer", "Cave"],
    ac: 12, hp: 7, cr: 0.125,
    description: "A rat the size of a small dog."
  },

  // --- 4. Monstrosities & Magical ---
  {
    id: "cockatrice", name: "Cockatrice", type: "Monstrosity",
    keywords: ["cockatrice", "bird", "lizard", "petrify", "chicken"],
    biomes: ["Plains", "Mountain", "Road"],
    ac: 11, hp: 27, cr: 0.5,
    description: "A monstrous hybrid of lizard and bird."
  },
  {
    id: "worg", name: "Worg", type: "Monstrosity",
    keywords: ["worg", "monstrosity", "sentient wolf", "evil wolf"],
    biomes: ["Plains", "Forest", "Goblin Camp"],
    ac: 13, hp: 26, cr: 0.5,
    description: "A large, evil wolf-like monster with goblin allies."
  },
  {
    id: "gelatinous_cube", name: "Gelatinous Cube", type: "Ooze",
    keywords: ["cube", "ooze", "jelly", "transparent", "acid", "slime"],
    biomes: ["Dungeon", "Corridor", "Ruins"],
    ac: 6, hp: 84, cr: 2,
    description: "A transparent cube of acidic slime."
  },
  {
    id: "ogre", name: "Ogre", type: "Giant",
    keywords: ["ogre", "giant", "smash", "club", "huge", "lout"],
    biomes: ["Mountain", "Cave", "Swamp", "Hill"],
    ac: 11, hp: 59, cr: 2,
    description: "A large, dim-witted giant."
  },
  {
    id: "imp", name: "Imp", type: "Fiend",
    keywords: ["imp", "devil", "fiend", "wings", "sting", "tiny"],
    biomes: ["Dungeon", "Urban", "Ruins"],
    ac: 13, hp: 10, cr: 1,
    description: "A tiny, shapeshifting devil."
  },
  {
    id: "rust_monster", name: "Rust Monster", type: "Monstrosity",
    keywords: ["rust", "metal", "insect", "feeler", "corrode"],
    biomes: ["Dungeon", "Cave", "Underdark"],
    ac: 14, hp: 27, cr: 0.5,
    description: "A bizarre insectoid that eats metal."
  }
];

export interface EncounterCriteria {
  narration: string;
  locationType: string; // Map from global state Location.type or name
  partyLevel: number;
  partySize: number;
  difficulty?: "easy" | "medium" | "hard" | "deadly";
}

/**
 * Generates a list of monsters for an encounter based on criteria.
 * @param criteria - The context for the encounter.
 * @returns Array of MonsterStatBlock to be instantiated.
 */
export function generateEncounter(criteria: EncounterCriteria): MonsterStatBlock[] {
  const { narration, locationType, partyLevel, partySize, difficulty = "medium" } = criteria;
  
  const normalizedNarration = narration.toLowerCase();
  
  // 1. Identify Keyword Matches
  const matchedMonsters = MonsterDatabase.filter(monster => 
    monster.keywords.some(k => normalizedNarration.includes(k))
  );

  // 2. Identify Biome Matches
  // We try to match the locationType string to the monster biomes.
  // This is a loose match (e.g. "Dark Forest" matches "Forest").
  const biomeMonsters = MonsterDatabase.filter(monster => 
    monster.biomes.some(b => locationType.toLowerCase().includes(b.toLowerCase()))
  );

  // 3. Selection Pool
  // If we found specific keywords, prioritize those. 
  // Otherwise, fall back to biome-appropriate monsters.
  // If neither, fall back to all monsters (generic road encounter).
  let selectionPool: MonsterStatBlock[] = [];
  
  if (matchedMonsters.length > 0) {
    selectionPool = matchedMonsters;
  } else if (biomeMonsters.length > 0) {
    selectionPool = biomeMonsters;
  } else {
    // Default to common types if nothing matches
    selectionPool = MonsterDatabase.filter(m => m.type === "Humanoid" || m.type === "Beast");
  }

  // 4. Calculate Budget
  // Base budget: Total CR = Party Level * Party Size * 0.5 (Medium difficulty approx)
  let difficultyMultiplier = 1;
  switch (difficulty) {
      case "easy": difficultyMultiplier = 0.5; break;
      case "medium": difficultyMultiplier = 1.0; break;
      case "hard": difficultyMultiplier = 1.5; break;
      case "deadly": difficultyMultiplier = 2.0; break;
  }

  const crBudget = Math.max(0.25, (partyLevel * partySize * 0.5 * difficultyMultiplier));
  
  const encounterList: MonsterStatBlock[] = [];
  let currentCost = 0;
  
  // Safety break to prevent infinite loops
  let attempts = 0; 
  
  while (currentCost < crBudget && attempts < 20) {
    attempts++;
    
    // Filter pool for monsters that fit within remaining budget
    const affordable = selectionPool.filter(m => m.cr <= (crBudget - currentCost));
    
    if (affordable.length === 0) {
        break; // Can't afford any more
    }

    // Pick random monster
    const roll = new RpgDiceRoller.DiceRoll(`1d${affordable.length}`).total - 1;
    const selected = affordable[roll];
    
    encounterList.push(selected);
    currentCost += selected.cr;
  }

  // Fallback: If budget logic failed to produce anything (e.g. high level monster in low level budget),
  // force at least one weak enemy.
  if (encounterList.length === 0) {
      const weakMonsters = selectionPool.filter(m => m.cr <= 0.25);
      if (weakMonsters.length > 0) {
          encounterList.push(weakMonsters[0]);
      } else {
          // Last resort: A single Goblin or Rat
          encounterList.push(MonsterDatabase.find(m => m.id === "goblin") || MonsterDatabase[0]);
      }
  }

  return encounterList;
}
