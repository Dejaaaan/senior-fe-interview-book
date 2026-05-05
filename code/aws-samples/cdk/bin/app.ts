#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { DataStack } from "../lib/data-stack";
import { ApiStack } from "../lib/api-stack";

const app = new App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "eu-west-1",
};

const data = new DataStack(app, "TasksData", { env });

new ApiStack(app, "TasksApi", {
  env,
  table: data.table,
  userPoolId: data.userPool.userPoolId,
  userPoolClientId: data.userPoolClient.userPoolClientId,
});
