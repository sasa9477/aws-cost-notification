import * as lambda from "aws-lambda";
import dayjs from "dayjs";
import { getExchangeRate } from "../utils/getExchangeRate";
import { roundDigit } from "../utils/roundDigit";
import { getDateRange, getForecastBilling, getServiceBillings, getTotalBilling } from "./apis/CostExplorerApi";

export const COST_SCHEDULE_NOTIFICATION_HANDLER_ENV = {
  EXCHANGE_RATE_API_KEY: "EXCHANGE_RATE_API_KEY",
};

export const handler: lambda.EventBridgeHandler<"Scheduled Event", any, string> = async () => {
  const { startDate, endDate } = getDateRange();
  const totalBilling = await getTotalBilling(startDate, endDate);
  const forecastBilling = await getForecastBilling();
  const serviceBillings = await getServiceBillings(startDate, endDate);
  const exchangeRate = await getExchangeRate(
    process.env[COST_SCHEDULE_NOTIFICATION_HANDLER_ENV.EXCHANGE_RATE_API_KEY] || "",
  );

  const message = `
${dayjs(startDate).format("MM/DD")} - ${dayjs(endDate).subtract(1, "day").format("MM/DD")} の請求額は \$${roundDigit(totalBilling, 2)}${exchangeRate ? ` (¥${roundDigit(totalBilling * exchangeRate)})` : ""} です。
${forecastBilling ? `今月の予想請求額は \$${roundDigit(forecastBilling, 2)}${exchangeRate ? ` (¥${roundDigit(forecastBilling * exchangeRate)})` : ""} です。\n` : ""}
${serviceBillings?.map((service) => `・${service.serviceName}: \$${roundDigit(service.billing, 2)}${exchangeRate ? ` (¥${roundDigit(service.billing * exchangeRate)})` : ""}`).join("\n")}
`.trim();

  return message;
};
