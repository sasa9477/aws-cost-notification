export function roundDigit(value: number, digit: number = 2): number {
  return Math.round(value * Math.pow(10, digit)) / Math.pow(10, digit);
}
