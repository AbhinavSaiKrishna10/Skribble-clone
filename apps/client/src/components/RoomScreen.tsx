import { useEffect, useState } from "react";
import { socket } from "../api/socket";
import { useRoomStore } from "../store/roomStore";
import DrawingCanvas from "./DrawingCanvas";

export default function RoomScreen() {
  const {
    roomId,
    players,
    hostId,
    me,
    status,
    set,
    messages,
    revealedHint,
    drawingPlayerId,
    turnEndsAt,
  } = useRoomStore();

  const [chatInput, setChatInput] = useState("");
  const [wordChoices, setWordChoices] = useState<string[] | null>(null);
  const [wordPicked, setWordPicked] = useState<string | null>(null);

  // NEW: drawerWord holds the real word sent by server (only visible to drawer)
  const [drawerWord, setDrawerWord] = useState<string | null>(null);

  const isHost = me.id === hostId;
  const isDrawer = me.id === drawingPlayerId;

  // ---------------------------------------------------
  // SOCKET LISTENERS
  // ---------------------------------------------------
  useEffect(() => {
    const store = useRoomStore.getState();

    socket.on("room_state", (state) => {
      store.set(state);
      // new public state usually means a new turn or room update; if drawer changed, clear drawerWord
      if (state.drawingPlayerId && state.drawingPlayerId !== drawingPlayerId) {
        setDrawerWord(null);
      }
    });

    socket.on("turn_started", (info) => {
      store.set({
        drawingPlayerId: info.drawingPlayerId,
        revealedHint: info.revealedHint,
        turnEndsAt: info.endsAt,
        round: info.round,
        status: "in-progress",
      } as any);
      // clear previous drawer word until server sends new one
      setDrawerWord(null);
    });

    socket.on("chat_msg", (msg) => {
      store.set((prev: any) => ({ messages: [...prev.messages, msg] }));
    });

    socket.on("turn_ended", () => {
      store.set({ status: "intermission" });
      setDrawerWord(null);
    });

    socket.on("game_ended", (state) => {
      store.set({ status: "finished" });
      store.set(state);
      setDrawerWord(null);
    });

    // NEW: drawer_word — server sends the real word only to the drawer
    socket.on("drawer_word", ({ word }: { word: string }) => {
      const st = useRoomStore.getState();
      if (st.me.id === st.drawingPlayerId) {
        setDrawerWord(word);
      }
    });

    return () => {
      socket.off("room_state");
      socket.off("turn_started");
      socket.off("chat_msg");
      socket.off("turn_ended");
      socket.off("game_ended");
      socket.off("drawer_word");
    };
  }, [drawingPlayerId]);

  // ---------------------------------------------------
  // ACTIONS
  // ---------------------------------------------------
  const startGame = () => {
    if (!roomId) return;
    socket.emit("start_game", { roomId });
  };

  const leaveRoom = () => {
    if (!roomId) return;
    socket.emit("leave_room", { roomId });
    useRoomStore.getState().reset();
  };

  const sendChat = () => {
    if (!chatInput.trim() || !roomId) return setChatInput("");
    socket.emit(
      "chat",
      { roomId, text: chatInput.trim() },
      (ack: any) => {
        if (ack?.correct) {
          useRoomStore.getState().set((prev: any) => ({
            messages: [
              ...prev.messages,
              {
                id: `sys-${Date.now()}`,
                text: `${me.name} guessed correctly!`,
                system: true,
                timestamp: Date.now(),
              },
            ],
          }));
        }
      }
    );
    setChatInput("");
  };

  const onChatKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendChat();
  };

  // ---------------------------------------------------
  // UI
  // ---------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col items-center pt-8 px-4 pb-10">
      {/* Header */}
      <div className="w-full max-w-6xl flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Room: {roomId}</h1>
          <p className="text-sm text-slate-500">
            {players.length} player{players.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex gap-3 mt-4 md:mt-0">
          <button
            onClick={() => navigator.clipboard.writeText(roomId!)}
            className="px-4 py-2 rounded-lg border bg-white shadow text-sm hover:bg-slate-50"
          >
            Copy Room ID
          </button>

          <button
            onClick={leaveRoom}
            className="px-4 py-2 rounded-lg bg-red-500 text-white shadow text-sm hover:bg-red-600"
          >
            Leave Room
          </button>
        </div>
      </div>

      {/* If game is in progress -> show canvas + hint + chat */}
      {status === "in-progress" ? (
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Canvas area (spans 2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {isDrawer ? "You are drawing" : "Guess the word"}
                </h2>
                <div className="text-sm text-slate-600">
                  Round hint: <span className="font-medium">{revealedHint || "?"}</span>
                </div>
              </div>

              <div className="text-sm text-slate-600">
                {turnEndsAt ? (
                  <span>Ends at: {new Date(turnEndsAt).toLocaleTimeString()}</span>
                ) : (
                  <span>Timer: —</span>
                )}
              </div>
            </div>

            {/* Drawer-only word display */}
            {isDrawer && drawerWord && (
              <div className="mb-2 inline-block bg-yellow-50 border border-yellow-200 text-yellow-900 px-4 py-2 rounded-md shadow-sm">
                <strong>Your word:</strong> <span className="ml-2">{drawerWord}</span>
              </div>
            )}

            <div className="bg-white rounded-xl shadow p-4">
              <DrawingCanvas />
            </div>

            <div className="text-xs text-slate-500">
              {isDrawer
                ? "Draw the secret word. Use the color and thickness controls to draw. Your strokes are broadcast in real time."
                : "Watch the strokes and type guesses in chat. Correct guess rewards points."}
            </div>
          </div>

          {/* Right column: players + chat */}
          <aside className="space-y-4">
            {/* Players list */}
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="text-sm font-semibold mb-2">Players</h3>
              <ul className="space-y-2">
                {players.map((p) => (
                  <li key={p.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{p.name} {p.id === hostId && "⭐"}</div>
                      <div className="text-xs text-slate-500">Score: {p.score}</div>
                    </div>
                    <div className="text-xs text-slate-400">{p.id === drawingPlayerId ? "Drawing" : ""}</div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Chat */}
            <div className="bg-white rounded-xl shadow p-3 flex flex-col" style={{ height: 420 }}>
              <div className="flex-1 overflow-y-auto text-sm mb-3">
                {messages.map((m) => (
                  <div key={m.id} className={`${m.system ? "text-blue-600" : "text-slate-800"} mb-2`}>
                    <div className="text-xs text-slate-400">{m.name ?? (m.playerId === me.id ? "You" : "")}</div>
                    <div>{m.text}</div>
                  </div>
                ))}
              </div>

              <div className="mt-auto pt-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={onChatKey}
                  placeholder={isDrawer ? "You cannot guess while drawing" : "Type a guess or chat"}
                  disabled={isDrawer}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={sendChat}
                    disabled={!chatInput.trim() || isDrawer}
                    className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    Send
                  </button>
                  <button
                    onClick={() => {
                      useRoomStore.getState().set({ messages: [] });
                    }}
                    className="px-3 py-2 rounded-lg border"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : (
        // Lobby UI (status !== in-progress)
        <div className="w-full max-w-4xl bg-white rounded-2xl shadow p-8 border">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">Players in this room</h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border bg-slate-50">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-lg">
                  {p.name.slice(0, 1).toUpperCase()}
                </div>

                <div>
                  <p className="font-medium text-slate-900">{p.name} {p.id === hostId && "⭐"}</p>
                  <p className="text-xs text-slate-500">Score: {p.score}</p>
                </div>
              </div>
            ))}
          </div>

          {isHost && (
            <button
              onClick={startGame}
              disabled={players.length < 2}
              className="w-full py-3 rounded-lg text-white font-semibold shadow disabled:opacity-50"
              style={{ background: "linear-gradient(90deg,#06b6d4,#0ea5e9)" }}
            >
              {players.length < 2 ? "Need at least 2 players" : "Start Game"}
            </button>
          )}

          {!isHost && (
            <p className="text-sm text-center text-slate-500">Waiting for host to start the game…</p>
          )}

          {messages.length > 0 && (
            <div className="w-full mt-6 bg-white p-4 rounded-xl shadow border">
              <h3 className="font-semibold mb-2 text-slate-800">Chat (preview)</h3>
              <div className="max-h-40 overflow-y-auto text-sm">
                {messages.map((m) => (
                  <div key={m.id} className={m.system ? "text-blue-500" : ""}>
                    {m.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
