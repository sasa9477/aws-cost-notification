/**
 * Line にメッセージを送信する
 * @see https://notify-bot.line.me/doc/ja/
 */
export async function postLine(message: string, lineNotifyToken: string) {
  return await /** global-fetch */ fetch("https://notify-api.line.me/api/notify", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lineNotifyToken}`,
      ContentType: "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      message,
    }),
  }).then((res) => {
    return res.json();
  });
}
