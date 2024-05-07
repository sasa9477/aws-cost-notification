import * as cdk from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import * as path from "path";
import { POST_LINE_LAMBDA_ENV } from "../functions/post-line-lambda";

export class NotificationConstruct extends Construct {
  readonly notificationTopic: cdk.aws_sns.Topic;
  readonly topicSseKey: cdk.aws_kms.Key;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const { region, accountId } = new cdk.ScopedAws(this);

    const topicLoggingRole = new cdk.aws_iam.Role(this, "NotificationTopicLoggingRole", {
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

    const topic = new cdk.aws_sns.Topic(this, "NotificationTopic", {
      topicName: `${cdk.Stack.of(this).stackName}-NotificationTopic`,
      displayName: `${cdk.Stack.of(this).stackName}-NotificationTopic`,
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
            "AWS:SourceOwner": accountId,
          },
        },
      }),
    );

    const lambdaRole = new cdk.aws_iam.Role(this, "PostLineLambdaRole", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    const lambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, "PostLineLambda", {
      role: lambdaRole,
      entry: path.join(__dirname, "../functions/post-line-lambda.ts"),
      functionName: `${cdk.Stack.of(this).stackName}-post-line-lambda`,
      bundling: {
        externalModules: ["@aws-sdk/*"],
        tsconfig: path.join(__dirname, "../../tsconfig.json"),
      },
      runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TZ: "Asia/Tokyo",
        [POST_LINE_LAMBDA_ENV.LINE_NOTIFY_URL]: process.env[POST_LINE_LAMBDA_ENV.LINE_NOTIFY_URL] || "",
        [POST_LINE_LAMBDA_ENV.LINE_NOTIFY_TOKEN]: process.env[POST_LINE_LAMBDA_ENV.LINE_NOTIFY_TOKEN] || "",
      },
      logGroup: new cdk.aws_logs.LogGroup(this, "PostLineLambdaLogGroup", {
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

    this.notificationTopic = topic;

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
