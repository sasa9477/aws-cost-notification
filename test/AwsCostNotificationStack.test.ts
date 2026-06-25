import * as cdk from "aws-cdk-lib";
import { Capture, Match, Template } from "aws-cdk-lib/assertions";
import type { PolicyValidationPluginReport } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";

import * as AwsCostNotification from "../src/stacks/AwsCostNotificationStack";
import { testConfig } from "./fixtures/testConfig";

describe("AWS Cost Notification Stack", () => {
  let stack: cdk.Stack;
  let template: Template;
  let nagReport: PolicyValidationPluginReport;

  beforeAll(() => {
    delete process.env.EXCHANGE_RATE_API_KEY;

    const app = new cdk.App();
    const checks = new AwsSolutionsChecks(app, { verbose: true });
    stack = new AwsCostNotification.AwsCostNotificationStack(app, "JestStack", {
      config: testConfig,
      lineChannelId: "",
      lineChannelSecret: "",
      lineUserId: "",
    });

    template = Template.fromStack(stack);
    nagReport = checks.validateScope(app);
  });

  test("スナップショットテスト", () => {
    expect(template.toJSON()).toMatchSnapshot();
  });

  describe("BudgetAlertConstruct", () => {
    test("予算アラートの設定がされている", () => {
      template.hasResourceProperties("AWS::Budgets::Budget", {
        Budget: {
          BudgetLimit: {
            Amount: testConfig.budgetAlertConfig.budgetAmount,
            Unit: "USD",
          },
          BudgetType: "COST",
          TimeUnit: "MONTHLY",
        },
        NotificationsWithSubscribers: [
          {
            Notification: {
              ComparisonOperator: "GREATER_THAN",
              NotificationType: "ACTUAL",
              Threshold: testConfig.budgetAlertConfig.actualAmountCostAlertThreshold,
              ThresholdType: "PERCENTAGE",
            },
          },
          {
            Notification: {
              ComparisonOperator: "GREATER_THAN",
              NotificationType: "FORECASTED",
              Threshold: testConfig.budgetAlertConfig.forecastedAmountCostAlertThreshold,
              ThresholdType: "PERCENTAGE",
            },
          },
        ],
      });
    });

    test("Budget から SNS トピックに Publish するためのポリシーが設定されている", () => {
      const topic = template.findResources("AWS::SNS::Topic", {
        Properties: {
          TopicName: Match.stringLikeRegexp("BudgetAlertTopic"),
        },
      });

      const topicLogicalId = Object.keys(topic)[0];

      template.hasResourceProperties("AWS::SNS::TopicPolicy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: "SNS:Publish",
              Effect: "Allow",
              Principal: {
                Service: "budgets.amazonaws.com",
              },
            }),
          ]),
        },
        Topics: Match.arrayWith([
          Match.objectLike({
            Ref: topicLogicalId,
          }),
        ]),
      });
    });
  });

  describe("CostNotificationConstruct", () => {
    test("コスト通知用ラムダ関数に Cost Explorer へのコスト使用量と予想額の取得が許可されている", () => {
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ["ce:GetCostAndUsage", "ce:GetCostForecast"],
              Effect: "Allow",
            }),
          ]),
        },
      });

      const ceGetCostAndUsagePolicies = template.findResources("AWS::IAM::Policy", {
        Properties: {
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Action: ["ce:GetCostAndUsage", "ce:GetCostForecast"],
                Effect: "Allow",
              }),
            ]),
          },
        },
      });

      const ceGetCostAndUsagePolicyLogicalId = Object.keys(ceGetCostAndUsagePolicies)[0];

      const dependsOnCapture = new Capture();

      template.hasResource("AWS::Lambda::Function", {
        Properties: {
          FunctionName: Match.stringLikeRegexp("CostScheduleNotificationHandler"),
        },
        DependsOn: dependsOnCapture,
      });

      expect(dependsOnCapture.asArray()).toContain(ceGetCostAndUsagePolicyLogicalId);
    });
  });

  describe("cdk-nag check", () => {
    test("cdk-nag の違反が無い", () => {
      if (!nagReport.success) {
        const messages = nagReport.violations.map(
          (v) =>
            `[${v.severity}] ${v.ruleName}: ${v.description}\n` +
            v.violatingResources.map((r) => `  - ${r.constructPath}`).join("\n"),
        );
        throw new Error(`cdk-nag violations found:\n${messages.join("\n\n")}`);
      }
    });
  });
});
