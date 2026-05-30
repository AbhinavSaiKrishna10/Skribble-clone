import { create } from 'zustand';

type Player = { id: string; name: string; score: number; hasGuessed: boolean };

type Message = { id: string; playerId?: string; name?: string; text: string; system?: boolean; correct?: boolean; timestamp?: number };

type Status = 'lobby'|'in-progress'|'intermission'|'finished';

interface RoomState {
  // server-provided
  id?: string;
  players: Player[];
  hostId?: string;
  status: Status;
  mode?: 'skribble' | 'free-canvas';
  round?: number;
  maxRounds?: number;
  turn?: number;
  drawingPlayerId?: string;
  revealedHint?: string;
  turnEndsAt?: number;

  // local-only
  roomId: string | null;
  me: { id: string | null; name: string };

  messages: Message[];

  set: (s: Partial<RoomState> | ((prev: RoomState)=>Partial<RoomState>)) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  players: [],
  status: 'lobby',
  roomId: null,
  me: { id: null, name: '' },
  messages: [],
  set: (s) => set(typeof s === 'function' ? s(get()) : s),
  reset: () => set({ players: [], status: 'lobby', roomId: null, me: { id: null, name: '' }, messages: [] })
}));

if (typeof window !== "undefined") {
  // @ts-ignore
  window.useRoomStore = useRoomStore;
}
