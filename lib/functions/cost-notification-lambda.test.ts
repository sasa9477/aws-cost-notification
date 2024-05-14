import { CostExplorer, GetCostAndUsageCommand, GetCostForecastCommand } from "@aws-sdk/client-cost-explorer";
import { commonLambdaHandlerContext } from "../../test/fixtures/common-lambda-handler-context";
import { handler } from "./cost-notification-lambda";
import * as lambda from "aws-lambda";

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

describe("cost-notification-lambda", () => {
  beforeAll(() => {
    // api.exchangeratesapi.io の API をモック化する
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

    jest.mock("@aws-sdk/client-cost-explorer", () => {
      class StubCostExplorerClient {
        async send(command: unknown, ...args: unknown[]) {
          if (command instanceof GetCostAndUsageCommand) {
            if (
              command.input.GroupBy &&
              command.input.GroupBy[0].Type === "DIMENSION" &&
              command.input.GroupBy[0].Key === "SERVICE"
            ) {
              return {
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
              };
            }
            return {
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
            };
          }

          if (command instanceof GetCostForecastCommand) {
            return {
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
            };
          }

          return {};
        }
      }
      return {
        // CostExplorerClient 以外は実際のモジュールを使用する
        ...jest.requireActual("@aws-sdk/@aws-sdk/client-cost-explorer"),
        CostExplorerClient: StubCostExplorerClient,
      };
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test("請求額の出力が正しい", async () => {
    const result = await handler(commonEvent, commonLambdaHandlerContext, () => {});
    expect(result).toMatch(
      `05/01 - 05/13 の請求額は 0.65 USD です。
今月の予想請求額は 1.12 USD です。

 ・Amazon Route 53: 0.51 USD 79.77 JPY
 ・AWS Cost Explorer: 0.06 USD 9.38 JPY
 ・Tax: 0.06 USD 9.38 JPY
 ・Amazon Simple Storage Service: 0.03 USD 4.69 JPY
 ・AWS Amplify: 0.01 USD 1.56 JPY
 ・AWS Lambda: 0.01 USD 1.56 JPY
 ・AWS Systems Manager: 0.01 USD 1.56 JPY`,
    );
  });
});
