import { Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  Table,
  AttributeType,
  BillingMode,
  ProjectionType,
  TableEncryption,
} from "aws-cdk-lib/aws-dynamodb";
import {
  UserPool,
  UserPoolClient,
  AccountRecovery,
  OAuthScope,
} from "aws-cdk-lib/aws-cognito";

export class DataStack extends Stack {
  public readonly table: Table;
  public readonly userPool: UserPool;
  public readonly userPoolClient: UserPoolClient;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.table = new Table(this, "AppTable", {
      partitionKey: { name: "PK", type: AttributeType.STRING },
      sortKey: { name: "SK", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      encryption: TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: { name: "PK", type: AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    this.userPool = new UserPool(this, "Users", {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 12,
        requireDigits: true,
        requireSymbols: true,
        requireUppercase: true,
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.userPool.addDomain("Domain", {
      cognitoDomain: { domainPrefix: "tasks-app-prod-demo" },
    });

    this.userPoolClient = this.userPool.addClient("WebClient", {
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE],
        callbackUrls: ["https://app.example.com/auth/callback"],
        logoutUrls: ["https://app.example.com"],
      },
    });
  }
}
