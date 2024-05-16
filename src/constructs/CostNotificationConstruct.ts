import * as cdk from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { NodeJsLambdaFunction } from "../cfn_resources/NodeJsLamdaFunction";
import { COST_NOTIFICATION_HANDLER_ENV } from "../handlers/CostNotificationHandler";

export interface CostNotifacationConstructProps {
  readonly notificationTopic: cdk.aws_sns.Topic;
}

export class CostNotifacationConstruct extends Construct {
  constructor(scope: Construct, id: string, props: CostNotifacationConstructProps) {
    super(scope, id);

    const { notificationTopic } = props;

    const { accountId } = new cdk.ScopedAws(this);

    const lambda = new NodeJsLambdaFunction(this, "CostNotificationHandler", {
      entryFileName: "CostNotificationHandler",
      environment: {
        TZ: "Asia/Tokyo",
        [COST_NOTIFICATION_HANDLER_ENV.EXCHANGE_RATE_API_KEY]:
          process.env[COST_NOTIFICATION_HANDLER_ENV.EXCHANGE_RATE_API_KEY] || "",
      },
      onSuccess: new cdk.aws_lambda_destinations.SnsDestination(notificationTopic),
      onFailure: new cdk.aws_lambda_destinations.SnsDestination(notificationTopic),
      initialPolicy: [
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
    });

    const schedulerRole = new cdk.aws_iam.Role(this, "CostNotificationSchedulerRole", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("scheduler.amazonaws.com"),
    });
    schedulerRole.addToPolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        effect: cdk.aws_iam.Effect.ALLOW,
        resources: [lambda.functionArn],
      }),
    );

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

    /**
     * cdk-nag のセキュリティ抑制設定
     */

    NagSuppressions.addResourceSuppressions(lambda, [
      {
        id: "AwsSolutions-L1",
        reason: "Lambda で Nodejs 18x を使用するため、抑制する。",
      },
    ]);

    NagSuppressions.addResourceSuppressions(
      lambda.role,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "Lambda で AWSLambdaBasicExecutionRole Managed Policy を使用するため、抑制する。",
        },
      ],
      true,
    );
  }
}
