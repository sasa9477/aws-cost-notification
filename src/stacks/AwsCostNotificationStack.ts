import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { BudgetAlartConstruct } from "../constructs/BudgetAlartConstruct";
import { CostNotifacationConstruct } from "../constructs/CostNotificationConstruct";
import { LineNotificationConstruct } from "../constructs/LineNotificationConstruct";
import { Config } from "../config/config";

export type AwsCostNotificationStackProps = cdk.StackProps & {
  config: Config;
};

export class AwsCostNotificationStack extends cdk.Stack {
  readonly costAlarmTopic: cdk.aws_sns.Topic;
  readonly monthlyCostBudget: cdk.aws_budgets.CfnBudget;

  constructor(scope: Construct, id: string, props: AwsCostNotificationStackProps) {
    super(scope, id, props);

    const { config } = props;

    const { notificationTopic } = new LineNotificationConstruct(this, "NotificationConstruct", {
      config,
    });

    new CostNotifacationConstruct(this, "CostNotificationConstruct", {
      config,
      notificationTopic,
    });

    const { monthlyCostBudget } = new BudgetAlartConstruct(this, "BudgetAlartConstruct", {
      config,
      notificationTopic,
    });

    this.monthlyCostBudget = monthlyCostBudget;

    // // 外部から参照するために保持
    // this.costAlarmTopic = topic;
  }
}
