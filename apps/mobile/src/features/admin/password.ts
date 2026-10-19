/** No 0/O, 1/l/I: the password is read out in person or over the phone. */
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '#@!';

function pick(alphabet: string, random: () => number): string {
  return alphabet[Math.floor(random() * alphabet.length)] ?? alphabet[0]!;
}

/**
 * Uses the platform's secure random source where there is one. Hermes does not
 * always provide `crypto`, and a temporary password handed over in person is
 * changed by the admin, not kept, so the fallback is acceptable.
 */
function randomSource(): () => number {
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoApi?.getRandomValues) {
    return () => {
      const buffer = new Uint32Array(1);
      cryptoApi.getRandomValues(buffer);
      return (buffer[0] ?? 0) / 2 ** 32;
    };
  }
  return Math.random;
}

/**
 * A temporary password someone can say aloud: a word-like run of letters, a
 * symbol and four digits, e.g. "Kptwra#7310". Twelve characters, well over
 * the eight the API requires.
 */
export function generatePassword(): string {
  const random = randomSource();
  let letters = pick(LETTERS.slice(0, 24), random);
  for (let index = 0; index < 6; index += 1) letters += pick(LETTERS.slice(24), random);
  let digits = '';
  for (let index = 0; index < 4; index += 1) digits += pick(DIGITS, random);
  return `${letters}${pick(SYMBOLS, random)}${digits}`;
}
