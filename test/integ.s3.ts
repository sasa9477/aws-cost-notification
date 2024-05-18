import { ExpectedResult, IntegTest } from "@aws-cdk/integ-tests-alpha";
import * as cdk from "aws-cdk-lib";
import { ApplyDestroyPolicyAspect } from "../src/aspects/ApplyDestroyPolicyAspect";

const app = new cdk.App();
const stack = new cdk.Stack(app, "S3TestStack");

const bucket = new cdk.aws_s3.Bucket(stack, "S3TestBucket", {
  bucketName: `${cdk.Stack.of(stack).stackName.toLocaleLowerCase()}-test-bucket`,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
});
bucket.addToResourcePolicy(
  new cdk.aws_iam.PolicyStatement({
    effect: cdk.aws_iam.Effect.ALLOW,
    actions: ["s3:DeleteObject*", "s3:GetBucket*", "s3:List*", "s3:PutBucketPolicy"],
    principals: [new cdk.aws_iam.ServicePrincipal("lambda.amazonaws.com")],
    resources: [bucket.bucketArn, bucket.arnForObjects("*")],
  }),
);

new cdk.aws_s3_deployment.BucketDeployment(stack, `S3TestBucketDeployment`, {
  sources: [cdk.aws_s3_deployment.Source.asset("./fixtures/assets")],
  destinationBucket: bucket,
});

const integ = new IntegTest(app, "S3TestStackDataFlow", {
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
// ListObjectsV2 だけだと、AccessDenied が返ってくるので、HeadBucket でバケットの存在確認を行う
const assertion = integ.assertions
  .awsApiCall("s3", "HeadBucket", {
    Bucket: bucket.bucketName,
  })
  .next(
    integ.assertions
      .awsApiCall("s3", "ListObjectsV2", {
        Bucket: bucket.bucketName,
      })
      .expect(ExpectedResult.objectLike({ KeyCount: 1 })),
  );

assertion.provider.addToRolePolicy({
  Effect: "Allow",
  Action: ["s3:GetObject*", "s3:List*"],
  Resource: [bucket.bucketArn, bucket.arnForObjects("*")],
});

cdk.Aspects.of(assertion).add(new ApplyDestroyPolicyAspect());
