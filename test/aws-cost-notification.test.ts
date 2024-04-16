import * as cdk from "aws-cdk-lib";
import { Capture, Match, Template } from "aws-cdk-lib/assertions";
import * as AwsCostNotification from "../lib/aws-cost-notification-stack";
import { Policy } from "aws-cdk-lib/aws-iam";

describe("AWS Cost Notification", () => {
  const app = new cdk.App();
  const stack = new AwsCostNotification.AwsCostNotificationStack(app, "MyTestStack");
  const template = Template.fromStack(stack);

  test("毎週月曜日の 10時 0分に起動する", () => {
    const lambda = template.findResources("AWS::Lambda::Function", {
      Properties: {
        FunctionName: "cost-notification-lambda",
      },
    });
    const lambdaLogicalId = Object.keys(lambda)[0];

    const targetsCapture = new Capture();

    template.hasResourceProperties("AWS::Events::Rule", {
      Targets: targetsCapture,
      ScheduleExpression: "cron(0 10 ? * 2 *)",
    });

    // ラムダ関数がターゲットに含まれていることを確認する
    expect(JSON.stringify(targetsCapture.asArray()[0])).toContain(lambdaLogicalId);
  });

  test("ラムダ関数のタイムアウトが 30秒かつ、メモリーサイズが 128MB である", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "cost-notification-lambda",
      Timeout: 30,
      MemorySize: 128,
    });
  });

  test("ラムダ関数に ce:GetCostAndUsage のアクションが許可されている", () => {
    const ceGetCostAndUsagePolicies = template.findResources("AWS::IAM::Policy", {
      Properties: {
        PolicyDocument: {
          Statement: [
            {
              Action: "ce:GetCostAndUsage",
              Effect: "Allow",
              Resource: "*",
            },
          ],
        },
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
