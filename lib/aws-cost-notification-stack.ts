import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

export class AwsCostNotificationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const lambdaRole = new cdk.aws_iam.Role(this, "CostNotificationLambdaRole", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("lambda.amazonaws.com"),
      inlinePolicies: {
        CostExplorerPolicy: new cdk.aws_iam.PolicyDocument({
          statements: [
            new cdk.aws_iam.PolicyStatement({
              actions: ["ce:GetCostAndUsage"],
              resources: ["*"],
            }),
          ],
        }),
      },
    });

    const lambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, "CostNotificationLambda", {
      entry: path.join(__dirname, "./lambda/cost-notification-lambda.ts"),
      functionName: "cost-notification-lambda",
      role: lambdaRole,
      runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(30),
      bundling: {
        // Lambda で builtin されているためバンドルから除外
        externalModules: ["@aws-sdk/*"],
        tsconfig: path.join(__dirname, "../tsconfig.json"),
      },
      environment: {
        TZ: "Asia/Tokyo",
        LINE_NOTIFY_TOKEN: process.env.LINE_NOTIFY_TOKEN || "",
      },
    });

    // 月曜日の 10 時に 1回実行する
    new cdk.aws_events.Rule(this, "CostNotificationEvent", {
      schedule: cdk.aws_events.Schedule.cron({
        weekDay: "2",
        hour: "10",
        minute: "0",
      }),
      targets: [new cdk.aws_events_targets.LambdaFunction(lambda)],
    });
  }
}
