import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

export interface NodeJsLambdaFunctionProps
  extends Omit<cdk.aws_lambda_nodejs.NodejsFunctionProps, "entry" | "functionName"> {
  entryFileName: string;
}

export class NodeJsLambdaFunction extends cdk.aws_lambda_nodejs.NodejsFunction {
  public readonly role: cdk.aws_iam.Role;

  constructor(scope: Construct, id: string, props: NodeJsLambdaFunctionProps) {
    const { entryFileName, role, initialPolicy, ...rest } = props;

    const _role =
      role ??
      new cdk.aws_iam.Role(scope, `${entryFileName}Role`, {
        assumedBy: new cdk.aws_iam.ServicePrincipal("lambda.amazonaws.com"),
        managedPolicies: [
          cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
        ],
      });

    initialPolicy?.forEach((policy) => _role.addToPrincipalPolicy(policy));

    const logGroup = new cdk.aws_logs.LogGroup(scope, `${entryFileName}LogGroup`, {
      removalPolicy: cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
      retention: cdk.aws_logs.RetentionDays.INFINITE,
    });

    super(scope, id, {
      runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      role: _role,
      logGroup: logGroup,
      entry: path.join(__dirname, "../handlers", `${entryFileName}.ts`),
      functionName: `${cdk.Stack.of(scope).stackName}${entryFileName}`,
      bundling: {
        externalModules: ["@aws-sdk/*"],
        tsconfig: path.join(__dirname, "../../tsconfig.json"),
        ...rest.bundling,
      },
      environment: {
        TZ: "Asia/Tokyo",
        ...rest.environment,
      },
      ...rest,
    });
  }
}
