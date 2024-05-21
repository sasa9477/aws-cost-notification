# aws-cost-notification

AWS の使用コストを LINE に通知する aws cdk のレポジトリです。

## 機能

- 通知スケジュールを設定し、使用しているコストを LINE に通知します。
- 予算を設定し、コストが閾値を超えた場合に LINE に通知します。
- コスト異常検出を設定し、異常を検出した場合に LINE に通知します。
- Exchange Rates API を使用して為替レートを取得し、日本円の予想額を表示します。

## 事前設定

### 環境変数の設定

`.env` ファイルを作成してアクセストークンを設定します。

```bash
# LINE Notify のアクセストークン
LINE_NOTIFY_TOKEN=
# Exchange Rates API のアクセストークン
EXCHANGE_RATE_API_KEY=
```

#### LINE Notify の設定

LINE Notify に登録してアクセストークンを発行し、環境変数に設定してください。（必須）  
https://notify-bot.line.me/

#### Exchange Rates API の設定

exchangerates に登録してアクセストークンを発行し、環境変数に設定してください。  
トークンが無い場合は USD と JPY の為替変換は行いません。  
https://exchangeratesapi.io/

### graphviz のインストール

cdk 構成図を作成するため graphviz をインストールしてください。  
構成図の作成は、エラーにならないため必須ではありません。

```
brew install graphviz
```

Homebrew を使用してインストールできますが、バイナリファイルをダウンロードすることもできます。  
https://graphviz.org/download/

## 構成の変更

`src/config/config.ts` を編集して構成を変更できます。

### 構成値

#### コストのスケジュール通知の設定

- `enabled`: コストのスケジュール通知の有効 / 無効を設定します。 (`boolean`)
- `scheduleExpression`: スケジュール実行の定義式を設定します。 (`string`)  
  詳細は [AWS CloudFormation Schedule Expression](http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-scheduler-schedule.html#cfn-scheduler-schedule-scheduleexpression) を参照してください。

#### 予算通知設定

- `enabled`: 予算通知の有効 / 無効を設定します。 (`boolean`)
- `budgetAmount`: 予算額を設定します。 (`number`, 単位: USD)
- `actualAmountCostAlertThreshold`: 実績金額のアラート閾値を設定します。 (`number`, 単位: %)
- `forecastedAmountCostAlertThreshold`: 予測金額のアラート閾値を設定します。 (`number`, 単位: %)

#### コスト異常通知設定

- `enabled`: コスト異常通知の有効 / 無効を設定します。 (`boolean`)
- `forecastedAmountCostAlertThreshold`: 予想支出の異常通知アラートの閾値を設定します。 (`number`, 単位: USD)

## AWS 構成図

### サービス概要図

![cdk-diagram-drawio](cdkgraph/cdk-diagram.svg)

### リソース構成図

![cdk-diagram-light](cdkgraph/diagram.compact.light.svg#gh-light-mode-only)
![cdk-diagram-dark](cdkgraph/diagram.compact.dark.svg#gh-dark-mode-only)
