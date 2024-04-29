import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { BudgetAlartConstruct } from "../constructs/budget-alart-construct";
import { CostNotifacationConstruct } from "../constructs/cost-notification-construct";
import { NotificationConstruct } from "../constructs/notification-contruct";

export class AwsCostNotificationStack extends cdk.Stack {
  readonly costAlarmTopic: cdk.aws_sns.Topic;
  readonly monthlyCostBudget: cdk.aws_budgets.CfnBudget;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const { notificationTopic } = new NotificationConstruct(this, "NotificationConstruct");

    new CostNotifacationConstruct(this, "CostNotificationConstruct", {
      notificationTopic,
    });

    const { monthlyCostBudget } = new BudgetAlartConstruct(this, "BudgetAlartConstruct", {
      notificationTopic,
    });

    this.monthlyCostBudget = monthlyCostBudget;

    // // 外部から参照するために保持
    // this.costAlarmTopic = topic;
  }
}
