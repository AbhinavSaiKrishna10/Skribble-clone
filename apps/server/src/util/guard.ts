export function sanitizeChat(input: string) {
  return input.trim().slice(0, 180);
}

export function isCheat(input: string, currentWord?: string) {
  if (!currentWord) return false;
  const a = input.toLowerCase().replace(/[^a-z]/g, '');
  const b = currentWord.toLowerCase().replace(/[^a-z]/g, '');
  return a === b;
}
