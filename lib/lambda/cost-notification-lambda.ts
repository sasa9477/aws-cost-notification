import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import dayjs from "dayjs";

const client = new CostExplorerClient({ region: "us-east-1" });

export const handler = async (event: any): Promise<any> => {
  const { startDate, endDate } = await getDateRange();
  const totalBilling = await getTotalBilling({ startDate, endDate });
  const servicesBilling = await getServiceBillings({ startDate, endDate });

  const message = `
期間: ${dayjs(totalBilling.startTime).format("YYYY/MM/DD")} - ${dayjs(totalBilling.endTime).format("YYYY/MM/DD")}
合計請求額: ${totalBilling.totalBilling} USD
サービス別請求額:
${servicesBilling?.map((service) => `${service.serviceName}: ${service.billing} USD`).join("\n")}
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

async function getDateRange() {
  const begginningOfMonth = dayjs().startOf("month").format("YYYY-MM-DD");
  const today = dayjs().format("YYYY-MM-DD");

  // 今日が月初めの場合、先月の月初めから今日までの期間を取得
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

async function getTotalBilling({ startDate, endDate }: { startDate: string; endDate: string }) {
  const res = await client.send(
    new GetCostAndUsageCommand({
      TimePeriod: {
        Start: startDate,
        End: endDate,
      },
      Granularity: "MONTHLY",
      Metrics: ["AmortizedCost"],
      // Metrics: ["BlendedCost"],
    }),
  );

  if (!res.ResultsByTime || !res.ResultsByTime[0]) {
    throw new Error("No billing data found");
  }
  return {
    startTime: res.ResultsByTime[0].TimePeriod?.Start,
    endTime: res.ResultsByTime[0].TimePeriod?.End,
    totalBilling: res.ResultsByTime[0].Total?.AmortizedCost?.Amount,
  };
}

async function getServiceBillings({ startDate, endDate }: { startDate: string; endDate: string }) {
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
    billing: group.Metrics?.AmortizedCost?.Amount,
  }));
}

async function postLine({ message }: { message: string }) {
  // const totalBilling = await getTotalBilling();
  // const servicesBilling = await getServicesBillings();
  // console.log(totalBilling);
  // console.log(servicesBilling);

  // https://notify-bot.line.me/doc/ja/
  return await fetch("https://notify-api.line.me/api/notify", {
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
