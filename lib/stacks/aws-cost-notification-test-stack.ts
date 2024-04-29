import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { BudgetAlartConstruct } from "../constructs/budget-alart-construct";
import { CostNotifacationConstruct } from "../constructs/cost-notification-construct";
import { NotificationConstruct } from "../constructs/notification-contruct";

export class AwsCostNotificationTestStack extends cdk.Stack {
  readonly costAlarmTopic: cdk.aws_sns.Topic;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // const mockIntegration = new cdk.cloud_assembly_schema..MockIntegration({
    //   requestTemplates: {
    //     "application/json": '{"statusCode": 200}',
    //   },
    //   integrationResponses: [
    //     {
    //       statusCode: "200",
    //       responseTemplates: {
    //         "application/json": '{ "message": "mock", "now": "$context.authorizer.now" }',
    //       },
    //     },
    //   ],
    // });
    // const method = api.root.addMethod("GET", mockIntegration, {
    //   methodResponses: [
    //     {
    //       statusCode: "200",
    //     },
    //   ],
    //   authorizer: lambdaAuthorizer,
    // });

    // new cdk.aws_apigatewayv2.HttpApi(this, "HttpApi", {
    //   defaultIntegration: new cdk.aws_apigatewayv2_integrations.HttpLambdaIntegration({
    //     handler: new cdk.aws_lambda.Function(this, "Lambda", {
    //       runtime: cdk.aws_lambda.Runtime.NODEJS_14_X,
    //       handler: "index.handler",
    //       code: cdk.aws_lambda.Code.fromAsset("lambda"),
    //   })
    //   }),
    // });

    //   new cdk.aws_apigateway.RestApi(this, "RestApi", {
    //     defaultIntegration: new cdk.aws_apigateway.MockIntegration({
    //       passthroughBehavior: cdk.aws_apigateway.PassthroughBehavior.NEVER,
    //       requestTemplates: {
    //         "application/json": '{"statusCode": 200}',
    //       },
    //       integrationResponses: [
    //         {
    //           statusCode: "200",
    //           responseTemplates: {
    //             "application/json": '{"message": "mock"}',
    //           },
    //         },
    //       ],
    //     }),

    //   });
  }
}
