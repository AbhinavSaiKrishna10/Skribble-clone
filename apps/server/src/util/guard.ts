export function sanitizeChat(input: string) {
  return input.trim().slice(0, 180);
}
