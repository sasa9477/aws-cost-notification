import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { BudgetAlartConstruct } from "../constructs/BudgetAlartConstruct";
import { CostNotifacationConstruct } from "../constructs/CostNotificationConstruct";
import { LineNotificationConstruct } from "../constructs/LineNotificationConstruct";
import { Config } from "../config/config";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

export type AwsCostNotificationStackProps = cdk.StackProps & {
  config: Config;
  lineNotifyUrl?: string;
};

export class AwsCostNotificationStack extends cdk.Stack {
  public readonly notificationTopic: cdk.aws_sns.Topic;
  public readonly costNotifacationHandler?: NodejsFunction;
  public readonly monthlyCostBudget?: cdk.aws_budgets.CfnBudget;

  constructor(scope: Construct, id: string, props: AwsCostNotificationStackProps) {
    super(scope, id, props);

    const { config, lineNotifyUrl } = props;

    const { notificationTopic } = new LineNotificationConstruct(this, "NotificationConstruct", {
      config,
      lineNotifyUrl,
    });

    if (config.costNotificationScheduleConfig.enabled) {
      const { costNotifacationHandler } = new CostNotifacationConstruct(this, "CostNotificationConstruct", {
        config,
        notificationTopic,
      });

      this.costNotifacationHandler = costNotifacationHandler;
    }

    if (config.budgetAlartConfig.enabled) {
      const { monthlyCostBudget } = new BudgetAlartConstruct(this, "BudgetAlartConstruct", {
        config,
        notificationTopic,
      });

      this.monthlyCostBudget = monthlyCostBudget;
    }

    this.notificationTopic = notificationTopic;
  }
}
