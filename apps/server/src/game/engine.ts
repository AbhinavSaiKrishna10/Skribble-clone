import { pickWord, maskWord } from './words';
import { scoreForGuess, drawerBonus } from '../util/scoring';
import type { RoomStateInternal } from './state';

const TURN_MS = 75_000;
const HINT_STAGES_MS = [25_000, 50_000];

export function startGame(room: RoomStateInternal) {
  room.status = 'in-progress';
  room.round = 1;
  room.turn = -1;
}

export function nextTurn(room: RoomStateInternal) {
  if (room.players.length === 0) return;
  room.turn = (room.turn + 1) % room.players.length;

  if (room.turn === 0 && room.round > 0) {
    if (room.round >= room.maxRounds) {
      room.status = 'finished';
      room.turnEndsAt = undefined;
      room.drawingPlayerId = undefined;
      room.revealedHint = undefined;
      return;
    }
    room.round += 1;
  }

  const drawer = room.players[room.turn];
  const word = pickWord();
  room.currentWord = word;
  room.drawingPlayerId = drawer.id;
  room.players.forEach(p => (p.hasGuessed = false));
  room.revealedHint = maskWord(word, 0);
  room.turnEndsAt = Date.now() + TURN_MS;
}

export function revealHint(room: RoomStateInternal) {
  if (!room.currentWord || !room.turnEndsAt) return;
  const elapsed = TURN_MS - Math.max(room.turnEndsAt - Date.now(), 0);
  const level = elapsed >= HINT_STAGES_MS[1] ? 2 : elapsed >= HINT_STAGES_MS[0] ? 1 : 0;
  room.revealedHint = maskWord(room.currentWord, level);
}

export function handleCorrectGuess(room: RoomStateInternal, playerId: string) {
  const player = room.players.find(p => p.id === playerId);
  if (!player || player.hasGuessed) return { gained: 0 };
  player.hasGuessed = true;
  const remainingMs = Math.max((room.turnEndsAt ?? 0) - Date.now(), 0);
  const gained = scoreForGuess(remainingMs);
  player.score += gained;

  const drawer = room.players[room.turn];
  if (drawer) drawer.score += drawerBonus(gained);
  return { gained };
}
