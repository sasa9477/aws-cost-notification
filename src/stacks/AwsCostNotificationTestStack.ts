import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import path from "path";
import { NagSuppressions } from "cdk-nag";
import { S3_SAVE_TEST_HANDLER_ENV } from "../handlers/S3SaveTestHandler";

export class AwsCostNotificationTestStack extends cdk.Stack {
  readonly bucket: cdk.aws_s3.Bucket;
  readonly functionUrl: cdk.aws_lambda.FunctionUrl;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new cdk.aws_s3.Bucket(this, "TestBucket", {
      bucketName: `${cdk.Stack.of(this).stackName.toLocaleLowerCase()}-test-bucket`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    bucket.addToResourcePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ["s3:GetBucket*", "s3:List*", "s3:DeleteObject*", "s3:PutBucketPolicy"],
        principals: [new cdk.aws_iam.ServicePrincipal("lambda.amazonaws.com")],
        resources: [bucket.bucketArn, bucket.arnForObjects("*")],
      }),
    );

    const lambdaRole = new cdk.aws_iam.Role(this, "NotificationTestLambdaRole", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("lambda.amazonaws.com"),
      inlinePolicies: {},
    });

    const lambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, "NotificationTestLambda", {
      role: lambdaRole,
      entry: path.join(__dirname, "../handlers/S3SaveTestHandler.ts"),
      functionName: `${cdk.Stack.of(this).stackName}-notification-test-lambda`,
      bundling: {
        externalModules: ["@aws-sdk/*"],
        tsconfig: path.join(__dirname, "../../tsconfig.json"),
      },
      runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      logGroup: new cdk.aws_logs.LogGroup(this, "NotificationTestLambdaLogGroup", {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: {
        TZ: "Asia/Tokyo",
        [S3_SAVE_TEST_HANDLER_ENV.BUCKET_NAME]: bucket.bucketName,
      },
    });

    lambdaRole.addToPolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
        effect: cdk.aws_iam.Effect.ALLOW,
        resources: [lambda.logGroup.logGroupArn],
      }),
    );

    bucket.grantReadWrite(lambda);

    this.bucket = bucket;
    this.functionUrl = lambda.addFunctionUrl({
      authType: cdk.aws_lambda.FunctionUrlAuthType.NONE,
    });

    /**
     * cdk-nag
     */

    NagSuppressions.addResourceSuppressions(
      this,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "テスト用のスタックのため、IAM ポリシーのワイルドカードを許可する",
        },
      ],
      true,
    );
    NagSuppressions.addResourceSuppressions(
      bucket,
      [
        {
          id: "AwsSolutions-S1",
          reason: "テスト用のバケットのため、アクセスログは設定しない",
        },
      ],
      true,
    );
    NagSuppressions.addResourceSuppressions(
      bucket,
      [
        {
          id: "AwsSolutions-S10",
          reason: "テスト用のバケットのため、SSLは設定しない",
        },
      ],
      true,
    );
  }
}
