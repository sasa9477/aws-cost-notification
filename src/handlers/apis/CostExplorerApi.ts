import { CostExplorerClient, GetCostAndUsageCommand, GetCostForecastCommand } from "@aws-sdk/client-cost-explorer";
import dayjs from "dayjs";
import { roundUpToDigit } from "../../utils/roundDigit";

const client = new CostExplorerClient({ region: "us-east-1" });

/**
 * 取得する期間の開始日と終了日を取得する
 */
export function getDateRange() {
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
export async function getTotalBilling(startDate: string, endDate: string) {
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
export async function getForecastBilling() {
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
export async function getServiceBillings(startDate: string, endDate: string) {
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
