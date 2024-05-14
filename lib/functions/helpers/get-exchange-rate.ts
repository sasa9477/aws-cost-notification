import { roundDigit } from "./round-disit";

export interface ExchangeRateLatestResponse {
  success: boolean;
  timestamp: number;
  base: string;
  date: string;
  rates: {
    [key: string]: number;
  };
}

export async function getExchangeRate(apiKey: string): Promise<number | undefined> {
  const url = new URL("http://api.exchangeratesapi.io/v1/latest");
  url.searchParams.append("access_key", apiKey);
  url.searchParams.append("base", "EUR");
  url.searchParams.append("symbols", "USD,JPY");

  const resJson = await /** global-fetch */ fetch(url.href, {
    method: "GET",
    headers: {
      ContentType: "application/json; Charset=UTF-8",
    },
  })
    .then((res) => {
      return res.json() as Promise<ExchangeRateLatestResponse>;
    })
    .catch((err) => {
      console.error(err);
      return undefined;
    });

  if (!resJson) {
    return undefined;
  }

  if (resJson.success && resJson.rates?.USD > 0 && resJson.rates?.JPY > 0) {
    return roundDigit(resJson.rates.JPY / resJson.rates.USD);
  }

  console.error("Failed to get exchange rate", resJson);
  return undefined;
}
