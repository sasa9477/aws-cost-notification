import * as lambda from "aws-lambda";
import { CompleteMultipartUploadCommandOutput, S3, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

export const NOTIFICATION_TEST_LAMBDA_ENV = {
  BUCKET_NAME: "BUCKET_NAME",
};

export const testFileName = "test.txt";

export const handler: lambda.LambdaFunctionURLHandler<CompleteMultipartUploadCommandOutput> = async (event) => {
  console.log(JSON.stringify(event));

  const uploadS3 = new Upload({
    client: new S3({}) || new S3Client({}),
    params: {
      Bucket: process.env[NOTIFICATION_TEST_LAMBDA_ENV.BUCKET_NAME],
      Key: testFileName,
      Body:
        event.body && event.isBase64Encoded
          ? decodeURI(Buffer.from(event.body, "base64").toString("utf8"))
          : event.body,
      ContentType: "text/plain",
    },
  });

  return await uploadS3.done();
};
