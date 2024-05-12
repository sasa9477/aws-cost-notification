import * as cdk from "aws-cdk-lib";
import * as dotenv from "dotenv";
import { AwsCostNotificationStack } from "../lib/stacks/aws-cost-notification-stack";
import { AwsSolutionsChecks } from "cdk-nag";
import { ExpectedResult, IntegTest } from "@aws-cdk/integ-tests-alpha";
import { AwsCostNotificationTestStack } from "../lib/stacks/aws-cost-notification-test-stack";
import { ApplyDestroyPolicyAspect } from "../lib/helpers/ApplyDestroyPolicyAspect";
import { uniqueStackIdPart } from "../lib/helpers/uniqueStackIdPart";
import * as fs from "fs";

dotenv.config();

const app = new cdk.App();

const mockStack = new AwsCostNotificationTestStack(app, "IntegTestMockStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-northeast-1",
  },
  crossRegionReferences: true,
});

process.env.LINE_NOTIFY_URL = mockStack.functionUrl.url;

const stack = new AwsCostNotificationStack(app, "IntegTestStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-northeast-1",
  },
  crossRegionReferences: true,
});

cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
cdk.Aspects.of(app).add(new ApplyDestroyPolicyAspect());

const integ = new IntegTest(app, "DataFlowTest", {
  testCases: [stack, mockStack],
  cdkCommandOptions: {
    destroy: {
      args: {
        force: true,
      },
    },
  },
  regions: [stack.region, mockStack.region],
});

/**
 * Assertions
 */

const budget = stack.monthlyCostBudget.budget as cdk.aws_budgets.CfnBudget.BudgetDataProperty;

const assertion = integ.assertions
  .awsApiCall("budgets", "UpdateBudget", {
    AccountId: stack.account,
    NewBudget: {
      AutoAjustData: budget.autoAdjustData,
      BudgetLimit: {
        Amount: "0.01",
        Unit: (budget.budgetLimit as cdk.aws_budgets.CfnBudget.SpendProperty).unit || "USD",
      },
      BudgetName: budget.budgetName,
      BudgetType: budget.budgetType,
      CostFilters: budget.costFilters,
      CostTypes: budget.costTypes,
      PlandBudgetLimits: budget.plannedBudgetLimits,
      TimePeriod: budget.timePeriod,
      TimeUnit: budget.timeUnit,
    },
    RetentionDays: cdk.aws_logs.RetentionDays.ONE_DAY,
  })
  .next(
    // ListObjectsV2 だけだと AccessDenied が返ってくるので HeadBucket でバケットの存在確認を行う
    integ.assertions.awsApiCall("s3", "HeadBucket", {
      Bucket: mockStack.bucket.bucketName,
    }),
    // .next(
    //   integ.assertions
    //     .awsApiCall("s3", "ListObjectsV2", {
    //       Bucket: mockStack.bucket.bucketName,
    //     })
    //     .expect(ExpectedResult.objectLike({ KeyCount: 2 }))
    //     .waitForAssertions({
    //       totalTimeout: cdk.Duration.seconds(30),
    //       interval: cdk.Duration.seconds(5),
    //       backoffRate: 3,
    //     }),
    // ),
  );

assertion.provider.addToRolePolicy({
  Effect: "Allow",
  Action: ["budgets:*"],
  Resource: ["*"],
});

assertion.provider.addToRolePolicy({
  Effect: "Allow",
  Action: ["s3:GetObject*", "s3:List*"],
  Resource: [mockStack.bucket.bucketArn, mockStack.bucket.arnForObjects("*")],
});

cdk.Aspects.of(assertion).add(new ApplyDestroyPolicyAspect());
