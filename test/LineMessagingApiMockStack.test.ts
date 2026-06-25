import * as cdk from "aws-cdk-lib";
import type { PolicyValidationPluginReport } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";

import { LineMessagingApiMockStack } from "../src/stacks/LineMessagingApiMockStack";

describe("LineMessagingApiMock Stack", () => {
  let nagReport: PolicyValidationPluginReport;

  beforeAll(() => {
    const app = new cdk.App();
    const checks = new AwsSolutionsChecks(app, { verbose: true });
    new LineMessagingApiMockStack(app, "JestLineMessagingApiMockStack");

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
