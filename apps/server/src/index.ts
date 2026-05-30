import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { v4 as uuid } from "uuid";

import {
  ClientToServer,
  ServerToClient,
} from "./sockets/types";

import {
  rooms,
  createRoom,
  joinRoom,
  publicRoomState
} from "./game/state";

import {
  startGame,
  nextTurn,
  handleCorrectGuess,
  checkAllGuessed,
} from "./game/engine";

import { sanitizeChat, isCheat } from "./util/guard";

const PORT = Number(process.env.PORT || 4000);
const ORIGIN = process.env.CLIENT_URL || "*";

const app = express();
app.use(cors({ origin: ORIGIN }));
app.get("/health", (_req, res) => res.send("ok"));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: ORIGIN } });


// ---------------------------------------------------------
// GLOBAL GAME LOOP — runs every 1 second
// ---------------------------------------------------------
function triggerIntermission(room: any) {
  room.status = "intermission";
  room.intermissionEndsAt = Date.now() + 5000;
  room.revealedHint = room.currentWord; // fully reveal word
  
  io.to(room.id).emit(ServerToClient.TURN_ENDED, {});
  io.to(room.id).emit(ServerToClient.ROOM_STATE, publicRoomState(room));
}

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.mode !== "skribble") continue;

    if (room.status === "in-progress") {
      if (!room.turnEndsAt) continue;

      // If turn timer expired, move to intermission
      if (Date.now() >= room.turnEndsAt) {
        triggerIntermission(room);
      }
    } else if (room.status === "intermission") {
      if (!room.intermissionEndsAt) continue;

      if (Date.now() >= room.intermissionEndsAt) {
        nextTurn(room);

        if (room.status === "finished") {
          io.to(room.id).emit(ServerToClient.GAME_ENDED, publicRoomState(room));
        } else {
          room.status = "in-progress";
          // notify everyone of a new turn
          io.to(room.id).emit(ServerToClient.TURN_STARTED, {
            drawingPlayerId: room.drawingPlayerId,
            revealedHint: room.revealedHint,
            endsAt: room.turnEndsAt,
            round: room.round,
          });

          // send real word ONLY to drawer
          if (room.drawingPlayerId && room.currentWord) {
            io.to(room.drawingPlayerId).emit("drawer_word", { word: room.currentWord });
          }
        }

        // broadcast updated public state
        io.to(room.id).emit(ServerToClient.ROOM_STATE, publicRoomState(room));
      }
    }
  }
}, 1000);


// ---------------------------------------------------------
// SOCKET CONNECTION HANDLERS
// ---------------------------------------------------------
io.on("connection", (socket) => {
  console.log("user connected", socket.id);

  // CREATE ROOM
  socket.on(ClientToServer.CREATE_ROOM, ({ name }, cb) => {
    const roomId = uuid().slice(0, 6);
    const state = createRoom(roomId, socket.id, name || "Player");

    socket.join(roomId);
    cb?.({ roomId, state: publicRoomState(state) });

    io.to(roomId).emit(ServerToClient.ROOM_STATE, publicRoomState(state));
  });

  // JOIN ROOM
  socket.on(ClientToServer.JOIN_ROOM, ({ roomId, name }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: "Room not found" });
    if (room.players.length >= 8) return cb?.({ error: "Room full" });

    joinRoom(room, socket.id, name || "Player");
    socket.join(roomId);

    const pub = publicRoomState(room);
    io.to(roomId).emit(ServerToClient.ROOM_STATE, pub);
    cb?.({ state: pub });
  });

  // LEAVE ROOM
  socket.on(ClientToServer.LEAVE_ROOM, ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.players = room.players.filter((p) => p.id !== socket.id);
    socket.leave(roomId);

    if (room.players.length === 0) {
      rooms.delete(room.id);
    } else {
      io.to(room.id).emit(ServerToClient.ROOM_STATE, publicRoomState(room));
    }
  });

  // START GAME
  socket.on(ClientToServer.START_GAME, ({ roomId, mode }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (socket.id !== room.hostId) return; // host only

    room.mode = mode || 'skribble';
    room.status = "in-progress";

    if (room.mode === 'skribble') {
      // initialize game and first turn
      startGame(room);
      nextTurn(room);

      // Notify everyone turn started
      io.to(room.id).emit(ServerToClient.TURN_STARTED, {
        drawingPlayerId: room.drawingPlayerId,
        revealedHint: room.revealedHint,
        endsAt: room.turnEndsAt,
        round: room.round,
      });

      // send drawer the real word
      if (room.drawingPlayerId && room.currentWord) {
        console.log("START_GAME: sending drawer_word to:", room.drawingPlayerId, room.currentWord);
        io.to(room.drawingPlayerId).emit("drawer_word", { word: room.currentWord });
      }
    }

    io.to(room.id).emit(ServerToClient.ROOM_STATE, publicRoomState(room));
  });

  // END GAME
  socket.on(ClientToServer.END_GAME, ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (socket.id !== room.hostId) return;

    room.status = "finished";
    io.to(room.id).emit(ServerToClient.GAME_ENDED, publicRoomState(room));
    io.to(room.id).emit(ServerToClient.ROOM_STATE, publicRoomState(room));
  });

  // DRAW
  socket.on(ClientToServer.DRAW, ({ roomId, events }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.mode === 'skribble' && socket.id !== room.drawingPlayerId) return;

    socket.to(roomId).emit(ServerToClient.DRAW_UPDATE, events);
  });

  // CHAT
  socket.on(ClientToServer.CHAT, ({ roomId, text }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: "Room not found" });

    const clean = sanitizeChat(text);

    const player = room.players.find(p => p.id === socket.id);
    const playerName = player?.name || "Player";

    if (socket.id === room.drawingPlayerId && isCheat(clean, room.currentWord)) {
      return cb?.({ blocked: true });
    }

    // correct guess?
    if (room.currentWord && clean.toLowerCase() === room.currentWord.toLowerCase()) {
      const { gained } = handleCorrectGuess(room, socket.id);

      io.to(roomId).emit(ServerToClient.CHAT_MSG, {
        id: uuid(),
        playerId: socket.id,
        name: playerName,
        text: "guessed the word!",
        correct: true,
        system: true,
        timestamp: Date.now(),
      });

      io.to(roomId).emit(ServerToClient.ROOM_STATE, publicRoomState(room));

      // early end turn if everyone guessed
      if (checkAllGuessed(room)) {
        triggerIntermission(room);
      }

      return cb?.({ correct: true, gained });
    }

    // normal chat broadcast
    io.to(roomId).emit(ServerToClient.CHAT_MSG, {
      id: uuid(),
      playerId: socket.id,
      name: playerName,
      text: clean,
      timestamp: Date.now(),
    });

    cb?.({ ok: true });
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      const wasIn = room.players.some((p) => p.id === socket.id);
      if (!wasIn) continue;

      room.players = room.players.filter((p) => p.id !== socket.id);

      if (room.players.length === 0) {
        rooms.delete(room.id);
      } else {
        io.to(room.id).emit(ServerToClient.ROOM_STATE, publicRoomState(room));
      }
    }
  });
});

server.listen(PORT, () => console.log(`Server running on :${PORT}`));
