import { useEffect } from 'react';
import { socket } from './api/socket';
import { useRoomStore } from './store/roomStore';
import Lobby from './components/Lobby';
import RoomScreen from "./components/RoomScreen";

export default function App() {
  const set = useRoomStore(s => s.set);
  const roomId = useRoomStore(s => s.roomId);

  useEffect(() => {
    socket.on('room_state', (state) => set(state));
    socket.on('turn_started', (info) => {
      set({
        drawingPlayerId: info.drawingPlayerId,
        revealedHint: info.revealedHint,
        turnEndsAt: info.endsAt,
        round: info.round
      } as any);
    });
    socket.on('chat_msg', (msg) =>
      set((prev: any) => ({ messages: [...prev.messages, msg] } as any))
    );
    return () => {
      socket.off('room_state');
      socket.off('turn_started');
      socket.off('chat_msg');
    };
  }, [set]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-slate-900 bg-gradient-to-br from-indigo-100 via-sky-50 to-emerald-100">

      <main className="w-full max-w-4xl px-4">
        {roomId ? <RoomScreen /> : <Lobby />}
      </main>

      <footer className="text-xs text-slate-500 mt-10">
        Built with ❤️ using React, Tailwind & Socket.io
      </footer>
    </div>
  );
}
