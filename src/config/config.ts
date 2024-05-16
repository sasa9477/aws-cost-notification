export type Config = {
  /**
   * コスト通知スケジュールの設定
   */
  constNotificationScheduleConfig: {
    /**
     * 通知スケジュール
     */
    scheduleExpression: string;
  };
  /**
   * 予算通知の設定
   */
  budgetAlartConfig: {
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
};

export const config: Config = {
  constNotificationScheduleConfig: {
    // 毎週月曜日の 10:00 に実行
    scheduleExpression: "cron(0 10 ? * 2 *)",
  },
  budgetAlartConfig: {
    // 予算額は 4 USD
    budgetAmount: 4,
    // 実際のコストが 50% 以上の場合に通知
    actualAmountCostAlertThreshold: 50,
    // 予想額の 80% 以上の場合に通知
    forecastedAmountCostAlertThreshold: 80,
  },
};
