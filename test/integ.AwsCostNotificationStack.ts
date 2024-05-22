import { AwsApiCall, ExpectedResult, IntegTest } from "@aws-cdk/integ-tests-alpha";
import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { IConstruct } from "constructs";
import * as dotenv from "dotenv";
import { ApplyDestroyPolicyAspect } from "../src/aspects/ApplyDestroyPolicyAspect";
import { AwsCostNotificationStack } from "../src/stacks/AwsCostNotificationStack";
import { LineNotifyMockStack } from "../src/stacks/LineNotifyMockStack";
import { testConfig } from "./fixtures/testConfig";

dotenv.config({ path: "../.env" });

const app = new cdk.App();

/**
 * LineNotify への通知を lambda と s3 を使用してモックする
 * lambda の functionUrl を AwsCostNotificationStack に渡し、LineNotify への通知を lambda で受けとり s3 に保存する
 */

const mockStack = new LineNotifyMockStack(app, "LineNotifyMockStack", {
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
 *
 * 1. UpdateBudget でコスト予算を更新しアラートを発生させる
 * 2. コスト通知の Lambda 関数を呼び出す
 * 3. S3 バケットに 3 つのオブジェクトが存在することを確認する
 * 　- コスト予算のアラートによって予算額と実際のコストの 2つのオブジェクトが作成される
 * 　- コスト通知の Lambda 関数が実行されると、3つ目のオブジェクトが作成される
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

// 暗黙的に AssertionsProvider.addPolicyStatementFromSdkCall が呼ばれ "Action": ["s3:ListObjectsV2"] の権限が追加される
// 権限が足りないため、ここで明示的に waiterProvider に ListObjectsV2 を呼び出すための権限許可を追加する
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
