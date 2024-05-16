import * as cdk from "aws-cdk-lib";
import * as dotenv from "dotenv";
import "source-map-support/register";
import { AwsCostAnomalyNotificationStack } from "./stacks/AwsCostAnomalyNotificationStack";
import { AwsCostNotificationStack } from "./stacks/AwsCostNotificationStack";
import { AwsSolutionsChecks, NagSuppressions } from "cdk-nag";
import { AwsCostNotificationTestStack } from "./stacks/AwsCostNotificationTestStack";
import { config } from "./config/config";

dotenv.config();

const app = new cdk.App();

new AwsCostNotificationStack(app, "AwsCostNotificationStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-northeast-1",
  },
  config,
  crossRegionReferences: true,
});

// // コストの異常検知だけ us-east-1 で作成する必要があるため、スタックを分ける
// const awsCostAnomalyNotificationStack = new AwsCostAnomalyNotificationStack(app, "CostAnomalyNotificationStack", {
//   env: {
//     account: process.env.CDK_DEFAULT_ACCOUNT,
//     region: "us-east-1",
//   },
//   crossRegionReferences: true,
//   costAlarmTopicArn: awsCostNotificationStack.costAlarmTopic.topicArn,
// });

// // 依存関係を追加
// awsCostAnomalyNotificationStack.addDependency(awsCostNotificationStack);

// AWS のセキュリティマトリックスのセキュリティを確認する
cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
