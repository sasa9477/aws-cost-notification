import { CostExplorerClient, GetCostAndUsageCommand, GetCostForecastCommand } from "@aws-sdk/client-cost-explorer";
import dayjs from "dayjs";
import * as lambda from "aws-lambda";
import { roundDigit } from "../utils/roundDigit";
import { getExchangeRate } from "../utils/getExchangeRate";

export const COST_NOTIFICATION_LAMBDA_ENV = {
  EXCHANGE_RATE_API_KEY: "EXCHANGE_RATE_API_KEY",
};

const client = new CostExplorerClient({ region: "us-east-1" });

export const handler: lambda.EventBridgeHandler<"Scheduled Event", any, string> = async () => {
  const { startDate, endDate } = getDateRange();
  const totalBilling = await getTotalBilling(startDate, endDate);
  const forecastBilling = await getForecastBilling();
  const serviceBillings = await getServiceBillings(startDate, endDate);
  const exchangeRate = await getExchangeRate(process.env[COST_NOTIFICATION_LAMBDA_ENV.EXCHANGE_RATE_API_KEY] || "");

  const message = `
${dayjs(startDate).format("MM/DD")} - ${dayjs(endDate).subtract(1, "day").format("MM/DD")} の請求額は ${totalBilling} USD です。${forecastBilling ? `\n今月の予想請求額は ${forecastBilling} USD です。\n` : ""}
${serviceBillings?.map((service) => ` ・${service.serviceName}: ${roundDigit(service.billing)} USD ${exchangeRate ? `${roundDigit(service.billing * exchangeRate)} JPY` : ""}`).join("\n")}
`.trim();

  return message;
};

/**
 * 取得する期間の開始日と終了日を取得する
 */
function getDateRange() {
  const begginningOfMonth = dayjs().startOf("month").format("YYYY-MM-DD");
  const today = dayjs().format("YYYY-MM-DD");

  // 今日が月初めの場合、先月の月初めから今日までの期間を取得する
  if (today === begginningOfMonth) {
    const begginningOfLastMonth = dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD");
    return {
      startDate: begginningOfLastMonth,
      endDate: today,
    };
  }
  return {
    startDate: begginningOfMonth,
    endDate: today,
  };
}

/**
 * 合計請求額を取得する
 */
async function getTotalBilling(startDate: string, endDate: string) {
  const res = await client.send(
    new GetCostAndUsageCommand({
      TimePeriod: {
        Start: startDate,
        End: endDate,
      },
      Granularity: "MONTHLY",
      Metrics: ["AmortizedCost"],
    }),
  );

  if (!res.ResultsByTime || !res.ResultsByTime[0]) {
    throw new Error("No billing data found");
  }
  return roundUpToDigit(Number(res.ResultsByTime[0].Total?.AmortizedCost?.Amount), 2);
}

/**
 * 予想請求額を取得する
 */
async function getForecastBilling() {
  const _startDate = dayjs().add(1, "day").format("YYYY-MM-DD");
  const _endDate = dayjs().add(1, "month").startOf("month").format("YYYY-MM-DD");

  // 開始日と終了日が同じ場合は、月末になるので予想請求額を取得しない
  if (_startDate === _endDate) {
    return undefined;
  }

  const res = await client.send(
    new GetCostForecastCommand({
      TimePeriod: {
        Start: _startDate,
        End: _endDate,
      },
      Granularity: "MONTHLY",
      Metric: "AMORTIZED_COST",
    }),
  );

  return roundUpToDigit(Number(res.Total?.Amount), 2);
}

/**
 * サービスごとの請求額を取得する
 */
async function getServiceBillings(startDate: string, endDate: string) {
  const res = await client.send(
    new GetCostAndUsageCommand({
      TimePeriod: {
        Start: startDate,
        End: endDate,
      },
      Granularity: "MONTHLY",
      Metrics: ["AmortizedCost"],
      GroupBy: [
        {
          Type: "DIMENSION",
          Key: "SERVICE",
        },
      ],
    }),
  );

  if (!res.ResultsByTime || !res.ResultsByTime[0]) {
    throw new Error("No billing data found");
  }

  return res.ResultsByTime[0].Groups?.map((group) => ({
    serviceName: group.Keys?.[0],
    billing: roundUpToDigit(Number(group.Metrics?.AmortizedCost?.Amount), 2),
  }))
    .filter(({ billing }) => billing > 0)
    .sort((a, b) => b.billing - a.billing);
}

/**
 * 指定した桁数に値を切り上げる
 */
function roundUpToDigit(num: number, digit: number) {
  return Math.ceil(num * Math.pow(10, digit)) / Math.pow(10, digit);
}
