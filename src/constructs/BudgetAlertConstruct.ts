import * as cdk from "aws-cdk-lib";

import { Construct } from "constructs";
import { NodeJsLambdaFunction } from "../cfn_resources/NodeJsLambdaFunction";
import { BUDGET_ALERT_HANDLER_ENV } from "../handlers/BudgetAlertHandler";
import { Config } from "../config/config";

export type BudgetAlertConstructProps = {
  readonly config: Config;
  readonly notificationTopic: cdk.aws_sns.Topic;
  readonly exchangeRateApiKey?: string;
};

export class BudgetAlertConstruct extends Construct {
  public readonly monthlyCostBudget: cdk.aws_budgets.CfnBudget;

  constructor(scope: Construct, id: string, props: BudgetAlertConstructProps) {
    super(scope, id);

    const { config, notificationTopic } = props;

    const topicLoggingRole = new cdk.aws_iam.Role(this, "BudgetAlertTopicLoggingRole", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("sns.amazonaws.com"),
    });

    topicLoggingRole.addToPolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:PutMetricFilter",
          "logs:PutRetentionPolicy",
        ],
        effect: cdk.aws_iam.Effect.ALLOW,
        resources: ["*"],
      }),
    );

    const topic = new cdk.aws_sns.Topic(this, "BudgetAlertTopic", {
      topicName: `${cdk.Stack.of(this).stackName}BudgetAlertTopic`,
      displayName: `${cdk.Stack.of(this).stackName}BudgetAlertTopic`,
      enforceSSL: true,
      loggingConfigs: [
        {
          protocol: cdk.aws_sns.LoggingProtocol.LAMBDA,
          successFeedbackRole: topicLoggingRole,
          failureFeedbackRole: topicLoggingRole,
          successFeedbackSampleRate: 100,
        },
      ],
    });

    // SNS トピックに対してのアクセスポリシーを設定
    topic.addToResourcePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: [
          "SNS:GetTopicAttributes",
          "SNS:SetTopicAttributes",
          "SNS:AddPermission",
          "SNS:RemovePermission",
          "SNS:DeleteTopic",
          "SNS:Subscribe",
          "SNS:ListSubscriptionsByTopic",
          "SNS:Publish",
          "SNS:Receive",
        ],
        effect: cdk.aws_iam.Effect.ALLOW,
        principals: [new cdk.aws_iam.AnyPrincipal()],
        resources: [topic.topicArn],
        conditions: {
          StringEquals: {
            "AWS:SourceOwner": cdk.Stack.of(this).account,
          },
        },
      }),
    );
    // Budget から SNS トピックに Publish するためのアクセスポリシーを設定
    topic.addToResourcePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["SNS:Publish"],
        effect: cdk.aws_iam.Effect.ALLOW,
        principals: [new cdk.aws_iam.ServicePrincipal("budgets.amazonaws.com")],
        resources: [topic.topicArn],
      }),
    );

    const lambda = new NodeJsLambdaFunction(this, "BudgetAlertHandler", {
      entryFileName: "BudgetAlertHandler",
      environment: {
        TZ: "Asia/Tokyo",
        [BUDGET_ALERT_HANDLER_ENV.EXCHANGE_RATE_API_KEY]: props.exchangeRateApiKey ?? "",
      },
      events: [new cdk.aws_lambda_event_sources.SnsEventSource(topic)],
      onSuccess: new cdk.aws_lambda_destinations.SnsDestination(notificationTopic),
      onFailure: new cdk.aws_lambda_destinations.SnsDestination(notificationTopic),
      initialPolicy: [
        // Cost Explorer のコスト使用量と 予想額の取得 を許可
        new cdk.aws_iam.PolicyStatement({
          actions: ["ce:GetCostAndUsage", "ce:GetCostForecast"],
          effect: cdk.aws_iam.Effect.ALLOW,
          resources: [
            `arn:aws:ce:us-east-1:${cdk.Stack.of(this).account}:/GetCostAndUsage`,
            `arn:aws:ce:us-east-1:${cdk.Stack.of(this).account}:/GetCostForecast`,
          ],
        }),
      ],
    });

    this.monthlyCostBudget = new cdk.aws_budgets.CfnBudget(this, "MonthlyCostBudget", {
      budget: {
        budgetName: `${cdk.Stack.of(this).stackName}-MonthlyCostBudget`,
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: {
          amount: config.budgetAlertConfig.budgetAmount,
          unit: "USD",
        },
      },
      notificationsWithSubscribers: [
        {
          // 実際のコストの通知
          notification: {
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            threshold: config.budgetAlertConfig.actualAmountCostAlertThreshold,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [
            {
              // SNS か email のみ設定可能
              subscriptionType: "SNS",
              address: topic.topicArn,
            },
          ],
        },
        {
          // 予算額の通知
          notification: {
            notificationType: "FORECASTED",
            comparisonOperator: "GREATER_THAN",
            threshold: config.budgetAlertConfig.forecastedAmountCostAlertThreshold,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [
            {
              subscriptionType: "SNS",
              address: topic.topicArn,
            },
          ],
        },
      ],
    });

    /**
     * cdk-nag のセキュリティ抑制設定
     */

    cdk.Validations.of(lambda).acknowledge({
      id: "AwsSolutions-L1",
      reason: "Lambda で Nodejs 18x を使用するため、抑制する。",
    });

    // サフィックス付きルール ID は acknowledge() では抑制できないため、addMetadata を使用する
    // https://github.com/cdklabs/cdk-nag/issues/2351
    lambda.role.node.addMetadata(cdk.Validations.ACKNOWLEDGED_RULES_METADATA_KEY, {
      "AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]":
        "Lambda で AWSLambdaBasicExecutionRole Managed Policy を使用するため、抑制する。",
    });

    cdk.Validations.of(topicLoggingRole).acknowledge({
      id: "AwsSolutions-IAM5[Resource::*]",
      reason: "SNS のログ出力には :* が必要なため、抑制する。",
    });

    cdk.Validations.of(topic).acknowledge({
      id: "AwsSolutions-SNS2",
      reason: "KMS キーを作成すると $1 / month かかるため、抑制する。",
    });
  }
}
