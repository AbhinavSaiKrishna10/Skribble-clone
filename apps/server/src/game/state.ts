import { PublicRoomState } from '../sockets/types';

export const rooms = new Map<string, RoomStateInternal>();

export interface RoomStateInternal extends PublicRoomState {
  currentWord?: string;       // server-only
}

export function createRoom(id: string, hostId: string, hostName: string): RoomStateInternal {
  const state: RoomStateInternal = {
    id,
    players: [{ id: hostId, name: hostName || 'Player', score: 0, hasGuessed: false }],
    hostId,
    status: 'lobby',
    mode: 'skribble',
    round: 0,
    maxRounds: 3,
    turn: -1,
    drawingPlayerId: undefined,
    revealedHint: '',
    turnEndsAt: undefined,
    intermissionEndsAt: undefined,
  };
  rooms.set(id, state);
  return state;
}

export function joinRoom(room: RoomStateInternal, id: string, name: string) {
  if (room.players.find(p => p.id === id)) return;
  room.players.push({ id, name: name || 'Player', score: 0, hasGuessed: false });
}

export function leaveRoom(room: RoomStateInternal, playerId: string) {
  room.players = room.players.filter(p => p.id !== playerId);
}

export function publicRoomState(room: RoomStateInternal): PublicRoomState {
  const { currentWord, ...pub } = room;
  return pub;
}
