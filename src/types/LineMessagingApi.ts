export declare namespace LineMessagingApi {
  type CreateAccessTokenResponse = {
    access_token: string;
    expires_in: number;
    token_type: string;
  };
  type SendMessageResponse = {
    status: number;
    message: string;
  };
}
