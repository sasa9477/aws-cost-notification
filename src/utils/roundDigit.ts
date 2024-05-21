export function roundDigit(value: number, digit: number = 0): number {
  return Math.round(value * Math.pow(10, digit)) / Math.pow(10, digit);
}
