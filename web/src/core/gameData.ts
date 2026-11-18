import classes from '../../../data/classes.json';
import consumables from '../../../data/consumables.json';
import curses from '../../../data/curses.json';
import encounters from '../../../data/encounters.json';
import enemies from '../../../data/enemies.json';
import items from '../../../data/items.json';
import rooms from '../../../data/rooms.json';
import rules from '../../../data/rules.json';
import skills from '../../../data/skills.json';
import { parseGameData, type GameData } from './data';

/** The numbers in data/, checked once when the game loads. */
export const gameData: GameData = parseGameData({ rules, classes, skills, enemies, encounters, items, consumables, curses, rooms });
