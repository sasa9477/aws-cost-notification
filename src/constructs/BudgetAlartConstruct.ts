import * as cdk from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { NodeJsLambdaFunction } from "../cfn_resources/NodeJsLamdaFunction";
import { BUDGET_ALART_HANDLER_ENV } from "../handlers/BudgetAlartHandler";

export interface BudgetAlartConstructProps {
  notificationTopic: cdk.aws_sns.Topic;
}

export class BudgetAlartConstruct extends Construct {
  public readonly monthlyCostBudget: cdk.aws_budgets.CfnBudget;

  constructor(scope: Construct, id: string, props: BudgetAlartConstructProps) {
    super(scope, id);

    const { notificationTopic } = props;

    const topicLoggingRole = new cdk.aws_iam.Role(this, "BudgetAlartTopicLoggingRole", {
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

    const topic = new cdk.aws_sns.Topic(this, "BudgetAlartTopic", {
      topicName: `${cdk.Stack.of(this).stackName}-BudgetAlartTopic`,
      displayName: `${cdk.Stack.of(this).stackName}-BudgetAlartTopic`,
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
    // Budgets から SNS トピックに Publish するためのアクセスポリシーを設定
    topic.addToResourcePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["SNS:Publish"],
        effect: cdk.aws_iam.Effect.ALLOW,
        principals: [new cdk.aws_iam.ServicePrincipal("budgets.amazonaws.com")],
        resources: [topic.topicArn],
      }),
    );

    const lambda = new NodeJsLambdaFunction(this, "BudgetAlartHandler", {
      entryFileName: "BudgetAlartHandler",
      environment: {
        TZ: "Asia/Tokyo",
        [BUDGET_ALART_HANDLER_ENV.EXCHANGE_RATE_API_KEY]:
          process.env[BUDGET_ALART_HANDLER_ENV.EXCHANGE_RATE_API_KEY] || "",
      },
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
        // 4 USD 以上の場合に通知
        budgetLimit: {
          amount: 4,
          unit: "USD",
        },
        // // 自動調整予算を有効化
        // autoAdjustData: {
        //   autoAdjustType: "HISTORICAL",
        //   historicalOptions: {
        //     budgetAdjustmentPeriod: 12,
        //   },
        // },
      },
      notificationsWithSubscribers: [
        {
          // 実際のコストが 50% 以上の場合に通知
          notification: {
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            threshold: 50,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [
            {
              // SNS か　email　のみ設定可能
              subscriptionType: "SNS",
              address: topic.topicArn,
            },
          ],
        },
        {
          // 予算の 80% 以上の場合に通知
          notification: {
            notificationType: "FORECASTED",
            comparisonOperator: "GREATER_THAN",
            threshold: 80,
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

    NagSuppressions.addResourceSuppressions(
      topicLoggingRole,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "SNS のログ出力には :* が必要なため、抑制する。",
        },
      ],
      true,
    );

    NagSuppressions.addResourceSuppressions(
      topic,
      [
        {
          id: "AwsSolutions-SNS2",
          // detail: "SNSトピックにサーバー側の暗号化が有効になっていません。サーバー側の暗号化は、サブスクライバーにメッセージとして配信される機密データを追加で保護します。"
          reason: "KMS キーを作成すると $1 / month かかるため、抑制する。",
        },
      ],
      true,
    );
  }
}
