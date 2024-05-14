import * as cdk from "aws-cdk-lib";
import * as dotenv from "dotenv";
import "source-map-support/register";
import { AwsCostAnomalyNotificationStack } from "../lib/stacks/aws-cost-anomaly-notification-stack";
import { AwsCostNotificationStack } from "../lib/stacks/aws-cost-notification-stack";
import { AwsSolutionsChecks } from "cdk-nag";
import { AwsCostNotificationTestStack } from "../lib/stacks/aws-cost-notification-test-stack";

dotenv.config();

const app = new cdk.App();

new AwsCostNotificationStack(app, "AwsCostNotificationStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-northeast-1",
  },
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
