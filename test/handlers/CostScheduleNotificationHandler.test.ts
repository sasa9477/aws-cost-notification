import { CostExplorerClient, GetCostAndUsageCommand, GetCostForecastCommand } from "@aws-sdk/client-cost-explorer";
import * as lambda from "aws-lambda";
import MockDate from "mockdate";
import { commonLambdaHandlerContext } from "../fixtures/commonLambdaHandlerContext";
import { handler } from "../../src/handlers/CostScheduleNotificationHandler";
import { mockClient } from "aws-sdk-client-mock";

const commonEvent: lambda.EventBridgeEvent<"Scheduled Event", any> = {
  id: "test",
  version: "0",
  account: "123456789012",
  time: "",
  region: "ap-northeast-1",
  resources: [],
  source: "",
  "detail-type": "Scheduled Event",
  detail: {},
};

const costEcplorerMock = mockClient(CostExplorerClient);

describe("CostScheduleNotificationHandler", () => {
  beforeAll(() => {
    // dayjs の日付を固定する
    MockDate.set("2024-05-14");

    // exchangerates API のモック
    jest.spyOn(global, "fetch").mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            timestamp: 1715657284,
            base: "EUR",
            date: "2024-05-14",
            rates: {
              USD: 1.078667,
              JPY: 168.711092,
            },
          }),
      } as Response),
    );

    /**
     *  AWS SDK の CostExplorerClient をモック化する
     */

    // 合計請求額の取得のモック
    costEcplorerMock.on(GetCostAndUsageCommand).resolves({
      $metadata: {
        httpStatusCode: 200,
        requestId: "",
        attempts: 1,
        totalRetryDelay: 0,
      },
      DimensionValueAttributes: [],
      ResultsByTime: [
        {
          Estimated: true,
          Groups: [],
          TimePeriod: { End: "2024-05-14", Start: "2024-05-01" },
          Total: { AmortizedCost: { Amount: "0.6459625819", Unit: "USD" } },
        },
      ],
    });

    // サービスごとの請求額の取得のモック
    costEcplorerMock
      .on(GetCostAndUsageCommand, {
        GroupBy: [
          {
            Type: "DIMENSION",
            Key: "SERVICE",
          },
        ],
      })
      .resolves({
        $metadata: {
          httpStatusCode: 200,
          requestId: "",
          attempts: 1,
          totalRetryDelay: 0,
        },
        DimensionValueAttributes: [],
        GroupDefinitions: [{ Key: "SERVICE", Type: "DIMENSION" }],
        ResultsByTime: [
          {
            Estimated: true,
            Groups: [
              { Keys: ["AWS Amplify"], Metrics: { AmortizedCost: { Amount: "0.0010353708", Unit: "USD" } } },
              { Keys: ["AWS Cost Explorer"], Metrics: { AmortizedCost: { Amount: "0.06", Unit: "USD" } } },
              {
                Keys: ["AWS Key Management Service"],
                Metrics: { AmortizedCost: { Amount: "0", Unit: "USD" } },
              },
              { Keys: ["AWS Lambda"], Metrics: { AmortizedCost: { Amount: "0.0000462902", Unit: "USD" } } },
              { Keys: ["AWS Step Functions"], Metrics: { AmortizedCost: { Amount: "0", Unit: "USD" } } },
              {
                Keys: ["AWS Systems Manager"],
                Metrics: { AmortizedCost: { Amount: "0.000195", Unit: "USD" } },
              },
              { Keys: ["AWS X-Ray"], Metrics: { AmortizedCost: { Amount: "0", Unit: "USD" } } },
              { Keys: ["Amazon CloudFront"], Metrics: { AmortizedCost: { Amount: "0", Unit: "USD" } } },
              { Keys: ["Amazon Cognito"], Metrics: { AmortizedCost: { Amount: "0", Unit: "USD" } } },
              { Keys: ["Amazon DynamoDB"], Metrics: { AmortizedCost: { Amount: "0", Unit: "USD" } } },
              { Keys: ["Amazon Route 53"], Metrics: { AmortizedCost: { Amount: "0.5009144", Unit: "USD" } } },
              {
                Keys: ["Amazon Simple Notification Service"],
                Metrics: { AmortizedCost: { Amount: "0", Unit: "USD" } },
              },
              {
                Keys: ["Amazon Simple Storage Service"],
                Metrics: { AmortizedCost: { Amount: "0.0237715209", Unit: "USD" } },
              },
              { Keys: ["AmazonCloudWatch"], Metrics: { AmortizedCost: { Amount: "0", Unit: "USD" } } },
              { Keys: ["CloudWatch Events"], Metrics: { AmortizedCost: { Amount: "0", Unit: "USD" } } },
              { Keys: ["Tax"], Metrics: { AmortizedCost: { Amount: "0.06", Unit: "USD" } } },
            ],
            TimePeriod: { End: "2024-05-14", Start: "2024-05-01" },
            Total: {},
          },
        ],
      });

    // 予想請求額の取得のモック
    costEcplorerMock.on(GetCostForecastCommand).resolves({
      $metadata: {
        httpStatusCode: 200,
        requestId: "",
        attempts: 1,
        totalRetryDelay: 0,
      },
      ForecastResultsByTime: [
        { MeanValue: "1.11254067343557", TimePeriod: { End: "2024-06-01", Start: "2024-05-01" } },
      ],
      Total: { Amount: "1.11254067343557", Unit: "USD" },
    });
  });

  afterAll(() => {
    MockDate.reset();
    costEcplorerMock.restore();
    jest.restoreAllMocks();
  });

  test("請求額の出力が正しい", async () => {
    const result = await handler(commonEvent, commonLambdaHandlerContext, () => {});
    expect(result).toBe(
      `05/01 - 05/13 の請求額は $0.65 (¥101) です。
今月の予想請求額は $1.12 (¥175) です。

・Amazon Route 53: $0.51 (¥80)
・AWS Cost Explorer: $0.06 (¥9)
・Tax: $0.06 (¥9)
・Amazon Simple Storage Service: $0.03 (¥5)
・AWS Amplify: $0.01 (¥2)
・AWS Lambda: $0.01 (¥2)
・AWS Systems Manager: $0.01 (¥2)`,
    );
  });
});
