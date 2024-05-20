import * as cdk from "aws-cdk-lib";
import { Annotations, Capture, Match, Template } from "aws-cdk-lib/assertions";
import { AwsSolutionsChecks } from "cdk-nag";
import * as dotenv from "dotenv";
import * as AwsCostNotification from "../src/stacks/AwsCostNotificationStack";
import { formatCdkNagErrorMessage } from "../src/utils/formatCdkNagErrorMessage";
import { Config } from "../src/config/config";

dotenv.config();

const testConfig: Config = {
  costNotificationScheduleConfig: {
    enabled: true,
    scheduleExpression: "cron(0 10 ? * 2 *)",
  },
  budgetAlartConfig: {
    enabled: true,
    budgetAmount: 100,
    actualAmountCostAlertThreshold: 50,
    forecastedAmountCostAlertThreshold: 50,
  },
  costAnomalyNotificationConfig: {
    enebled: false,
    forecastedAmountCostAlertThreshold: 1,
  },
};

describe("AWS Cost Notification Stack", () => {
  let stack: cdk.Stack;
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    cdk.Aspects.of(app).add(new AwsSolutionsChecks());
    stack = new AwsCostNotification.AwsCostNotificationStack(app, "JestStack", {
      config: testConfig,
    });

    template = Template.fromStack(stack);
  });

  describe("BudgetAlartConstruct", () => {
    test("予算アラートの設定がされている", () => {
      template.hasResourceProperties("AWS::Budgets::Budget", {
        Budget: {
          BudgetLimit: {
            Amount: testConfig.budgetAlartConfig.budgetAmount,
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
              Threshold: testConfig.budgetAlartConfig.actualAmountCostAlertThreshold,
              ThresholdType: "PERCENTAGE",
            },
          },
          {
            Notification: {
              ComparisonOperator: "GREATER_THAN",
              NotificationType: "FORECASTED",
              Threshold: testConfig.budgetAlartConfig.forecastedAmountCostAlertThreshold,
              ThresholdType: "PERCENTAGE",
            },
          },
        ],
      });
    });

    test("Budget から SNS トピックに Publish するためのポリシーが設定されている", () => {
      const topic = template.findResources("AWS::SNS::Topic", {
        Properties: {
          TopicName: Match.stringLikeRegexp("BudgetAlartTopic"),
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
    test("コスト通知用ラムダ関数に Cost Exploerer へのコスト使用量と予想額の取得が許可されている", () => {
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
          FunctionName: Match.stringLikeRegexp("CostNotificationHandler"),
        },
        DependsOn: dependsOnCapture,
      });

      expect(dependsOnCapture.asArray()).toContain(ceGetCostAndUsagePolicyLogicalId);
    });
  });

  describe("LineNotificationConstruct", () => {
    test("LINE 通知用ラムダ関数に LINE Notify のアクセストークンが設定されている", () => {
      const lineNotifyTokenCapture = new Capture();

      template.hasResourceProperties("AWS::Lambda::Function", {
        FunctionName: Match.stringLikeRegexp("LineNotificationHandler"),
        Environment: {
          Variables: {
            LINE_NOTIFY_TOKEN: lineNotifyTokenCapture,
          },
        },
      });

      expect(lineNotifyTokenCapture.asString()).not.toEqual("");
    });
  });

  describe("cdk-nag check", () => {
    test("cdk-nag のチェックで Error が無い", () => {
      const errors = Annotations.fromStack(stack).findError("*", Match.stringLikeRegexp("AwsSolutions-.*"));

      try {
        expect(errors).toHaveLength(0);
      } catch (error) {
        throw new Error(formatCdkNagErrorMessage(errors));
      }
    });

    test("cdk-nag のセキュリティチェックで warnning が無い", () => {
      const warnings = Annotations.fromStack(stack).findWarning("*", Match.stringLikeRegexp("AwsSolutions-.*"));

      try {
        expect(warnings).toHaveLength(0);
      } catch (error) {
        throw new Error(formatCdkNagErrorMessage(warnings));
      }
    });
  });
});
