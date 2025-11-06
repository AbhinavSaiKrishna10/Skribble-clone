import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { v4 as uuid } from 'uuid';
import { ClientToServer, ServerToClient, DrawEvent } from './sockets/types';
import { rooms, createRoom, joinRoom, leaveRoom, publicRoomState } from './game/state';
import { sanitizeChat } from './util/guard';

const PORT = Number(process.env.PORT || 4000);
const ORIGIN = process.env.CLIENT_URL || '*';

const app = express();
app.use(cors({ origin: ORIGIN }));
app.get('/health', (_req, res) => res.send('ok'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: ORIGIN } });

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

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
      rooms.delete(roomId);
    } else {
      // transfer host if needed
      if (room.hostId === socket.id) room.hostId = room.players[0].id;
      io.to(roomId).emit(ServerToClient.ROOM_STATE, publicRoomState(room));
    }
  });

  socket.on(ClientToServer.CHAT, ({ roomId, text }: { roomId: string; text: string }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: 'Room not found' });
    const clean = sanitizeChat(text);
    io.to(roomId).emit(ServerToClient.CHAT_MSG, {
      id: uuid(),
      playerId: socket.id,
      text: clean,
      timestamp: Date.now(),
    });
    cb?.({ ok: true });
  });

  socket.on(ClientToServer.DRAW, ({ roomId, events }: { roomId: string; events: DrawEvent[] }) => {
    // 2B: trust the client; in 2C we'll restrict to drawing player
    if (!rooms.has(roomId)) return;
    socket.to(roomId).emit(ServerToClient.DRAW_UPDATE, events);
  });

  socket.on(ClientToServer.REQUEST_STATE, ({ roomId }: { roomId: string }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: 'Room not found' });
    cb?.({ state: publicRoomState(room) });
  });

  socket.on('disconnect', () => {
    // remove player from any rooms they were in
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
    console.log('socket disconnected', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server on :${PORT}`);
});
