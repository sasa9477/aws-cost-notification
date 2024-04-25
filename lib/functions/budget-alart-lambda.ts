import * as lambda from "aws-lambda";

export const handler: lambda.Handler<lambda.SNSEvent, string> = async (event) => {
  console.log(JSON.stringify(event));

  const snsMessage = event.Records[0].Sns.Message;

  const type = snsMessage.includes("FORECASTED Cost")
    ? "forecasted_cost"
    : snsMessage.includes("ACTUAL Cost")
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
  message += `\n${snsMessage}`;

  return message;
};
