import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { BudgetAlartConstruct } from "../constructs/BudgetAlartConstruct";
import { CostScheduleNotifacationConstruct } from "../constructs/CostScheduleNotificationConstruct";
import { LineNotificationConstruct } from "../constructs/LineNotificationConstruct";
import { Config } from "../config/config";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

export type AwsCostNotificationStackProps = cdk.StackProps & {
  config: Config;
  lineNotificationTestUrl?: string;
};

export class AwsCostNotificationStack extends cdk.Stack {
  public readonly notificationTopic: cdk.aws_sns.Topic;
  public readonly costNotifacationHandler?: NodejsFunction;
  public readonly monthlyCostBudget?: cdk.aws_budgets.CfnBudget;

  constructor(scope: Construct, id: string, props: AwsCostNotificationStackProps) {
    super(scope, id, props);

    const { config, lineNotificationTestUrl } = props;

    const { notificationTopic } = new LineNotificationConstruct(this, "LineNotificationConstruct", {
      config,
      lineNotificationTestUrl,
    });

    if (config.costScheduleNotificationConfig.enabled) {
      const { costNotifacationHandler } = new CostScheduleNotifacationConstruct(
        this,
        "CostScheduleNotificationConstruct",
        {
          config,
          notificationTopic,
        },
      );

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
