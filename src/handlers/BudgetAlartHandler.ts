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
予算額 : ${budgetedAmount} USD${exchangeRate ? ` (${roundDigit(budgetedAmount * exchangeRate)} JPY)` : ""}
閾値 : ${alertThreshold} USD${exchangeRate ? ` (${roundDigit(alertThreshold * exchangeRate)} JPY)` : ""}
予想額 : ${forecastAmount} USD${exchangeRate ? ` (${roundDigit(forecastAmount * exchangeRate)} JPY)` : ""}`;
      break;
    }
    case "ACTUAL": {
      return `🔥 AWS の実際のコストが予算額を超えそうです。
予算額 : ${budgetedAmount} USD${exchangeRate ? ` (${roundDigit(budgetedAmount * exchangeRate)} JPY)` : ""}
閾値 : ${alertThreshold} USD${exchangeRate ? ` (${roundDigit(alertThreshold * exchangeRate)} JPY)` : ""}
実際のコスト : ${actualAmount} USD${exchangeRate ? ` (${roundDigit(actualAmount * exchangeRate)} JPY)` : ""}`;
      break;
    }
    default:
      // 予期しないメッセージ
      return `ℹ️ AWS の予算額の情報です。\n${snsMessage}`;
  }
};
