import * as lambda from "aws-lambda";
import { LambdaSnsContext } from "../types/LambdaSnsContext";

export const POST_LINE_LAMBDA_ENV = {
  LINE_NOTIFY_URL: "LINE_NOTIFY_URL",
  LINE_NOTIFY_TOKEN: "LINE_NOTIFY_TOKEN",
};

export const handler: lambda.SNSHandler = async (event) => {
  console.log(JSON.stringify(event));

  const requestContext = JSON.parse(event.Records[0].Sns.Message) as LambdaSnsContext;

  const message =
    typeof requestContext.responsePayload === "string"
      ? requestContext.responsePayload
      : requestContext.responsePayload.errorMessage;

  const json = await /** global-fetch */ fetch(process.env[POST_LINE_LAMBDA_ENV.LINE_NOTIFY_URL] || "", {
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

  console.log(json);
};
