export type PlayerID = string;
export type RoomID = string;

export interface Player {
  id: PlayerID; // socket.id
  name: string;
  score: number;      // used later in 2C
  hasGuessed: boolean; // used later in 2C
}

export interface PublicRoomState {
  id: RoomID;
  players: Player[];
  hostId: PlayerID;
  status: 'lobby' | 'in-progress' | 'intermission' | 'finished';
  mode: 'skribble' | 'free-canvas';
  round: number;      // used later
  maxRounds: number;  // used later
  turn: number;       // used later
  drawingPlayerId?: PlayerID; // used later
  revealedHint?: string;      // used later
  turnEndsAt?: number;        // used later
  intermissionEndsAt?: number;
}

export type DrawEvent =
  | { type: 'begin'; x: number; y: number; thickness: number; color: string }
  | { type: 'stroke'; x: number; y: number }
  | { type: 'end' }
  | { type: 'clear' };

export const ClientToServer = {
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  START_GAME: 'start_game', // used in 2C
  PICK_WORD: 'pick_word',   // used in 2C
  DRAW: 'draw',
  CHAT: 'chat',
  REQUEST_STATE: 'request_state',
  END_GAME: 'end_game',
} as const;

export const ServerToClient = {
  ROOM_STATE: 'room_state',
  CHAT_MSG: 'chat_msg',
  TURN_STARTED: 'turn_started', // used in 2C
  TURN_ENDED: 'turn_ended',     // used in 2C
  ROUND_ENDED: 'round_ended',   // used in 2C
  GAME_ENDED: 'game_ended',     // used in 2C
  DRAW_UPDATE: 'draw_update',
  ERROR: 'error',
} as const;
