import * as cdk from "aws-cdk-lib";

import { Construct } from "constructs";
import { NodeJsLambdaFunction } from "../cfn_resources/NodeJsLambdaFunction";
import { Config } from "../config/config";
import { LINE_NOTIFICATION_HANDLER_ENV } from "../handlers/LineNotificationHandler";

export type LineNotificationConstructProps = {
  readonly config: Config;
  readonly lineChannelId: string;
  readonly lineChannelSecret: string;
  readonly lineUserId: string;
  readonly lineNotificationTestUrl?: string;
};

export class LineNotificationConstruct extends Construct {
  public readonly notificationTopic: cdk.aws_sns.Topic;

  constructor(scope: Construct, id: string, props: LineNotificationConstructProps) {
    super(scope, id);

    const { lineChannelId, lineChannelSecret, lineUserId, lineNotificationTestUrl } = props;

    const topicLoggingRole = new cdk.aws_iam.Role(this, "NotificationTopicLoggingRole", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("sns.amazonaws.com"),
    });
    topicLoggingRole.addToPolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
        effect: cdk.aws_iam.Effect.ALLOW,
        resources: ["*"],
      }),
    );

    const topic = new cdk.aws_sns.Topic(this, "NotificationTopic", {
      topicName: `${cdk.Stack.of(this).stackName}NotificationTopic`,
      displayName: `${cdk.Stack.of(this).stackName}NotificationTopic`,
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

    // SNS トピックのリソースポリシーを設定
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

    const lambda = new NodeJsLambdaFunction(this, "LineNotificationHandler", {
      entryFileName: "LineNotificationHandler",
      environment: {
        [LINE_NOTIFICATION_HANDLER_ENV.LINE_NOTIFICATION_TEST_URL]: lineNotificationTestUrl || "",
        [LINE_NOTIFICATION_HANDLER_ENV.LINE_CHANNEL_ID]: lineChannelId,
        [LINE_NOTIFICATION_HANDLER_ENV.LINE_CHANNEL_SECRET]: lineChannelSecret,
        [LINE_NOTIFICATION_HANDLER_ENV.LINE_USER_ID]: lineUserId,
      },
      events: [new cdk.aws_lambda_event_sources.SnsEventSource(topic)],
    });

    this.notificationTopic = topic;

    /**
     * cdk-nag のセキュリティ抑制設定
     */

    cdk.Validations.of(lambda).acknowledge({
      id: "AwsSolutions-L1",
      reason: "Lambda で指定した Nodejs のバージョンを使用するため、抑制する。",
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
