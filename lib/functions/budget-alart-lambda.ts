import * as lambda from "aws-lambda";
import { postLine } from "./utils/postLine";

export const handler: lambda.SNSHandler = async (event) => {
  console.log(JSON.stringify(event));

  await Promise.all(
    event.Records.map((record) => {
      const type = record.Sns.Message.includes("FORECASTED Cost")
        ? "forecasted_cost"
        : record.Sns.Message.includes("ACTUAL Cost")
          ? "actual_cost"
          : // 予期しないメッセージが来た場合は info として扱う
            "info";

      let message;
      switch (type) {
        case "forecasted_cost":
          message = "⚠️ AWS の予測コストが予算額を超えそうです。";
          break;
        case "actual_cost":
          message = "🔥 AWS の実際のコストが予算額を超えそうです。";
          break;
        default:
          message = "ℹ️ AWS の予算額の情報です。";
      }
      message += `\n${record.Sns.Message}`;

      return postLine(message);
    }),
  );
};
