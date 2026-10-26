// Compatibility layer: the public API of the characters (ids, moods, <Character>, <CharacterArt>) now draws
// the style-v2 figures from `./v2/CharacterV2`. Space is 240×300 (the old one was 200×220).
import './art.css';
import { MOODS, type Mood } from './mood';
import { CharacterV2, CharacterV2Art, V2_IDS, V2_NAMES, type V2Id } from './v2/CharacterV2';

export type { Mood };
export { MOODS };
export type CharacterId = V2Id;

export const CHARACTER_IDS: CharacterId[] = V2_IDS;
export const CHARACTER_NAMES: Record<CharacterId, string> = V2_NAMES;

/** viewBox of every character and its height/width ratio. */
export const CHARACTER_VIEWBOX = '0 0 240 300';
export const CHARACTER_ASPECT = 1.25;

/** Nestable art (returns <g> in a 240×300 coordinate space). */
export function CharacterArt({ id, mood = 'neutral' }: { id: CharacterId; mood?: Mood }) {
  return <CharacterV2Art id={id} mood={mood} />;
}

export function Character({
  id, mood = 'neutral', size = 200, title,
}: { id: CharacterId; mood?: Mood; size?: number; title?: string }) {
  return <CharacterV2 id={id} mood={mood} size={size} title={title} />;
}
