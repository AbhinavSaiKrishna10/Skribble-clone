import { useEffect, useRef, useState } from "react";
import { socket } from "../api/socket";
import { useRoomStore } from "../store/roomStore";
import type { DrawEvent } from "../types/draw"; 

// If import path gives error, tell me — I'll fix it depending on your folder layout.

export default function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const { roomId, me, drawingPlayerId, mode } = useRoomStore();
  const isDrawingPlayer = mode === 'free-canvas' || me.id === drawingPlayerId;

  const [color, setColor] = useState("#000000");
  const [thickness, setThickness] = useState(4);
  const drawing = useRef(false);

  // -------------------------------------------------------
  // Initialize canvas context
  // -------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;

    ctxRef.current = ctx;

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  // -------------------------------------------------------
  // Resize canvas to full container
  // -------------------------------------------------------
  function resizeCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const rect = parent.getBoundingClientRect();

    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  // -------------------------------------------------------
  // Mouse Down (begin stroke)
  // -------------------------------------------------------
  function startDrawing(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawingPlayer) return;

    const { x, y } = getPos(e);
    drawing.current = true;

    ctxRef.current!.strokeStyle = color;
    ctxRef.current!.lineWidth = thickness;

    ctxRef.current!.beginPath();
    ctxRef.current!.moveTo(x, y);

    sendDrawEvent({ type: "begin", x, y, thickness, color });
  }

  // -------------------------------------------------------
  // Mouse Move (stroke)
  // -------------------------------------------------------
  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current || !isDrawingPlayer) return;

    const { x, y } = getPos(e);

    ctxRef.current!.lineTo(x, y);
    ctxRef.current!.stroke();

    sendDrawEvent({ type: "stroke", x, y });
  }

  // -------------------------------------------------------
  // Mouse Up (end stroke)
  // -------------------------------------------------------
  function endDrawing() {
    if (!drawing.current || !isDrawingPlayer) return;
    drawing.current = false;

    ctxRef.current!.closePath();
    sendDrawEvent({ type: "end" });
  }

  // -------------------------------------------------------
  // Calculate coordinates relative to canvas
  // -------------------------------------------------------
  function getPos(e: any) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();

    if (e.touches?.[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  // -------------------------------------------------------
  // Send drawing event to server
  // -------------------------------------------------------
  function sendDrawEvent(evt: DrawEvent) {
    socket.emit("draw", { roomId, events: [evt] });
  }

  // -------------------------------------------------------
  // Receive strokes from other players
  // -------------------------------------------------------
  useEffect(() => {
    socket.on("draw_update", (events: DrawEvent[]) => {
      const ctx = ctxRef.current;
      if (!ctx) return;

      events.forEach((evt) => {
        if (evt.type === "begin") {
          ctx.strokeStyle = evt.color;
          ctx.lineWidth = evt.thickness;
          ctx.beginPath();
          ctx.moveTo(evt.x, evt.y);
        } else if (evt.type === "stroke") {
          ctx.lineTo(evt.x, evt.y);
          ctx.stroke();
        } else if (evt.type === "end") {
          ctx.closePath();
        } else if (evt.type === "clear") {
          ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
        }
      });
    });

    return () => {
      socket.off("draw_update");
    };
  }, []);

  // -------------------------------------------------------
  // Clear canvas (drawer only)
  // -------------------------------------------------------
  function clearCanvas() {
    const canvas = canvasRef.current!;
    ctxRef.current!.clearRect(0, 0, canvas.width, canvas.height);

    sendDrawEvent({ type: "clear" });
  }

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------
  return (
    <div className="relative w-full h-[70vh] bg-white rounded-xl shadow overflow-hidden">

      {/* Toolbar */}
      {isDrawingPlayer && (
        <div className="absolute top-2 left-2 z-20 flex items-center gap-3 bg-white/90 p-2 rounded-lg shadow">

          {/* Color Picker */}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 cursor-pointer"
          />

          {/* Thickness */}
          <input
            type="range"
            min={2}
            max={20}
            value={thickness}
            onChange={(e) => setThickness(Number(e.target.value))}
          />

          {/* Clear Button */}
          <button
            onClick={clearCanvas}
            className="px-3 py-1 bg-red-500 text-white rounded shadow hover:bg-red-600"
          >
            Clear
          </button>
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={endDrawing}
      />
    </div>
  );
}
