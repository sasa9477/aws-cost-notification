import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Config } from "../config/config";

export interface AwsCostAnomalyNotificationStackProps extends cdk.StackProps {
  config: Config;
  notificationTopic: cdk.aws_sns.Topic;
}

export class AwsCostAnomalyNotificationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AwsCostAnomalyNotificationStackProps) {
    super(scope, id, props);

    const { config, notificationTopic } = props;

    // 異常検知モニターを作成する
    // MonitorDimension が Serive のモニターは、AWS アカウント に 1つしか作成できないため、手動で作成している場合はエラーになる
    const monitor = new cdk.aws_ce.CfnAnomalyMonitor(this, "AnomalyServicesMonitor", {
      monitorName: "AnomalyServicesMonitor",
      monitorType: "DIMENSIONAL",
      monitorDimension: "SERVICE",
    });

    // 異常検知サブスクリプションを作成する
    new cdk.aws_ce.CfnAnomalySubscription(this, "ServicesAnomalySubscription", {
      subscriptionName: "ServicesAnomalySubscription",
      monitorArnList: [monitor.ref],
      frequency: "IMMEDIATE",
      subscribers: [
        {
          type: "SNS",
          address: notificationTopic.topicArn,
          status: "CONFIRMED",
        },
      ],
      threshold: config.costAnomalyNotificationConfig.forecastedAmountCostAlertThreshold,
    });

    // 異常検知をトピックに通知を送信するためにポリシーを追加
    notificationTopic.addToResourcePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ["SNS:Publish"],
        principals: [new cdk.aws_iam.ServicePrincipal("costalerts.amazonaws.com")],
        resources: [notificationTopic.topicArn],
      }),
    );
  }
}
