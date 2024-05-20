export type Config = {
  /**
   * コストのスケジュール通知の設定
   */
  costNotificationScheduleConfig: {
    /**
     * コストのスケジュール通知の有効 / 無効
     */
    enabled: boolean;
    /**
     * スケジュール実行の定義式
     */
    scheduleExpression: string;
  };
  /**
   * 予算通知の設定
   */
  budgetAlartConfig: {
    /**
     * 予算通知の有効 / 無効
     */
    enabled: boolean;
    /**
     * 予算額 (USD)
     */
    budgetAmount: number;
    /**
     * 実績金額のアラート閾値 (%)
     */
    actualAmountCostAlertThreshold: number;
    /**
     * 予測金額のアラート閾値 (%)
     */
    forecastedAmountCostAlertThreshold: number;
  };
  /**
   * コスト異常通知の設定
   */
  costAnomalyNotificationConfig: {
    // コスト異常通知の有効 / 無効
    enebled: boolean;
    // 予想支出の異常通知アラートの閾値 (USD)
    forecastedAmountCostAlertThreshold: number;
  };
};

export const config: Config = {
  costNotificationScheduleConfig: {
    enabled: true,
    // 毎週月曜日の 10:00 に実行
    scheduleExpression: "cron(0 10 ? * 2 *)",
  },
  budgetAlartConfig: {
    enabled: true,
    // 予算額は 4 USD
    budgetAmount: 4,
    // 実際のコストが 50% 以上の場合に通知
    actualAmountCostAlertThreshold: 50,
    // 予想額の 80% 以上の場合に通知
    forecastedAmountCostAlertThreshold: 80,
  },
  costAnomalyNotificationConfig: {
    enebled: true,
    forecastedAmountCostAlertThreshold: 1,
  },
};
