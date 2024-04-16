import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AwsCostNotificationStack } from "../lib/aws-cost-notification-stack";
import * as dotenv from "dotenv";

dotenv.config();

const app = new cdk.App();
new AwsCostNotificationStack(app, "AwsCostNotificationStack", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "ap-northeast-1" },
});

app.synth();
