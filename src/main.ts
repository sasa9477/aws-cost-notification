import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import * as dotenv from "dotenv";
import "source-map-support/register";
import { config } from "./config/config";
import { AwsCostAnomalyNotificationStack } from "./stacks/AwsCostAnomalyNotificationStack";
import { AwsCostNotificationStack } from "./stacks/AwsCostNotificationStack";
import { CustomResourceLoggingConfigAspect } from "./aspects/CustomResourceLoggingConfigAspect";
import * as valibot from "valibot";

dotenv.config();

const env = valibot.parse(
  valibot.object({
    CDK_DEFAULT_ACCOUNT: valibot.string(),
    LINE_CHANNEL_ID: valibot.string(),
    LINE_CHANNEL_SECRET: valibot.string(),
    LINE_USER_ID: valibot.string(),
    EXCHANGE_RATE_API_KEY: valibot.optional(valibot.string()),
  }),
  process.env,
);

const app = new cdk.App();

const awsCostNotificationStack = new AwsCostNotificationStack(app, "AwsCostNotificationStack", {
  env: {
    account: env.CDK_DEFAULT_ACCOUNT,
    region: "ap-northeast-1",
  },
  crossRegionReferences: true,
  config,
  lineChannelId: env.LINE_CHANNEL_ID,
  lineChannelSecret: env.LINE_CHANNEL_SECRET,
  lineUserId: env.LINE_USER_ID,
  exchangeRateApiKey: env.EXCHANGE_RATE_API_KEY,
});

// 異常検知の通知は us-east-1 でのみサポートされているため、スタックを分ける
if (config.costAnomalyNotificationConfig.enabled) {
  const awsCostAnomalyNotificationStack = new AwsCostAnomalyNotificationStack(app, "AwsCostAnomalyNotificationStack", {
    env: {
      account: env.CDK_DEFAULT_ACCOUNT,
      region: "us-east-1",
    },
    crossRegionReferences: true,
    config,
    notificationTopic: awsCostNotificationStack.notificationTopic,
  });

  // 依存関係を追加
  awsCostAnomalyNotificationStack.addDependency(awsCostNotificationStack);
}

// Custom:: で始まる CDK で暗黙的に作成される Custom Resource のロググループ保持期間を変更する
cdk.Aspects.of(app).add(new CustomResourceLoggingConfigAspect());

// AWS のセキュリティマトリックスのセキュリティを確認する
cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
