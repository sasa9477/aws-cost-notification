import { SynthesisMessage, SynthesisMessageLevel } from "aws-cdk-lib/cx-api";

const consoleColors = {
  black: "\u001b[30m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  blue: "\u001b[34m",
  magenta: "\u001b[35m",
  cyan: "\u001b[36m",
  white: "\u001b[37m",
  reset: "\u001b[0m",
};

export function formatCdkNagErrorMessage(messages: SynthesisMessage[]) {
  return (
    messages.reduce((result, message) => {
      const { level, id, entry } = message;
      const { data } = entry;

      switch (level) {
        case SynthesisMessageLevel.ERROR:
          result += consoleColors.red;
          break;
        case SynthesisMessageLevel.WARNING:
          result += consoleColors.yellow;
          break;
        case SynthesisMessageLevel.INFO:
          result += consoleColors.blue;
          break;
      }

      return result + `[${level} at ${id}] ${data as string}\n`;
    }, "") + consoleColors.reset
  );
}
