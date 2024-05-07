import * as cdk from "aws-cdk-lib";
import { IConstruct } from "constructs";

export class ApplyDestroyPolicyAspect implements cdk.IAspect {
  public visit(node: IConstruct): void {
    console.log(node.node.id);
    if (node instanceof cdk.CfnResource) {
      node.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

      if (node.node.defaultChild instanceof cdk.CfnResource) {
        node.node.defaultChild.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
      }
    }
  }
}
