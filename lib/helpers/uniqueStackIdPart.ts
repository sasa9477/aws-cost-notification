import { Fn, Aws } from "aws-cdk-lib";

/**

 */
/**
 * Stack 実行毎の一意な ID の一部を返します。
 * @returns Stack 実行毎の一意な ID の一部
 * @description
 *  Given stack id: "arn:aws:cloudformation:us-east-1:123456789012:stack/lh-stickb-idp/4bf74be0-e880-11ee-aea9-0affc6185b25",\
 *  returns "4bf74be0"
 * @see https://github-com.translate.goog/aws/aws-cdk/discussions/25257
 */
export function uniqueStackIdPart() {
  return Fn.select(0, Fn.split("-", Fn.select(2, Fn.split("/", `${Aws.STACK_ID}`))));
}
