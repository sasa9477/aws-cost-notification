export type SuccessPayload = string;

export type FailurePayload = {
  errorType: string;
  errorMessage: string;
  trace: string[];
};

export type LambdaSnsContext = {
  version: string;
  timestamp: string;
  requestContext: {
    requestId: string;
    functionArn: string;
    condition: string;
    approximateInvokeCount: number;
  };
  requestPayload: Record<string, unknown>;
  responseContext: {
    statusCode: number;
    executedVersion: string;
    functionError: string;
  };
  responsePayload: SuccessPayload | FailurePayload;
};
