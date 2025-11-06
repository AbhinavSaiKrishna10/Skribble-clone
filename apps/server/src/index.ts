import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { v4 as uuid } from 'uuid';
import { ClientToServer, ServerToClient, DrawEvent } from './sockets/types';
import { rooms, createRoom, joinRoom, leaveRoom, publicRoomState } from './game/state';
import { sanitizeChat, isCheat } from './util/guard';
import { startGame, nextTurn, revealHint, handleCorrectGuess } from './game/engine';

const PORT = Number(process.env.PORT || 4000);
const ORIGIN = process.env.CLIENT_URL || '*';

const app = express();
app.use(cors({ origin: ORIGIN }));
app.get('/health', (_req, res) => res.send('ok'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: ORIGIN } });

// 1s tick: reveal hints and end turns
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.status !== 'in-progress' || !room.turnEndsAt) continue;

    // hint progression
    revealHint(room);
    io.to(room.id).emit(ServerToClient.ROOM_STATE, publicRoomState(room));

    // end-of-turn
    if (Date.now() >= room.turnEndsAt) {
      io.to(room.id).emit(ServerToClient.TURN_ENDED, {});
      nextTurn(room);
      if (room.status === 'finished') {
        io.to(room.id).emit(ServerToClient.GAME_ENDED, publicRoomState(room));
      } else {
        io.to(room.id).emit(ServerToClient.TURN_STARTED, {
          drawingPlayerId: room.drawingPlayerId,
          revealedHint: room.revealedHint,
          endsAt: room.turnEndsAt,
          round: room.round,
        });
      }
    }
  }
}, 1000);

io.on('connection', (socket) => {
  // --- room lifecycle ---
  socket.on(ClientToServer.CREATE_ROOM, ({ name }: { name: string }, cb) => {
    const roomId = uuid().slice(0, 6);
    const state = createRoom(roomId, socket.id, name || 'Player');
    socket.join(roomId);
    cb?.({ roomId, state: publicRoomState(state) });
    io.to(roomId).emit(ServerToClient.ROOM_STATE, publicRoomState(state));
  });

  socket.on(ClientToServer.JOIN_ROOM, ({ roomId, name }: { roomId: string; name: string }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: 'Room not found' });
    if (room.players.length >= 8) return cb?.({ error: 'Room full' });
    joinRoom(room, socket.id, name || 'Player');
    socket.join(roomId);
    const pub = publicRoomState(room);
    io.to(roomId).emit(ServerToClient.ROOM_STATE, pub);
    cb?.({ state: pub });
  });

  socket.on(ClientToServer.LEAVE_ROOM, ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    leaveRoom(room, socket.id);
    socket.leave(roomId);
    if (room.players.length === 0) {
      rooms.delete(room.id);
    } else {
      if (room.hostId === socket.id) room.hostId = room.players[0].id;
      io.to(room.id).emit(ServerToClient.ROOM_STATE, publicRoomState(room));
    }
  });

  // --- game controls ---
  socket.on(ClientToServer.START_GAME, ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (socket.id !== room.hostId) return; // host-only
    startGame(room);
    nextTurn(room);
    io.to(roomId).emit(ServerToClient.TURN_STARTED, {
      drawingPlayerId: room.drawingPlayerId,
      revealedHint: room.revealedHint,
      endsAt: room.turnEndsAt,
      round: room.round,
    });
    io.to(roomId).emit(ServerToClient.ROOM_STATE, publicRoomState(room));
  });

  // --- drawing: only current drawer may broadcast ---
  socket.on(ClientToServer.DRAW, ({ roomId, events }: { roomId: string; events: DrawEvent[] }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.drawingPlayerId !== socket.id) return; // guard
    socket.to(roomId).emit(ServerToClient.DRAW_UPDATE, events);
  });

  // --- chat & guessing ---
  socket.on(ClientToServer.CHAT, ({ roomId, text }: { roomId: string; text: string }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: 'Room not found' });
    const clean = sanitizeChat(text);

    // block exact word reveal to prevent cheating
    if (isCheat(clean, room.currentWord)) return cb?.({ blocked: true });

    // correct guess?
    if (room.currentWord && clean.toLowerCase() === room.currentWord.toLowerCase()) {
      const { gained } = handleCorrectGuess(room, socket.id);
      io.to(roomId).emit(ServerToClient.CHAT_MSG, {
        id: uuid(), playerId: socket.id, text: 'guessed the word!', correct: true, system: true, timestamp: Date.now()
      });
      io.to(roomId).emit(ServerToClient.ROOM_STATE, publicRoomState(room));
      return cb?.({ correct: true, gained });
    }

    // normal chat
    io.to(roomId).emit(ServerToClient.CHAT_MSG, {
      id: uuid(), playerId: socket.id, text: clean, timestamp: Date.now()
    });
    cb?.({ ok: true });
  });

  socket.on(ClientToServer.REQUEST_STATE, ({ roomId }: { roomId: string }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: 'Room not found' });
    cb?.({ state: publicRoomState(room) });
  });

  socket.on('disconnect', () => {
    for (const room of rooms.values()) {
      const wasIn = room.players.some(p => p.id === socket.id);
      if (!wasIn) continue;
      leaveRoom(room, socket.id);
      if (room.players.length === 0) {
        rooms.delete(room.id);
      } else {
        if (room.hostId === socket.id) room.hostId = room.players[0].id;
        io.to(room.id).emit(ServerToClient.ROOM_STATE, publicRoomState(room));
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server on :${PORT}`);
});
