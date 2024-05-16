import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export interface AwsCostAnomalyNotificationStackProps extends cdk.StackProps {
  costAlarmTopicArn: string;
}

export class AwsCostAnomalyNotificationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AwsCostAnomalyNotificationStackProps) {
    super(scope, id, props);

    const { costAlarmTopicArn } = props;

    // monitorDimension: Serive のモニターは AWS アカウント に 1つしか作成できないので、既存の異常検知モニターを取得する
    // const resource = new cdk.custom_resources.AwsCustomResource(this, "GetParameterCustomResource", {
    //   onUpdate: {
    //     service: "CostExplorer",
    //     action: "getAnomalyMonitors",
    //     physicalResourceId: cdk.custom_resources.PhysicalResourceId.of(`${this.stackName}-GetAnomalyMonitors`),
    //     parameters: {
    //       monitorType: "DIMENSIONAL",
    //       monitorDimension: "SERVICE",
    //     },
    //   },
    //   policy: cdk.custom_resources.AwsCustomResourcePolicy.fromSdkCalls({
    //     resources: cdk.custom_resources.AwsCustomResourcePolicy.ANY_RESOURCE,
    //   }),
    // });
    // const anomalyMonitorArn = resource.getResponseField("AnomalyMonitors.0.MonitorArn");

    // 異常検知モニターを作成する
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
          address: costAlarmTopicArn,
          status: "CONFIRMED",
        },
      ],
      threshold: 1,
    });
  }
}
