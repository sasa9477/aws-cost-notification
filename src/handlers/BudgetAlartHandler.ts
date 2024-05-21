import * as lambda from "aws-lambda";
import { getExchangeRate } from "../utils/getExchangeRate";
import { roundDigit } from "../utils/roundDigit";

export const BUDGET_ALART_HANDLER_ENV = {
  EXCHANGE_RATE_API_KEY: "EXCHANGE_RATE_API_KEY",
};

const budgetedAmountRegex = /Budgeted Amount: \$(.+)\n/;
const alertTypeRegex = /Alert Type: (FORECASTED|ACTUAL)\n/;
const alertThresholdRegex = /Alert Threshold: > \$(.+)\n/;
const forecastAmountRegex = /FORECASTED Amount: \$(.+)\n/;
const actualAmountRegex = /ACTUAL Amount: \$(.+)\n/;

export const handler: lambda.Handler<lambda.SNSEvent, string> = async (event) => {
  console.log(JSON.stringify(event));

  const exchangeRate = await getExchangeRate(process.env[BUDGET_ALART_HANDLER_ENV.EXCHANGE_RATE_API_KEY] || "");

  const snsMessage = event.Records[0].Sns.Message;

  const budgetedAmount = Number(snsMessage.match(budgetedAmountRegex)?.[1]);
  const alertType = snsMessage.match(alertTypeRegex)?.[1];
  const alertThreshold = Number(snsMessage.match(alertThresholdRegex)?.[1]);
  const forecastAmount = Number(snsMessage.match(forecastAmountRegex)?.[1]);
  const actualAmount = Number(snsMessage.match(actualAmountRegex)?.[1]);

  switch (alertType) {
    case "FORECASTED": {
      return `⚠️ AWS の予測コストが予算額を超えそうです。
予算額 : \$${budgetedAmount}${exchangeRate ? ` (¥${roundDigit(budgetedAmount * exchangeRate)})` : ""}
閾値 : \$${alertThreshold}${exchangeRate ? ` (¥${roundDigit(alertThreshold * exchangeRate)})` : ""}
予想額 : \$${forecastAmount}${exchangeRate ? ` (¥${roundDigit(forecastAmount * exchangeRate)})` : ""}`;
    }
    case "ACTUAL": {
      return `🔥 AWS の実際のコストが予算額を超えそうです。
予算額 : \$${budgetedAmount}${exchangeRate ? ` (¥${roundDigit(budgetedAmount * exchangeRate)})` : ""}
閾値 : \$${alertThreshold}${exchangeRate ? ` (¥${roundDigit(alertThreshold * exchangeRate)})` : ""}
実際のコスト : \$${actualAmount}${exchangeRate ? ` (¥${roundDigit(actualAmount * exchangeRate)})` : ""}`;
    }
    default:
      // 予期しないメッセージ
      return `ℹ️ AWS の予算額の情報です。\n${snsMessage}`;
  }
};
