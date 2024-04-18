import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

export class BudgetAlartConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const { accountId } = new cdk.ScopedAws(this);

    const topicLoggingRole = new cdk.aws_iam.Role(this, "BudgetAlartTopicLoggingRole", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("sns.amazonaws.com"),
      managedPolicies: [cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchLogsFullAccess")],
    });

    const topic = new cdk.aws_sns.Topic(this, "BudgetAlartTopic", {
      topicName: "BudgetAlartTopic",
      displayName: "BudgetAlartTopic",
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
            "AWS:SourceOwner": accountId,
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

    // デッドレターキューを作成
    // TODO: Lambda が失敗した場合に通知を行うためのデッドレターキューの検証（ role に sns:publish の許可ポリシーが必要かも ）
    const deadLetterQueue = new cdk.aws_sqs.Queue(this, "BudgetAlartDeadLetterQueue", {
      queueName: "BudgetAlartDeadLetterQueue",
    });

    new cdk.aws_lambda_nodejs.NodejsFunction(this, "BudgetAlartLambda", {
      entry: path.join(__dirname, "../lambda/budget-alart-lambda.ts"),
      functionName: "budget-alart-lambda",
      runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(30),
      bundling: {
        // Lambda で builtin されているためバンドルから除外
        externalModules: ["@aws-sdk/*"],
        tsconfig: path.join(__dirname, "../../tsconfig.json"),
      },
      environment: {
        TZ: "Asia/Tokyo",
        LINE_NOTIFY_TOKEN: process.env.LINE_NOTIFY_TOKEN || "",
      },
      events: [
        new cdk.aws_lambda_event_sources.SnsEventSource(topic, {
          deadLetterQueue: deadLetterQueue,
        }),
      ],
    });

    new cdk.aws_budgets.CfnBudget(this, "MonthlyCostBudget", {
      budget: {
        budgetName: "MonthlyCostBudget",
        budgetType: "COST",
        timeUnit: "MONTHLY",
        // 5 USD 以上の場合に通知
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
  }
}
