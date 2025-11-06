import { PublicRoomState } from '../sockets/types';

export const rooms = new Map<string, RoomStateInternal>();

type RoomStatus = PublicRoomState['status'];

interface RoomStateInternal extends PublicRoomState {
  // server-only fields can go here later (e.g., currentWord)
}

export function createRoom(id: string, hostId: string, hostName: string): RoomStateInternal {
  const state: RoomStateInternal = {
    id,
    players: [{ id: hostId, name: hostName || 'Player', score: 0, hasGuessed: false }],
    hostId,
    status: 'lobby',
    round: 0,
    maxRounds: 3,
    turn: -1,
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
  // right now no secret fields; later we'll strip currentWord
  const { ...pub } = room;
  return pub;
}
