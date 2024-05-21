import { CdkGraph, FilterPreset } from "@aws/pdk/cdk-graph";
import { CdkGraphDiagramPlugin, DiagramFormat } from "@aws/pdk/cdk-graph-plugin-diagram";
import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import * as dotenv from "dotenv";
import "source-map-support/register";
import { config } from "./config/config";
import { AwsCostAnomalyNotificationStack } from "./stacks/AwsCostAnomalyNotificationStack";
import { AwsCostNotificationStack } from "./stacks/AwsCostNotificationStack";

dotenv.config();

(async () => {
  const app = new cdk.App();

  const awsCostNotificationStack = new AwsCostNotificationStack(app, "AwsCostNotificationStack", {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: "ap-northeast-1",
    },
    crossRegionReferences: true,
    config,
  });

  // 異常検知の通知は us-east-1 でのみサポートされているため、スタックを分ける
  if (config.costAnomalyNotificationConfig.enebled) {
    const awsCostAnomalyNotificationStack = new AwsCostAnomalyNotificationStack(
      app,
      "AwsCostAnomalyNotificationStack",
      {
        env: {
          account: process.env.CDK_DEFAULT_ACCOUNT,
          region: "us-east-1",
        },
        crossRegionReferences: true,
        config,
        notificationTopic: awsCostNotificationStack.notificationTopic,
      },
    );

    // 依存関係を追加
    awsCostAnomalyNotificationStack.addDependency(awsCostNotificationStack);
  }

  // AWS のセキュリティマトリックスのセキュリティを確認する
  cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

  // CDK のグラフを出力する
  const graph = new CdkGraph(app, {
    plugins: [
      new CdkGraphDiagramPlugin({
        defaults: {
          format: [DiagramFormat.SVG],
        },
        diagrams: [
          {
            name: "compact.light",
            title: "AWS Cost Notification",
            theme: "light",
            filterPlan: {
              preset: FilterPreset.COMPACT,
            },
          },
          {
            name: "compact.dark",
            title: "AWS Cost Notification",
            theme: "dark",
            filterPlan: {
              preset: FilterPreset.COMPACT,
            },
          },
        ],
      }),
    ],
  });

  app.synth();

  await graph.report();
})();
