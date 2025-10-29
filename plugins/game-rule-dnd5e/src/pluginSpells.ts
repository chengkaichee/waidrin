
import type { CombatAction, DnDStats } from "./pluginData";
import type { Battle } from "./pluginData";
import type { IAppLibs } from "@/app/services/AppLibs";

export function resolveSpell(
    action: CombatAction,
    battle: Battle,
    appLibs: IAppLibs,
    settings: DnDStats
) {
    const attacker = battle.combatants.find(c => c.id === action.actorId);
    if (!attacker) {
        battle.combatLog.push(`Attacker ${action.actorId} not found for spell casting.`);
        return;
    }

    const target = battle.combatants.find(c => c.id === action.targetId);
    if (!target) {
        battle.combatLog.push(`${attacker.id} casts a spell, but the target is invalid.`);
        return;
    }
    
    const spell = action.spellName || action.description.toLowerCase();
    let spellModifier = 0;
    let canCast = false;
    let spellCheck: 'charisma' | 'wisdom' | 'intelligence' | undefined = undefined;
    
    switch (spell) {
        case "healing word":
            if (attacker.characterIndex === -1) { // Protagonist
                const pcStats = settings;
                switch (pcStats.dndClass) {
                    case "Bard":
                        canCast = true;
                        spellCheck = 'charisma';
                        break;
                    case "Cleric":
                    case "Druid":
                        canCast = true;
                        spellCheck = 'wisdom';
                        break;
                }

                if (spellCheck) {
                    spellModifier = Math.floor((pcStats[spellCheck] - 10) / 2);
                }

            } else {
                // TODO: Need a way to get stats for non-protagonist characters
            }

            if(canCast) {
                const healingRoll = new appLibs.rpgDiceRoller.DiceRoll(`1d4+${spellModifier}`);
                const healing = healingRoll.total;
                target.currentHp += healing;
                if (target.currentHp > target.maxHp) {
                    target.currentHp = target.maxHp;
                }
                battle.combatLog.push(`${attacker.id} casts Healing Word on ${target.id}, restoring ${healing} HP. ${target.id} has ${target.currentHp} HP remaining.`);
            } else {
                battle.combatLog.push(`${attacker.id} cannot cast Healing Word.`);
            }
            break;
        case "cure wounds":
            if (attacker.characterIndex === -1) { // Protagonist
                const pcStats = settings;
                switch (pcStats.dndClass) {
                    case "Bard":
                    case "Paladin":
                        canCast = true;
                        spellCheck = 'charisma';
                        break;
                    case "Cleric":
                    case "Druid":
                    case "Ranger":
                        canCast = true;
                        spellCheck = 'wisdom';
                        break;
                }

                if (spellCheck) {
                    spellModifier = Math.floor((pcStats[spellCheck] - 10) / 2);
                }

            } else {
                // TODO: Need a way to get stats for non-protagonist characters
            }

            if(canCast) {
                const healingRoll = new appLibs.rpgDiceRoller.DiceRoll(`1d8+${spellModifier}`);
                const healing = healingRoll.total;
                target.currentHp += healing;
                if (target.currentHp > target.maxHp) {
                    target.currentHp = target.maxHp;
                }
                battle.combatLog.push(`${attacker.id} casts Cure Wounds on ${target.id}, restoring ${healing} HP. ${target.id} has ${target.currentHp} HP remaining.`);
            } else {
                battle.combatLog.push(`${attacker.id} cannot cast Cure Wounds.`);
            }
            break;
        case "magic missile":
            if (attacker.characterIndex === -1) { // Protagonist
                const pcStats = settings;
                switch (pcStats.dndClass) {
                    case "Sorcerer":
                    case "Wizard":
                        canCast = true;
                        break;
                }
            } else {
                // TODO: Need a way to get stats for non-protagonist characters
                // For now, assume NPCs can cast it if they choose to
                canCast = true;
            }

            if (canCast) {
                // TODO: Implement spell level logic to determine number of missiles
                const numberOfMissiles = 3; // Default for 1st level spell
                let totalDamage = 0;
                for (let i = 0; i < numberOfMissiles; i++) {
                    const missileRoll = new appLibs.rpgDiceRoller.DiceRoll('1d4+1');
                    totalDamage += missileRoll.total;
                }
                
                // TODO: Implement logic for multiple targets. For now, all missiles hit the same target.
                target.currentHp -= totalDamage;
                battle.combatLog.push(`${attacker.id} casts Magic Missile on ${target.id}, sending ${numberOfMissiles} darts and dealing a total of ${totalDamage} force damage. ${target.id} has ${target.currentHp} HP remaining.`);
            } else {
                battle.combatLog.push(`${attacker.id} cannot cast Magic Missile.`);
            }
            break;
        case "fireball":
            if (attacker.characterIndex === -1) { // Protagonist
                const pcStats = settings;
                switch (pcStats.dndClass) {
                    case "Sorcerer":
                    case "Wizard":
                        canCast = true;
                        break;
                }
            } else {
                // TODO: Need a way to get stats for non-protagonist characters
                // For now, assume NPCs can cast it if they choose to
                canCast = true;
            }

            if (canCast) {
                // TODO: Implement spell level logic for +1d6 damage
                const fireballRoll = new appLibs.rpgDiceRoller.DiceRoll('8d6');
                const fireballDamage = fireballRoll.total;

                // TODO: Implement area of effect for Fireball. For now, it only hits the target.
                // TODO: Implement Dexterity saving throw for half damage.
                target.currentHp -= fireballDamage;
                battle.combatLog.push(`${attacker.id} casts Fireball on ${target.id}, dealing ${fireballDamage} fire damage. ${target.id} has ${target.currentHp} HP remaining.`);
            } else {
                battle.combatLog.push(`${attacker.id} cannot cast Fireball.`);
            }
            break;
        default:
            battle.combatLog.push(`${attacker.id} tries to cast an unknown spell: ${action.description}.`);
            break;
    }
}
