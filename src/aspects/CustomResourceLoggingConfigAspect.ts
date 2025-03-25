import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { uniqueStackIdPart } from "../utils/uniqueStackIdPart";

export class CustomResourceLoggingConfigAspect implements cdk.IAspect {
  visit(node: Construct): void {
    if (
      cdk.CfnResource.isCfnResource(node) &&
      node.cfnResourceType === "AWS::Lambda::Function" &&
      node.node.path.includes("Custom::") &&
      node.node.scope
    ) {
      const newLogGroup = new cdk.aws_logs.LogGroup(node.node.scope, "HandlerLogGroup", {
        logGroupName: `/aws/lambda/${node.logicalId}${uniqueStackIdPart()}`,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        retention: cdk.aws_logs.RetentionDays.ONE_YEAR,
      });

      node.addPropertyOverride("LoggingConfig", {
        LogGroup: newLogGroup.logGroupName,
      });

      console.log(`replace custom resource logging config (${node.node.path})`);
    }
  }
}
