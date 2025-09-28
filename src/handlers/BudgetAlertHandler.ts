import * as lambda from "aws-lambda";
import { getExchangeRate } from "../utils/getExchangeRate";
import { roundDigit } from "../utils/roundDigit";
import { getDateRange, getForecastBilling, getTotalBilling } from "./apis/CostExplorerApi";
import dayjs from "dayjs";

export const BUDGET_ALERT_HANDLER_ENV = {
  EXCHANGE_RATE_API_KEY: "EXCHANGE_RATE_API_KEY",
};

const budgetedAmountRegex = /Budgeted Amount: \$(.+)\n/;
const alertTypeRegex = /Alert Type: (FORECASTED|ACTUAL)\n/;
const alertThresholdRegex = /Alert Threshold: > \$(.+)\n/;
const forecastAmountRegex = /FORECASTED Amount: \$(.+)\n/;
const actualAmountRegex = /ACTUAL Amount: \$(.+)\n/;

export const handler: lambda.Handler<lambda.SNSEvent, string> = async (event) => {
  console.log(JSON.stringify(event));

  const { startDate, endDate } = getDateRange();
  const totalBilling = await getTotalBilling(startDate, endDate);
  const forecastBilling = await getForecastBilling();
  const exchangeRate = await getExchangeRate(process.env[BUDGET_ALERT_HANDLER_ENV.EXCHANGE_RATE_API_KEY] || "");

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
予想額 : \$${forecastAmount}${exchangeRate ? ` (¥${roundDigit(forecastAmount * exchangeRate)})` : ""}
${dayjs(startDate).format("MM/DD")} - ${dayjs(endDate).subtract(1, "day").format("MM/DD")} の請求額は \$${roundDigit(totalBilling, 2)}${exchangeRate ? ` (¥${roundDigit(totalBilling * exchangeRate)})` : ""} です。
${forecastBilling ? `今月の予想請求額は \$${roundDigit(forecastBilling, 2)}${exchangeRate ? ` (¥${roundDigit(forecastBilling * exchangeRate)})` : ""} です。\n` : ""}`;
    }
    case "ACTUAL": {
      return `🔥 AWS の実際のコストが予算額を超えそうです。
予算額 : \$${budgetedAmount}${exchangeRate ? ` (¥${roundDigit(budgetedAmount * exchangeRate)})` : ""}
閾値 : \$${alertThreshold}${exchangeRate ? ` (¥${roundDigit(alertThreshold * exchangeRate)})` : ""}
実際のコスト : \$${actualAmount}${exchangeRate ? ` (¥${roundDigit(actualAmount * exchangeRate)})` : ""}
${dayjs(startDate).format("MM/DD")} - ${dayjs(endDate).subtract(1, "day").format("MM/DD")} の請求額は \$${roundDigit(totalBilling, 2)}${exchangeRate ? ` (¥${roundDigit(totalBilling * exchangeRate)})` : ""} です。
${forecastBilling ? `今月の予想請求額は \$${roundDigit(forecastBilling, 2)}${exchangeRate ? ` (¥${roundDigit(forecastBilling * exchangeRate)})` : ""} です。\n` : ""}`;
    }
    default:
      // 予期しないメッセージ
      return `ℹ️ AWS の予算額の情報です。\n${snsMessage}`;
  }
};
