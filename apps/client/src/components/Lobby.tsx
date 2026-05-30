import { useState, useEffect } from 'react';
import { socket } from '../api/socket';
import { useRoomStore } from '../store/roomStore';

const faces = ['😀','😎','🧐','🤓','😺','🧑‍🎨','👩‍🚀','🦊'];

function AvatarFace({ face, selected, onClick }: { face: string; selected: boolean; onClick: ()=>void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className="flex items-center justify-center rounded-full transition-all duration-150"
      style={{
        width: 40,
        height: 40,
        fontSize: 18,
        lineHeight: 1,
        background: selected ? '#06b6d4' : '#f9fafb',
        border: selected ? '2px solid #0ea5e9' : '1px solid #e5e7eb',
        color: selected ? '#fff' : '#111827',
        cursor: 'pointer',
      }}
    >
      {face}
    </button>
  );
}

function AvatarPreview({ face }: { face: string }) {
  return (
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow"
      style={{
        background: 'linear-gradient(90deg,#06b6d4,#0ea5e9)',
        color: 'white'
      }}
    >
      {face}
    </div>
  );
}

export default function Lobby() {
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [face, setFace] = useState(faces[1]);
  const [loading, setLoading] = useState(false);

  const set = useRoomStore(s => s.set);
  const players = useRoomStore(s => s.players);

  useEffect(() => {
    const saved = localStorage.getItem('skribb_name');
    const savedFace = localStorage.getItem('skribb_face');
    if (saved) setName(saved);
    if (savedFace) setFace(savedFace);
  }, []);

  useEffect(() => {
    if (name) localStorage.setItem('skribb_name', name);
    localStorage.setItem('skribb_face', face);
  }, [name, face]);

  const createRoom = () => {
    if (!name.trim()) return alert('Please enter a nickname');
    setLoading(true);
    socket.emit('create_room', { name }, (res: any) => {
      setLoading(false);
      if (res?.error) return alert(res.error);
      set({ roomId: res.roomId, ...res.state, me: { id: socket.id, name } } as any);
    });
  };

  const joinRoom = () => {
    if (!name.trim()) return alert('Please enter a nickname');
    if (!room.trim()) return alert('Please enter a room ID');
    socket.emit('join_room', { roomId: room.trim(), name }, (res: any) => {
      if (res?.error) return alert(res.error);
      set({ roomId: room.trim(), ...res.state, me: { id: socket.id, name } } as any);
    });
  };

  return (
    <div style={{ position: 'relative', zIndex: 10 }}>
      {/* Heading above the card */}
      <div className="flex flex-col items-center justify-center pt-10 pb-6 text-center">
        <div className="flex items-center gap-3 mb-2">
          <div className="text-3xl">🎨</div>
          <h1 className="text-4xl md:text-5xl font-extrabold" style={{ color: '#4f46e5' }}>
            Skribbl Clone
          </h1>
        </div>
        <p className="text-gray-500 text-sm md:text-base">
          Multiplayer drawing & guessing fun
        </p>
      </div>

      {/* Lobby card */}
      <div className="min-h-[60vh] flex items-start justify-center px-4">
        <div
          className="w-full max-w-6xl rounded-2xl p-10 md:p-14 grid md:grid-cols-2 gap-10"
          style={{
            background: 'rgba(255,255,255,0.98)',
            boxShadow: '0 25px 60px rgba(2,6,23,0.12)',
            color: '#111827',
            border: '1px solid rgba(0,0,0,0.04)',
            position: 'relative',
          }}
        >
          {/* Left side */}
          <div className="flex flex-col justify-between pr-6">
            <div>
              {/* Inner heading (black text) */}
              <div className="flex items-center gap-2 mb-3">
                <div className="text-xl">🎨</div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Skribbl Clone
                </h2>
              </div>

              <p className="text-sm text-gray-600">
                Fast multiplayer drawing & guessing with real-time sync.
              </p>

              <ul className="space-y-3 text-sm text-gray-700 mt-6" style={{ maxWidth: 420 }}>
                <li>• Smooth low-latency drawing</li>
                <li>• Auto-scoring, turn timer, hints</li>
                <li>• Mobile-friendly and keyboard accessible</li>
              </ul>
            </div>

            <div className="mt-6 h-40 flex items-center justify-center">
              <div className="w-64 h-auto max-h-40 rounded-xl overflow-hidden shadow-sm border border-gray-200">
                <img src="/doodle_preview.png" alt="Doodle preview" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
              </div>
            </div>

            <div className="mt-6 text-xs text-gray-500">
              Tip: open another browser or private window to test multiplayer locally.
            </div>
          </div>

          {/* Right side */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <AvatarPreview face={face} />
              <div className="flex-1">
                <label className="text-xs text-gray-600">Nickname</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Maya, Rahul"
                  className="mt-2 w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  style={{ color: '#111827', background: '#fff' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') createRoom(); }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600">Choose avatar</label>
              <div className="flex gap-3 mt-3 flex-wrap">
                {faces.map((f) => (
                  <AvatarFace key={f} face={f} selected={face===f} onClick={()=>setFace(f)} />
                ))}
              </div>
            </div>

            <div>
              <button
                onClick={createRoom}
                disabled={loading}
                className="w-full py-3 rounded-lg text-white font-semibold shadow"
                style={{ background: 'linear-gradient(90deg,#06b6d4,#0ea5e9)' }}
              >
                {loading ? 'Creating…' : 'Create Room'}
              </button>
            </div>

            <div>
              <label className="text-xs text-gray-600">Join a room</label>
              <div className="flex gap-3 mt-3">
                <input
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="Room ID (e.g., ab12cd)"
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  style={{ color: '#111827', background: '#fff' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') joinRoom(); }}
                />
                <button
                  onClick={joinRoom}
                  className="px-5 rounded-lg bg-black text-white font-medium hover:bg-gray-800"
                >
                  Join
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Paste a room ID or create one above. Room IDs are short and shareable.
              </div>
            </div>

            <div className="mt-4 text-xs text-gray-600">
              Players in lobby:{' '}
              <span className="font-medium text-gray-900">
                {players?.length ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
