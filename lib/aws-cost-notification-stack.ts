import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { BudgetAlartConstruct } from "./constructs/budget-alart-construct";
import { CostNotifacationConstruct } from "./constructs/cost-notification-construct";
import { NotificationConstruct } from "./constructs/notification-contruct";

export class AwsCostNotificationStack extends cdk.Stack {
  readonly costAlarmTopic: cdk.aws_sns.Topic;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const { notificationTopic } = new NotificationConstruct(this, "NotificationConstruct");

    new CostNotifacationConstruct(this, "CostNotificationConstruct", {
      notificationTopic,
    });

    new BudgetAlartConstruct(this, "BudgetAlartConstruct", {
      notificationTopic,
    });

    // // 外部から参照するために保持
    // this.costAlarmTopic = topic;
  }
}
