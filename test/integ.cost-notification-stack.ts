import * as cdk from "aws-cdk-lib";
import * as dotenv from "dotenv";
import { AwsCostNotificationStack } from "../lib/stacks/aws-cost-notification-stack";
import { AwsSolutionsChecks } from "cdk-nag";
import { IntegTest, ExpectedResult } from "@aws-cdk/integ-tests-alpha";

dotenv.config();

const app = new cdk.App();

const stack = new AwsCostNotificationStack(app, "IntegTestStack");

cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

const integ = new IntegTest(app, "DataFlowTest", {
  testCases: [stack],
  cdkCommandOptions: {
    destroy: {
      args: {
        force: true,
      },
    },
  },
  regions: [stack.region],
});

/**
 * Assertions
 */
// const assertion = integ.assertions
//   .awsApiCall("CostExplorer", "describe-budget", {
//     AccountId: stack.account,
//     BudgetName: (stack.monthlyCostBudget.budget as cdk.aws_budgets.CfnBudget.BudgetDataProperty).budgetName,
//   })
//   .expect(
//     ExpectedResult.objectLike({
//       Budget: {
//         BudgetName: (stack.monthlyCostBudget.budget as cdk.aws_budgets.CfnBudget.BudgetDataProperty).budgetName,
//       },
//     }),
//   );

// integ.assertions.awsApiCall("CostExplorer", "update-budget", {
//   AccountId: stack.account,
//   NewBudget: {},
// })

// /**
//  * Assertion:
//  * The application should handle single message and write the enriched item to the DynamoDB table.
//  */
// const id = 'test-id-1';
// const message = 'This message should be validated';
// /**
//  * Publish a message to the SNS topic.
//  * Note - SNS topic ARN is a member variable of the
//  * application stack for testing purposes.
//  */
// const assertion = integ.assertions
//   .awsApiCall('SNS', 'publish', {
//     TopicArn: stackUnderTest.topicArn,
//     Message: JSON.stringify({
//       id: id,
//       message: message,
//     }),
//   })
//   /**
//    * Validate that the DynamoDB table contains the enriched message.
//    */
//   .next(
//     integ.assertions
//       .awsApiCall('DynamoDB', 'getItem', {
//         TableName: stackUnderTest.tableName,
//         Key: { id: { S: id } },
//       })
//       /**
//        * Expect the enriched message to be returned.
//        */
//       .expect(
//         ExpectedResult.objectLike({
//           Item: {
//             id: {
//               S: id,
//             },
//             message: {
//               S: message,
//             },
//             additionalAttr: {
//               S: 'enriched',
//             },
//           },
//         }),
//       )
//       /**
//        * Timeout and interval check for assertion to be true.
//        * Note - Data may take some time to arrive in DynamoDB.
//        * Iteratively executes API call at specified interval.
//        */
//       .waitForAssertions({
//         totalTimeout: Duration.seconds(25),
//         interval: Duration.seconds(3),
//       }),
//   );

// // Add the required permissions to the api call
// assertion.provider.addToRolePolicy({
//   Effect: 'Allow',
//   Action: [
//     'kms:Encrypt',
//     'kms:ReEncrypt*',
//     'kms:GenerateDataKey*',
//     'kms:Decrypt',
//   ],
//   Resource: [stackUnderTest.kmsKeyArn],
// });
