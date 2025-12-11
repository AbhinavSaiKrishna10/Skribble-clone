export type DrawEvent =
  | { type: "begin"; x: number; y: number; thickness: number; color: string }
  | { type: "stroke"; x: number; y: number }
  | { type: "end" }
  | { type: "clear" };
