import * as cdk from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import * as path from "path";

export class CostNotifacationConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const { accountId } = new cdk.ScopedAws(this);

    const lambdaRole = new cdk.aws_iam.Role(this, "CostNotificationLambdaRole", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("lambda.amazonaws.com"),
      inlinePolicies: {
        CostExplorerPolicy: new cdk.aws_iam.PolicyDocument({
          statements: [
            // Cost Explorer のコスト使用量と 予想額の取得 を許可
            new cdk.aws_iam.PolicyStatement({
              actions: ["ce:GetCostAndUsage", "ce:GetCostForecast"],
              effect: cdk.aws_iam.Effect.ALLOW,
              resources: [
                `arn:aws:ce:us-east-1:${accountId}:/GetCostAndUsage`,
                `arn:aws:ce:us-east-1:${accountId}:/GetCostForecast`,
              ],
            }),
          ],
        }),
      },
    });

    const lambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, "CostNotificationLambda", {
      role: lambdaRole,
      entry: path.join(__dirname, "../functions/cost-notification-lambda.ts"),
      functionName: "cost-notification-lambda",
      bundling: {
        // Lambda で builtin されているためバンドルから除外
        externalModules: ["@aws-sdk/*"],
        tsconfig: path.join(__dirname, "../../tsconfig.json"),
      },
      runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TZ: "Asia/Tokyo",
        LINE_NOTIFY_TOKEN: process.env.LINE_NOTIFY_TOKEN || "",
      },
      logGroup: new cdk.aws_logs.LogGroup(this, "CostNotificationLambdaLogGroup", {
        logGroupName: `/aws/lambda/CostNotificationStack/cost-notification-lambda`,
        removalPolicy: cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
        retention: cdk.aws_logs.RetentionDays.INFINITE,
      }),
    });

    const schedulerRole = new cdk.aws_iam.Role(this, "CostNotificationSchedulerRole", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("scheduler.amazonaws.com"),
      inlinePolicies: {
        CloudWatchPolicy: new cdk.aws_iam.PolicyDocument({
          statements: [
            new cdk.aws_iam.PolicyStatement({
              actions: ["lambda:InvokeFunction"],
              effect: cdk.aws_iam.Effect.ALLOW,
              resources: [lambda.functionArn],
            }),
          ],
        }),
      },
    });

    // 月曜日の 10 時に 1回実行する
    new cdk.aws_scheduler.CfnSchedule(this, "CostNotificationSchedule", {
      scheduleExpression: "cron(0 10 ? * 2 *)",
      scheduleExpressionTimezone: "Asia/Tokyo",
      flexibleTimeWindow: {
        mode: "OFF",
      },
      target: {
        arn: lambda.functionArn,
        roleArn: schedulerRole.roleArn,
      },
    });
  }
}
