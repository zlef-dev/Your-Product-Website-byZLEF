/** Job ticket numbers: JT-yymmdd-### (three random digits), generated in the browser. */

function randomDigits(rand: () => number): string {
  return String(Math.floor(rand() * 1000)).padStart(3, '0');
}

function cryptoRandom(): number {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const a = new Uint32Array(1);
    c.getRandomValues(a);
    return (a[0] ?? 0) / 2 ** 32;
  }
  return Math.random();
}

export function jobNumber(date: Date = new Date(), rand: () => number = cryptoRandom): string {
  const yy = String(date.getFullYear() % 100).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `JT-${yy}${mm}${dd}-${randomDigits(rand)}`;
}

export const JOB_PATTERN = /^JT-\d{6}-\d{3}$/;
