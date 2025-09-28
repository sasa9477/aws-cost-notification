import { Config } from "../../src/config/config";

export const testConfig: Config = {
  costScheduleNotificationConfig: {
    enabled: true,
    scheduleExpression: "cron(0 10 ? * 2 *)",
  },
  budgetAlertConfig: {
    enabled: true,
    budgetAmount: 100,
    actualAmountCostAlertThreshold: 50,
    forecastedAmountCostAlertThreshold: 50,
  },
  costAnomalyNotificationConfig: {
    enabled: false,
    forecastedAmountCostAlertThreshold: 1,
  },
};
