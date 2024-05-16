import { commonLambdaHandlerContext } from "../fixtures/commonLambdaHandlerContext";
import { handler } from "../../src/handlers/BudgetAlartHandler";

describe("budget-alart-lambda", () => {
  beforeAll(() => {
    const mockExchangeRateLatestResponse = {
      success: true,
      timestamp: 1715644000,
      base: "EUR",
      date: "2024-05-13",
      rates: { USD: 1.123456, JPY: 168.5184 },
    };

    // api.exchangeratesapi.io の API をモック化する
    jest.spyOn(global, "fetch").mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockExchangeRateLatestResponse),
      } as Response),
    );
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test("予想額の出力が正しい", async () => {
    const event = {
      Records: [
        {
          EventSource: "aws:sns",
          EventVersion: "1.0",
          EventSubscriptionArn:
            "arn:aws:sns:ap-northeast-1:123456789012:AwsCostNotificationStack-BudgetAlartTopic:7baee125-ecb5-4e2e-8efb-4f3555b2401f",
          Sns: {
            Type: "Notification",
            MessageId: "46b827e0-aada-5e65-90d9-795c0bab6976",
            TopicArn: "arn:aws:sns:ap-northeast-1:123456789012:AwsCostNotificationStack-BudgetAlartTopic",
            Subject: "AWS Budgets: AwsCostNotificationStack-MonthlyCostBudget has exceeded your alert threshold",
            Message:
              "AWS Budget Notification May 13, 2024\nAWS Account 123456789012\n\nDear AWS Customer,\n\nYou requested that we alert you when the FORECASTED Cost associated with your AwsCostNotificationStack-MonthlyCostBudget budget is greater than $0.01 for the current month. The FORECASTED Cost associated with this budget is $1.03. You can find additional details below and by accessing the AWS Budgets dashboard [1].\n\nBudget Name: AwsCostNotificationStack-MonthlyCostBudget\nBudget Type: Cost\nBudgeted Amount: $0.01\nAlert Type: FORECASTED\nAlert Threshold: > $0.01\nFORECASTED Amount: $0.5\n\n[1] https://console.aws.amazon.com/billing/home#/budgets\n",
            Timestamp: "2024-05-13T23:16:01.030Z",
            SignatureVersion: "1",
            Signature:
              "rgY5w0MfvBSh5Dlvt+QowpeMCtywfPZqfjxbwIdvu4/BjMZo9+28dVbuYaLTHgI03d1uO08A/qSAUPtSQdDb29s2iTgo9l1vYWovaQAoEvoj134pX0yRilcYQc/X8YScw0/d0Wgo1RTAyqKRv8a2nXHXjSZ9q2n3wSiSMwulAhNDkwKsnMi+N1t6CyIHXkq9qn8u+ozdCB7XnHQKoLUbS6Y8v1qvsJc8FYlAO9gd1sumamHyYEklMthMCt35CHv5sgRgZpBZWY64aecOiIof2cfMA0p2YR0tpzP0/HV9Em4BV4zZ6WLPH39MfR/felQCaVmExvO1QhlrxOmqjUmrzg==",
            SigningCertUrl:
              "https://sns.ap-northeast-1.amazonaws.com/SimpleNotificationService-60eadc530605d63b8e62a523676ef735.pem",
            UnsubscribeUrl:
              "https://sns.ap-northeast-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:ap-northeast-1:123456789012:AwsCostNotificationStack-BudgetAlartTopic:7baee125-ecb5-4e2e-8efb-4f3555b2401f",
            MessageAttributes: {},
          },
        },
      ],
    };

    const result = await handler(event, commonLambdaHandlerContext, () => {});
    expect(result).toMatch(
      `⚠️ AWS の予測コストが予算額を超えそうです。
予算額 : 0.01 USD (1.5 JPY)
閾値 : 0.01 USD (1.5 JPY)
予想額 : 0.5 USD (75 JPY)`,
    );
  });

  test("実際のコストの出力が正しい", async () => {
    const event = {
      Records: [
        {
          EventSource: "aws:sns",
          EventVersion: "1.0",
          EventSubscriptionArn:
            "arn:aws:sns:ap-northeast-1:123456789012:AwsCostNotificationStack-BudgetAlartTopic:7baee125-ecb5-4e2e-8efb-4f3555b2401f",
          Sns: {
            Type: "Notification",
            MessageId: "254078db-ff09-5f4f-8c04-266076dcf322",
            TopicArn: "arn:aws:sns:ap-northeast-1:123456789012:AwsCostNotificationStack-BudgetAlartTopic",
            Subject: "AWS Budgets: AwsCostNotificationStack-MonthlyCostBudget has exceeded your alert threshold",
            Message:
              "AWS Budget Notification May 13, 2024\nAWS Account 123456789012\n\nDear AWS Customer,\n\nYou requested that we alert you when the ACTUAL Cost associated with your AwsCostNotificationStack-MonthlyCostBudget budget is greater than $0.01 for the current month. The ACTUAL Cost associated with this budget is $0.60. You can find additional details below and by accessing the AWS Budgets dashboard [1].\n\nBudget Name: AwsCostNotificationStack-MonthlyCostBudget\nBudget Type: Cost\nBudgeted Amount: $0.01\nAlert Type: ACTUAL\nAlert Threshold: > $0.01\nACTUAL Amount: $0.5\n\n[1] https://console.aws.amazon.com/billing/home#/budgets\n",
            Timestamp: "2024-05-13T03:23:01.482Z",
            SignatureVersion: "1",
            Signature:
              "NAcqcW9O3ZTXlmpqSllGmLg1LsTPhNVAQf9K5vhG/bvS3wJ5L02WKxli5dg7zmjVut/L1A2I8PKIaCW12TUNAQyRGeMgrCk3UWE1s8qfzLpCwmmBf6CW7AUTUHmzEX1xzmnYTj7BzYBULWXYemNoNxk6kOfLFfk1cfN2WFukTURibF4StZ3B3FxK+AjOhtJMh3vZEnJrI0h1NkzZ6Ckk+K4NoPovhS3ljf32WnV7985gCHaCk2fWauvW/K935qn+Ox7iJ4y7Z1pyvPGN5oySr48kuwVJlw6PgveeyM443WybgmyT2QekY2BqSIIIjm8XQ9IgVYSo+A2rsbcvjl5ZSw==",
            SigningCertUrl:
              "https://sns.ap-northeast-1.amazonaws.com/SimpleNotificationService-60eadc530605d63b8e62a523676ef735.pem",
            UnsubscribeUrl:
              "https://sns.ap-northeast-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:ap-northeast-1:123456789012:AwsCostNotificationStack-BudgetAlartTopic:7baee125-ecb5-4e2e-8efb-4f3555b2401f",
            MessageAttributes: {},
          },
        },
      ],
    };

    const result = await handler(event, commonLambdaHandlerContext, () => {});
    expect(result).toMatch(
      `🔥 AWS の実際のコストが予算額を超えそうです。
予算額 : 0.01 USD (1.5 JPY)
閾値 : 0.01 USD (1.5 JPY)
実際のコスト : 0.5 USD (75 JPY)`,
    );
  });
});
