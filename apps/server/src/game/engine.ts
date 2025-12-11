import { Player } from "../sockets/types";

/**
 * Game engine: handles word selection, hint reveal, scoring, turn rotation.
 * We auto-assign a word at each turn so the drawer always knows the word.
 */

const WORDS = [
  "apple","banana","cat","dog","sun","moon","car","house","tree",
  "flower","pencil","phone","rocket","pizza","chair","cloud"
];

export function startGame(room: any) {
  room.status = "in-progress";
  room.round = 1;
  room.turn = 1;
  room.maxRounds = 3;
  room.currentWord = null;
  room.revealedHint = null;
  // Note: nextTurn() will assign the first word & timer
}

export function nextTurn(room: any) {
  const idx = room.players.findIndex((p: Player) => p.id === room.drawingPlayerId);

  // pick next drawer (wrap)
  if (idx === -1) {
    room.drawingPlayerId = room.players[0]?.id;
  } else {
    room.drawingPlayerId = room.players[(idx + 1) % room.players.length].id;
  }

  // reset per-player turn flags
  room.players.forEach((p: Player) => (p.hasGuessed = false));

  // increment round if drawer wrapped to first player
  if (idx !== -1 && (idx + 1) % room.players.length === 0) {
    room.round = (room.round || 1) + 1;
  }

  // check finished
  if (room.round && room.round > room.maxRounds) {
    room.status = "finished";
    room.currentWord = null;
    room.revealedHint = null;
    room.turnEndsAt = undefined;
    return;
  }

  // --- AUTO-ASSIGN A WORD FOR THIS TURN ---
  const selected = WORDS[Math.floor(Math.random() * WORDS.length)];
  room.currentWord = selected;
  // revealedHint uses spaces between letters for readability (matching client)
  room.revealedHint = selected.split("").map(() => "_").join(" ");

  // start turn timer (e.g., 60s)
  room.turnEndsAt = Date.now() + 60_000;
}

export function revealHint(room: any) {
  if (!room.currentWord || !room.revealedHint) return;

  const letters = room.currentWord.split("");
  const hintArr = room.revealedHint.split(" ");

  // reveal random unrevealed letters slowly (probability)
  for (let i = 0; i < letters.length; i++) {
    if (hintArr[i] === "_" && Math.random() < 0.08) {
      hintArr[i] = letters[i];
    }
  }

  room.revealedHint = hintArr.join(" ");
}

export function handleCorrectGuess(room: any, playerId: string) {
  const player = room.players.find((p: Player) => p.id === playerId);
  if (!player || player.hasGuessed) return { gained: 0 };

  player.hasGuessed = true;
  player.score = (player.score || 0) + 100;

  return { gained: 100 };
}
