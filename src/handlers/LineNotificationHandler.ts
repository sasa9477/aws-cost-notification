import * as lambda from "aws-lambda";
import { LambdaSnsContext } from "../types/LambdaSnsContext";
import { LineMessagingApi } from "../types/LineMessagingApi";

export const LINE_NOTIFICATION_HANDLER_ENV = {
  LINE_NOTIFICATION_TEST_URL: "LINE_NOTIFICATION_TEST_URL",
  LINE_CHANNEL_ID: "LINE_CHANNEL_ID",
  LINE_CHANNEL_SECRET: "LINE_CHANNEL_SECRET",
  LINE_USER_ID: "LINE_USER_ID",
};

export const handler: lambda.SNSHandler = async (event) => {
  console.log(JSON.stringify(event));

  const requestContext = JSON.parse(event.Records[0].Sns.Message) as LambdaSnsContext;

  const message =
    typeof requestContext.responsePayload === "string"
      ? requestContext.responsePayload
      : requestContext.responsePayload.errorMessage;

  // LINE_NOTIFICATION_TEST_URL が設定されている場合はテスト用の URL を使用する
  const notificationTestUrl = process.env[LINE_NOTIFICATION_HANDLER_ENV.LINE_NOTIFICATION_TEST_URL] || "";

  // ステートレスチャネルアクセストークンを発行する
  const createAccessToken = async (notificationTestUrl?: string) => {
    return await /* global fetch */ fetch(notificationTestUrl || "https://api.line.me/oauth2/v3/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env[LINE_NOTIFICATION_HANDLER_ENV.LINE_CHANNEL_ID] || "",
        client_secret: process.env[LINE_NOTIFICATION_HANDLER_ENV.LINE_CHANNEL_SECRET] || "",
      }),
    }).then((res) => {
      return res.json() as Promise<LineMessagingApi.CreateAccessTokenResponse>;
    });
  };

  const { access_token } = await createAccessToken(notificationTestUrl);

  const sendMessage = async (notificationTestUrl: string, access_token: string, message: string) => {
    return await /* global fetch */ fetch(notificationTestUrl || "https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        to: process.env[LINE_NOTIFICATION_HANDLER_ENV.LINE_USER_ID] || "",
        messages: [
          {
            type: "text",
            text: message,
          },
        ],
      }),
    }).then((res) => {
      return res.json() as Promise<LineMessagingApi.SendMessageResponse>;
    });
  };

  const result = await sendMessage(notificationTestUrl, access_token, message);

  console.log("sendMessage result:", result);
};
