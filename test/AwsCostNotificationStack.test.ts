import * as cdk from "aws-cdk-lib";
import { Annotations, Capture, Match, Template } from "aws-cdk-lib/assertions";
import { AwsSolutionsChecks } from "cdk-nag";
import * as dotenv from "dotenv";
import * as AwsCostNotification from "../src/stacks/AwsCostNotificationStack";
import { formatCdkNagErrorMessage } from "../src/utils/formatCdkNagErrorMessage";
import { config } from "../src/config/config";

dotenv.config();

const testConfig = {
  constNotificationScheduleConfig: {
    // 毎週月曜日の 10:00 に実行
    scheduleExpression: "cron(0 10 ? * 2 *)",
  },
  budgetAlartConfig: {
    // 予算額は 4 USD
    budgetAmount: 4,
    // 実際のコストが 50% 以上の場合に通知
    actualAmountCostAlertThreshold: 50,
    // 予想額の 80% 以上の場合に通知
    forecastedAmountCostAlertThreshold: 80,
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

  test("コスト通知のスケジュールが設定されている", () => {
    const lambda = template.findResources("AWS::Lambda::Function", {
      Properties: {
        FunctionName: `${cdk.Stack.of(stack).stackName}CostNotificationHandler`,
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

  // test("post-line-lambda に LINE Notify のアクセストークンが設定されている", () => {
  //   const lineNotifyTokenCapture = new Capture();

  //   template.hasResourceProperties("AWS::Lambda::Function", {
  //     FunctionName: "post-line-lambda",
  //     Environment: {
  //       Variables: {
  //         LINE_NOTIFY_TOKEN: lineNotifyTokenCapture,
  //       },
  //     },
  //   });

  //   expect(lineNotifyTokenCapture.asString()).not.toEqual("");
  // });

  // test("ラムダ関数に Cost Exploerer へのコスト使用量と予想額の取得が許可されている", () => {
  //   const ceGetCostAndUsagePolicies = template.findResources("AWS::IAM::Role", {
  //     Properties: {
  //       Policies: [
  //         {
  //           PolicyDocument: {
  //             Statement: [
  //               {
  //                 Action: ["ce:GetCostAndUsage", "ce:GetCostForecast"],
  //                 Effect: "Allow",
  //               },
  //             ],
  //           },
  //         },
  //       ],
  //     },
  //   });

  //   const ceGetCostAndUsagePolicyLogicalId = Object.keys(ceGetCostAndUsagePolicies)[0];

  //   const dependsOnCapture = new Capture();

  //   template.hasMapping;

  //   template.hasResource("AWS::Lambda::Function", {
  //     Properties: {
  //       FunctionName: "cost-notification-lambda",
  //     },
  //     DependsOn: dependsOnCapture,
  //   });

  //   expect(dependsOnCapture.asArray()).toContain(ceGetCostAndUsagePolicyLogicalId);
  // });
});
