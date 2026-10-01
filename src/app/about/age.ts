const BIRTH_TIME = Date.UTC(2005, 0, 30);
// Mean Gregorian year: the fractional counter measures elapsed time in years.
const YEAR_MS = 365.2425 * 24 * 60 * 60 * 1000;

export function fractionalAge(now: number) {
  return ((now - BIRTH_TIME) / YEAR_MS).toFixed(8);
}
