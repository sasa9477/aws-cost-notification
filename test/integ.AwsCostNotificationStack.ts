import { AwsApiCall, ExpectedResult, IntegTest } from "@aws-cdk/integ-tests-alpha";
import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { IConstruct } from "constructs";
import { ApplyDestroyPolicyAspect } from "../src/aspects/ApplyDestroyPolicyAspect";
import { CustomResourceLoggingConfigAspect } from "../src/aspects/CustomResourceLoggingConfigAspect";
import { AwsCostNotificationStack } from "../src/stacks/AwsCostNotificationStack";
import { LineMessagingApiMockStack } from "../src/stacks/LineMessagingApiMockStack";
import { testConfig } from "./fixtures/testConfig";

const app = new cdk.App();

/**
 * Line Messaging API への通知を lambda と s3 を使用してモックする
 * lambda の functionUrl を AwsCostNotificationStack に渡し、Line Messaging API への通知を lambda で経由で受けとり S3 に保存する
 */

const mockStack = new LineMessagingApiMockStack(app, "LineMessagingApiMockStack", {
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
  lineChannelId: "",
  lineChannelSecret: "",
  lineUserId: "",
  lineNotificationTestUrl: mockStack.functionUrl.url,
});

cdk.Aspects.of(stack).add(new AwsSolutionsChecks({ verbose: true }));
cdk.Aspects.of(stack).add(new ApplyDestroyPolicyAspect());
cdk.Aspects.of(mockStack).add(new ApplyDestroyPolicyAspect());
cdk.Aspects.of(mockStack).add(new CustomResourceLoggingConfigAspect());

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
 * 1. UpdateBudget awsApiCall でコスト予算を更新しアラートを発生させる
 * 2. コスト通知の Lambda 関数を呼び出す
 * 3. S3 バケットに 6 つのオブジェクトが存在することを確認する
 *  - コスト予算のアラートアクション
 *    - 予算額のコスト
 *      - Line Messaging API の認証メッセージ
 *      - アラートメッセージ
 *    - 実際のコスト
 *      - Line Messaging API の認証メッセージ
 *      - アラートメッセージ
 *  - コスト通知の Lambda 関数呼び出しアクション
 *    - Line Messaging API の認証メッセージ
 *    - アラートメッセージ
 *
 */

const budget = stack.monthlyCostBudget!.budget as cdk.aws_budgets.CfnBudget.BudgetDataProperty;

const updateBudget = integ.assertions.awsApiCall("budgets", "UpdateBudget", {
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

updateBudget.provider.addToRolePolicy({
  Effect: "Allow",
  Action: ["budgets:*"],
  Resource: ["*"],
});

const costNotifacationHandler = stack.costNotifacationHandler!;

const invokeCostNotificationLambda = integ.assertions.awsApiCall("lambda", "Invoke", {
  FunctionName: costNotifacationHandler.functionName,
  // onSuccess を呼び出すために 非同期で実行
  InvocationType: "Event",
});

invokeCostNotificationLambda.provider.addPolicyStatementFromSdkCall("Lambda", "invokeFunction", [
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
  .expect(ExpectedResult.objectLike({ KeyCount: 6 }))
  .waitForAssertions({
    totalTimeout: cdk.Duration.minutes(10),
    interval: cdk.Duration.minutes(1),
    backoffRate: 3,
  });

// listObjectsV2 は ListBucket の権限が必要なため付与する
listBucketAssertion.provider.addToRolePolicy({
  Effect: "Allow",
  Action: ["s3:ListBucket"],
  Resource: [bucket.bucketArn, bucket.arnForObjects("*")],
});

// 暗黙的に AssertionsProvider.addPolicyStatementFromSdkCall が呼ばれ ListObjectV2 API の名称から "Action": ["s3:ListObjectsV2"] の権限が追加される
// しかし、必要な権限は ListBucket であるため、ここで明示的に waiterProvider に権限許可を追加する
cdk.Aspects.of(listBucketAssertion).add({
  visit(node: IConstruct) {
    if (node instanceof AwsApiCall && node.waiterProvider) {
      node.waiterProvider.addToRolePolicy({
        Effect: "Allow",
        Action: ["s3:ListBucket"],
        Resource: [bucket.bucketArn, bucket.arnForObjects("*")],
      });
    }
  },
});

updateBudget.next(invokeCostNotificationLambda).next(listBucketAssertion);
