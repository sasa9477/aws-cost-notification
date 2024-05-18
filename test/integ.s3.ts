import { ExpectedResult, IntegTest } from "@aws-cdk/integ-tests-alpha";
import * as cdk from "aws-cdk-lib";
import { ApplyDestroyPolicyAspect } from "../src/aspects/ApplyDestroyPolicyAspect";
import { AwsCostNotificationTestStack } from "../src/stacks/AwsCostNotificationTestStack";

const app = new cdk.App();
const stack = new AwsCostNotificationTestStack(app, "S3TestStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-northeast-1",
  },
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

const bucket = stack.bucket;

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
