import * as lambda from "aws-lambda";
import { LambdaSnsContext } from "../types/lambda-sns-context";

export const POST_LINE_LAMBDA_ENV = {
  LINE_NOTIFY_TOKEN: "LINE_NOTIFY_TOKEN",
};

export const handler: lambda.SNSHandler = async (event) => {
  console.log(JSON.stringify(event));

  const requestContext = JSON.parse(event.Records[0].Sns.Message) as LambdaSnsContext;

  const message =
    typeof requestContext.responsePayload === "string"
      ? requestContext.responsePayload
      : requestContext.responsePayload.errorMessage;

  await /** global-fetch */ fetch("https://notify-api.line.me/api/notify", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env[POST_LINE_LAMBDA_ENV.LINE_NOTIFY_TOKEN]}`,
      ContentType: "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      message,
    }),
  }).then((res) => {
    return res.json();
  });
};
