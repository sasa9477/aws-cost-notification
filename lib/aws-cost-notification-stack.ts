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

    /**
     * cdk-nag の警告抑制
     */

    // ラムダ関数に logRention を指定すると cdk で作成される、ログリテンションポリシー を設定するための ラムダ関数に対する実行ロールへの指摘。
    // 明示的に指定していないので stack から 警告のPath を指定して抑制する。
    NagSuppressions.addResourceSuppressionsByPath(
      this,
      // テストでも使用するため、スタック名を変数で指定
      `/${this.stackName}/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/Resource`,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "ラムダの実行ロールには 推奨されている ManageMentPolicy を使用する",
          appliesTo: ["Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"],
        },
      ],
    );

    NagSuppressions.addResourceSuppressionsByPath(
      this,
      `/${this.stackName}/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/DefaultPolicy/Resource`,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "cdk で自動で作成されるラムダ関数の ログリテンションポリシー には 推奨されている ManageMentPolicy を使用する",
          appliesTo: ["Resource::*"],
        },
      ],
    );
  }
}
