import * as cdk from "aws-cdk-lib";
import type { PolicyValidationPluginReport } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";

import { AwsCostAnomalyNotificationStack } from "../src/stacks/AwsCostAnomalyNotificationStack";
import { testConfig } from "./fixtures/testConfig";

describe("AwsCostAnomalyNotification Stack", () => {
  let nagReport: PolicyValidationPluginReport;

  beforeAll(() => {
    const app = new cdk.App();
    const checks = new AwsSolutionsChecks(app, { verbose: true });

    const topicStack = new cdk.Stack(app, "JestTopicStack");
    const notificationTopic = new cdk.aws_sns.Topic(topicStack, "NotificationTopic", {
      enforceSSL: true,
    });

    new AwsCostAnomalyNotificationStack(app, "JestAwsCostAnomalyNotificationStack", {
      config: testConfig,
      notificationTopic,
    });

    nagReport = checks.validateScope(app);
  });

  describe("cdk-nag check", () => {
    test("cdk-nag の違反が無い", () => {
      if (!nagReport.success) {
        const messages = nagReport.violations.map(
          (v) =>
            `[${v.severity}] ${v.ruleName}: ${v.description}\n` +
            v.violatingResources.map((r) => `  - ${r.constructPath}`).join("\n"),
        );
        throw new Error(`cdk-nag violations found:\n${messages.join("\n\n")}`);
      }
    });
  });
});
