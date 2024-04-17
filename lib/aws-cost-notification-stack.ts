import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

export class AwsCostNotificationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const { accountId } = new cdk.ScopedAws(this);

    const lambdaRole = new cdk.aws_iam.Role(this, "CostNotificationLambdaRole", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("lambda.amazonaws.com"),
      inlinePolicies: {
        CostExplorerPolicy: new cdk.aws_iam.PolicyDocument({
          statements: [
            // Cost Explorer の GetCostAndUsage アクションを許可
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
      entry: path.join(__dirname, "./lambda/cost-notification-lambda.ts"),
      functionName: "cost-notification-lambda",
      role: lambdaRole,
      runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(30),
      bundling: {
        // Lambda で builtin されているためバンドルから除外
        externalModules: ["@aws-sdk/*"],
        tsconfig: path.join(__dirname, "../tsconfig.json"),
      },
      environment: {
        TZ: "Asia/Tokyo",
        LINE_NOTIFY_TOKEN: process.env.LINE_NOTIFY_TOKEN || "",
      },
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

    // const alarm = new cdk.aws_cloudwatch.Alarm(this, "CostNotificationAlarm", {
    //   metric: new cdk.aws_cloudwatch.Metric({
    //     namespace: "AWS/Billing",
    //     metricName: "EstimatedCharges",
    //     dimensionsMap: {
    //       Currency: "USD",
    //     },
    //     statistic: "Maximum",
    //   }),
    //   threshold: 1,
    //   evaluationPeriods: 1,
    //   comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    //   treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    // });

    // alarm.addAlarmAction(new cdk.aws_cloudwatch_actions.LambdaAction(lambda));
  }
}
