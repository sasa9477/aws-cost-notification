import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { BudgetAlartConstruct } from "./constructs/budget-alart-construct";
import { CostNotifacationConstruct } from "./constructs/cost-nitification-construct";
import { NagSuppressions } from "cdk-nag";

export class AwsCostNotificationStack extends cdk.Stack {
  readonly costAlarmTopic: cdk.aws_sns.Topic;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new CostNotifacationConstruct(this, "CostNotificationConstruct");

    new BudgetAlartConstruct(this, "BudgetAlartConstruct");

    // // 外部から参照するために保持
    // this.costAlarmTopic = topic;
  }
}
