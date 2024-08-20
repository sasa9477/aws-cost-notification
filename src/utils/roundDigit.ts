/**
 * 指定した桁数に値を丸める
 */
export function roundDigit(value: number, digit: number = 0): number {
  return Math.round(value * Math.pow(10, digit)) / Math.pow(10, digit);
}

/**
 * 指定した桁数に値を切り上げる
 */
export function roundUpToDigit(num: number, digit: number) {
  return Math.ceil(num * Math.pow(10, digit)) / Math.pow(10, digit);
}
