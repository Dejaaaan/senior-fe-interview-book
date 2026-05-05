import { Stack, StackProps, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  HttpApi,
  HttpMethod,
  CorsHttpMethod,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Architecture, Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import type { Table } from "aws-cdk-lib/aws-dynamodb";

export type ApiStackProps = StackProps & {
  table: Table;
  userPoolId: string;
  userPoolClientId: string;
};

export class ApiStack extends Stack {
  public readonly api: HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const tasksFn = new NodejsFunction(this, "TasksFn", {
      entry: "api/src/handler.ts",
      handler: "handler",
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      memorySize: 1024,
      timeout: Duration.seconds(10),
      tracing: Tracing.ACTIVE,
      bundling: {
        minify: true,
        sourceMap: true,
        target: "node22",
        externalModules: ["@aws-sdk/*"],
      },
      environment: {
        TABLE_NAME: props.table.tableName,
      },
    });
    props.table.grantReadWriteData(tasksFn);

    this.api = new HttpApi(this, "Api", {
      corsPreflight: {
        allowOrigins: ["https://app.example.com"],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.DELETE,
        ],
        allowHeaders: ["Content-Type", "Authorization"],
        allowCredentials: true,
        maxAge: Duration.minutes(10),
      },
    });

    const issuer = `https://cognito-idp.${this.region}.amazonaws.com/${props.userPoolId}`;
    const authorizer = new HttpJwtAuthorizer("Auth", issuer, {
      jwtAudience: [props.userPoolClientId],
    });

    const integration = new HttpLambdaIntegration("TasksInt", tasksFn);

    this.api.addRoutes({
      path: "/api/tasks",
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration,
      authorizer,
    });

    this.api.addRoutes({
      path: "/api/tasks/{id}",
      methods: [HttpMethod.GET, HttpMethod.PATCH, HttpMethod.DELETE],
      integration,
      authorizer,
    });
  }
}
