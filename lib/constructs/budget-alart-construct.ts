import * as cdk from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import * as path from "path";
import { BUDGET_ALART_LAMBDA_ENV } from "../functions/budget-alart-lambda";

export class BudgetAlartConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const { region, accountId } = new cdk.ScopedAws(this);

    const topicSseKey = new cdk.aws_kms.Key(this, "BudgetAlartTopicKey", {
      alias: "BudgetAlartTopicKey",
      description: "BudgetAlartTopicKey",
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // SNS Topic に Publish するための KMS の復号化ポリシーを許可
    topicSseKey.addToResourcePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["kms:Decrypt", "kms:GenerateDataKey"],
        effect: cdk.aws_iam.Effect.ALLOW,
        principals: [new cdk.aws_iam.ServicePrincipal("budgets.amazonaws.com")],
        resources: ["*"],
      }),
    );

    const topicLoggingRole = new cdk.aws_iam.Role(this, "BudgetAlartTopicLoggingRole", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("sns.amazonaws.com"),
      inlinePolicies: {
        CloudWatchWritePolicy: new cdk.aws_iam.PolicyDocument({
          statements: [
            new cdk.aws_iam.PolicyStatement({
              actions: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:PutMetricFilter",
                "logs:PutRetentionPolicy",
              ],
              effect: cdk.aws_iam.Effect.ALLOW,
              resources: [`arn:aws:logs:${region}:${accountId}:log-group:*`],
            }),
          ],
        }),
      },
    });

    const topic = new cdk.aws_sns.Topic(this, "BudgetAlartTopic", {
      topicName: "BudgetAlartTopic",
      displayName: "BudgetAlartTopic",
      // SNS トピックのサーバー側暗号化 (SSE) を有効
      masterKey: topicSseKey,
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

    const lambdaRole = new cdk.aws_iam.Role(this, "BudgetAlartLambdaRole", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    const functionName = "budget-alart-lambda";

    const lambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, "BudgetAlartLambda", {
      role: lambdaRole,
      entry: path.join(__dirname, "../functions/budget-alart-lambda.ts"),
      functionName,
      bundling: {
        externalModules: ["@aws-sdk/*"],
        tsconfig: path.join(__dirname, "../../tsconfig.json"),
      },
      runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TZ: "Asia/Tokyo",
        [BUDGET_ALART_LAMBDA_ENV.LINE_NOTIFY_TOKEN]: process.env[BUDGET_ALART_LAMBDA_ENV.LINE_NOTIFY_TOKEN] || "",
      },
      logGroup: new cdk.aws_logs.LogGroup(this, "BudgetAlartLambdaLogGroup", {
        logGroupName: `/aws/lambda/${cdk.Stack.of(this).stackName}/${functionName}`,
        removalPolicy: cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
        retention: cdk.aws_logs.RetentionDays.INFINITE,
      }),
      events: [new cdk.aws_lambda_event_sources.SnsEventSource(topic)],
    });

    lambdaRole.addToPolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
        effect: cdk.aws_iam.Effect.ALLOW,
        resources: [lambda.logGroup.logGroupArn],
      }),
    );

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

    /**
     * cdk-nag のセキュリティ抑制設定
     */

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
  }
}