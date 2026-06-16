// Generates a strong password matching app rules:
// min 12 chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 symbol.
export function generateStrongPassword(length = 14): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = upper + lower + digits + symbols;

  const rand = (set: string) => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return set[arr[0] % set.length];
  };

  const chars = [rand(upper), rand(lower), rand(digits), rand(symbols)];
  for (let i = chars.length; i < length; i++) chars.push(rand(all));

  // Shuffle (Fisher-Yates with crypto)
  for (let i = chars.length - 1; i > 0; i--) {
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const j = r[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
