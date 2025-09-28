import * as cdk from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { NodeJsLambdaFunction } from "../cfn_resources/NodeJsLambdaFunction";
import { LINE_MESSAGING_API_MOCK_HANDLER_ENV } from "../handlers/LineMessagingApiMockHandler";

export class LineMessagingApiMockStack extends cdk.Stack {
  readonly bucket: cdk.aws_s3.Bucket;
  readonly functionUrl: cdk.aws_lambda.FunctionUrl;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new cdk.aws_s3.Bucket(this, "LineMessagingApiMockBucket", {
      bucketName: `${cdk.Stack.of(this).stackName.toLocaleLowerCase()}-line-notify-mock-bucket`,
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

    const lambda = new NodeJsLambdaFunction(this, "LineMessagingApiMockHandler", {
      entryFileName: "LineMessagingApiMockHandler",
      environment: {
        [LINE_MESSAGING_API_MOCK_HANDLER_ENV.BUCKET_NAME]: bucket.bucketName,
      },
    });

    bucket.grantReadWrite(lambda);

    this.bucket = bucket;
    this.functionUrl = lambda.addFunctionUrl({
      authType: cdk.aws_lambda.FunctionUrlAuthType.NONE,
    });

    /**
     * cdk-nag
     */

    NagSuppressions.addResourceSuppressions(lambda, [
      {
        id: "AwsSolutions-L1",
        reason: "Lambda で Nodejs 18x を使用するため、抑制する。",
      },
    ]);

    NagSuppressions.addResourceSuppressions(
      lambda.role,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "Lambda で AWSLambdaBasicExecutionRole Managed Policy を使用するため、抑制する。",
        },
      ],
      true,
    );

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
