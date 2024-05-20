import { Config } from "../../src/config/config";

export const testConfig: Config = {
  costNotificationScheduleConfig: {
    enabled: true,
    scheduleExpression: "cron(0 10 ? * 2 *)",
  },
  budgetAlartConfig: {
    enabled: true,
    budgetAmount: 100,
    actualAmountCostAlertThreshold: 50,
    forecastedAmountCostAlertThreshold: 50,
  },
  costAnomalyNotificationConfig: {
    enebled: false,
    forecastedAmountCostAlertThreshold: 1,
  },
};
