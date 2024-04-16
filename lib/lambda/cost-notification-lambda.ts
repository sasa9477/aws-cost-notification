import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import dayjs from "dayjs";

const client = new CostExplorerClient({ region: "us-east-1" });

export const handler = async (event: any): Promise<any> => {
  const { startDate, endDate } = getDateRange();
  const totalBilling = await getTotalBilling(startDate, endDate);
  const servicesBilling = await getServiceBillings(startDate, endDate);

  const message = `
${dayjs(startDate).format("MM/DD")} - ${dayjs(endDate).subtract(1, "day").format("MM/DD")} の請求額は ${totalBilling.totalBilling} USD です。
${servicesBilling?.map((service) => ` ・${service.serviceName}: ${service.billing} USD`).join("\n")}
`;

  const res = await postLine({ message: message.trim() });

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: res }),
  };
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
  return {
    startTime: res.ResultsByTime[0].TimePeriod?.Start,
    endTime: res.ResultsByTime[0].TimePeriod?.End,
    totalBilling: roundUpToDigit(Number(res.ResultsByTime[0].Total?.AmortizedCost?.Amount), 2),
  };
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

/**
 * Line にメッセージを送信する
 * @see https://notify-bot.line.me/doc/ja/
 */
async function postLine({ message }: { message: string }) {
  return await /** global-fetch */ fetch("https://notify-api.line.me/api/notify", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LINE_NOTIFY_TOKEN}`,
      ContentType: "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      message,
    }),
  }).then((res) => {
    return res.json();
  });
}
