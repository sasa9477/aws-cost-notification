import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import * as dotenv from "dotenv";
import "source-map-support/register";
import { config } from "./config/config";
import { AwsCostAnomalyNotificationStack } from "./stacks/AwsCostAnomalyNotificationStack";
import { AwsCostNotificationStack } from "./stacks/AwsCostNotificationStack";

dotenv.config();

const app = new cdk.App();

const awsCostNotificationStack = new AwsCostNotificationStack(app, "AwsCostNotificationStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-northeast-1",
  },
  config,
  crossRegionReferences: true,
});

// MonitorDimension が Serive のモニターは、AWS アカウント に 1つしか作成できないので、コンフィグで有効になっている場合のみ作成する
// また、異常検知の通知は us-east-1 でのみサポートされているため、スタックを分ける
if (config.costAnomalyNotificationConfig.enebled) {
  const awsCostAnomalyNotificationStack = new AwsCostAnomalyNotificationStack(app, "AwsCostAnomalyNotificationStack", {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: "us-east-1",
    },
    config,
    crossRegionReferences: true,
    notificationTopic: awsCostNotificationStack.notificationTopic,
  });

  // 依存関係を追加
  awsCostAnomalyNotificationStack.addDependency(awsCostNotificationStack);
}

// AWS のセキュリティマトリックスのセキュリティを確認する
cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
