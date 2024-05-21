import { AwsApiCall, ExpectedResult, IntegTest } from "@aws-cdk/integ-tests-alpha";
import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { IConstruct } from "constructs";
import * as dotenv from "dotenv";
import { ApplyDestroyPolicyAspect } from "../src/aspects/ApplyDestroyPolicyAspect";
import { AwsCostNotificationStack } from "../src/stacks/AwsCostNotificationStack";
import { AwsCostNotificationTestStack } from "../src/stacks/AwsCostNotificationTestStack";
import { testConfig } from "./fixtures/testConfig";

dotenv.config({ path: "../.env" });

const app = new cdk.App();

const mockStack = new AwsCostNotificationTestStack(app, "IntegTestMockStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-northeast-1",
  },
  crossRegionReferences: true,
});

const stack = new AwsCostNotificationStack(app, "IntegTestStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-northeast-1",
  },
  crossRegionReferences: true,
  config: testConfig,
  lineNotifyUrl: mockStack.functionUrl.url,
});

cdk.Aspects.of(stack).add(new AwsSolutionsChecks({ verbose: true }));
cdk.Aspects.of(stack).add(new ApplyDestroyPolicyAspect());
cdk.Aspects.of(mockStack).add(new ApplyDestroyPolicyAspect());

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

const budget = stack.monthlyCostBudget!.budget as cdk.aws_budgets.CfnBudget.BudgetDataProperty;

const updateBudgetAssersion = integ.assertions.awsApiCall("budgets", "UpdateBudget", {
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
});

updateBudgetAssersion.provider.addToRolePolicy({
  Effect: "Allow",
  Action: ["budgets:*"],
  Resource: ["*"],
});

const costNotifacationHandler = stack.costNotifacationHandler!;

const invokeCostNotificationHandler = integ.assertions.awsApiCall("lambda", "Invoke", {
  FunctionName: costNotifacationHandler.functionName,
  // onSuccess を呼び出すために 非同期で実行
  InvocationType: "Event",
});

invokeCostNotificationHandler.provider.addPolicyStatementFromSdkCall("Lambda", "invokeFunction", [
  stack.formatArn({
    service: "lambda",
    resource: "function",
    arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
    resourceName: costNotifacationHandler.functionName,
  }),
]);

const bucket = mockStack.bucket;

const listBucketAssertion = integ.assertions
  .awsApiCall("s3", "ListObjectsV2", {
    Bucket: bucket.bucketName,
  })
  .expect(ExpectedResult.objectLike({ KeyCount: 3 }))
  .waitForAssertions({
    totalTimeout: cdk.Duration.minutes(10),
    interval: cdk.Duration.minutes(1),
    backoffRate: 3,
  });

listBucketAssertion.provider.addToRolePolicy({
  Effect: "Allow",
  Action: ["s3:GetObject*", "s3:List*"],
  Resource: [bucket.bucketArn, bucket.arnForObjects("*")],
});

// 自動的に AssertionsProvider.addPolicyStatementFromSdkCall で "Action": ["s3:ListObjectsV2"] が追加される
// そのため、ここで明示的に waiterProvider に ListObjectsV2 用の権限許可を設定する
cdk.Aspects.of(listBucketAssertion).add({
  visit(node: IConstruct) {
    if (node instanceof AwsApiCall && node.waiterProvider) {
      node.waiterProvider.addToRolePolicy({
        Effect: "Allow",
        Action: ["s3:GetObject*", "s3:List*"],
        Resource: [bucket.bucketArn, bucket.arnForObjects("*")],
      });
    }
  },
});

updateBudgetAssersion.next(invokeCostNotificationHandler).next(listBucketAssertion);
