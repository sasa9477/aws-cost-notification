import * as cdk from "aws-cdk-lib";
import { Annotations, Capture, Match, Template } from "aws-cdk-lib/assertions";
import * as AwsCostNotification from "../lib/aws-cost-notification-stack";
import * as dotenv from "dotenv";
import { AwsSolutionsChecks } from "cdk-nag";
import { formatCdkNagErrorMessage } from "./utils/formatCdkNagErrorMessage";

dotenv.config();

describe("AWS Cost Notification", () => {
  let stack: cdk.Stack;
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    stack = new AwsCostNotification.AwsCostNotificationStack(app, "MyTestStack");
    cdk.Aspects.of(stack).add(new AwsSolutionsChecks());

    template = Template.fromStack(stack);
  });

  test("cdk-nag のチェックで Errors が無い", () => {
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

  test("毎週月曜日の 10時 0分に起動する", () => {
    const lambda = template.findResources("AWS::Lambda::Function", {
      Properties: {
        FunctionName: "cost-notification-lambda",
      },
    });
    const lambdaLogicalId = Object.keys(lambda)[0];

    const targetCapture = new Capture();

    template.hasResourceProperties("AWS::Scheduler::Schedule", {
      Target: {
        Arn: targetCapture,
      },
      ScheduleExpression: "cron(0 10 ? * 2 *)",
    });

    // ラムダ関数がターゲットに含まれていることを確認する
    expect(JSON.stringify(targetCapture.asObject())).toContain(lambdaLogicalId);
  });

  test("ラムダ関数に LINE Notify のアクセストークンが設定されている", () => {
    const lineNotifyTokenCapture = new Capture();

    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "cost-notification-lambda",
      Environment: {
        Variables: {
          LINE_NOTIFY_TOKEN: lineNotifyTokenCapture,
        },
      },
    });

    expect(lineNotifyTokenCapture.asString()).not.toEqual("");
  });

  test("ラムダ関数に cost exploerer のアクションが許可されている", () => {
    const ceGetCostAndUsagePolicies = template.findResources("AWS::IAM::Role", {
      Properties: {
        Policies: [
          {
            PolicyDocument: {
              Statement: [
                {
                  Action: ["ce:GetCostAndUsage", "ce:GetCostForecast"],
                  Effect: "Allow",
                },
              ],
            },
          },
        ],
      },
    });

    expect(ceGetCostAndUsagePolicies).not.toEqual({});

    const ceGetCostAndUsagePolicyLogicalId = Object.keys(ceGetCostAndUsagePolicies)[0];

    const dependsOnCapture = new Capture();

    template.hasResource("AWS::Lambda::Function", {
      Properties: {
        FunctionName: "cost-notification-lambda",
      },
      DependsOn: dependsOnCapture,
    });

    expect(dependsOnCapture.asArray()).toContain(ceGetCostAndUsagePolicyLogicalId);
  });
});
