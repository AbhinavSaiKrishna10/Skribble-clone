const WORDS = [
  'computer','banana','mountain','river','bicycle','piano','castle','giraffe','airplane','camera',
  'cupcake','rocket','rainbow','elephant','laptop','butterfly','cactus','guitar','snowman','pizza'
];

export function pickWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

export function maskWord(word: string, level: 0|1|2) {
  const len = word.length;
  const chars = word.split('');
  const revealCount = level === 0 ? 2 : level === 1 ? Math.ceil(len/3) : Math.ceil(len/2);
  const indices = new Set<number>([0, len-1]);
  while (indices.size < revealCount) indices.add(Math.floor(Math.random()*len));
  return chars.map((c,i) => (indices.has(i) ? c : '_')).join(' ');
}
