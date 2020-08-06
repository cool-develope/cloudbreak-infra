import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as appsync from '@aws-cdk/aws-appsync';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import { ITable } from '@aws-cdk/aws-dynamodb';
import { MappingTemplate, PrimaryKey, Values, UserPoolDefaultAction } from '@aws-cdk/aws-appsync';
import * as cognito from '@aws-cdk/aws-cognito';
import * as lambda from '@aws-cdk/aws-lambda';

const SCHEMA_FILE = './schema.graphql';

export interface ApiStackProps extends cdk.StackProps {
  userPoolId: string;
  dictionaryTableName: string;
}

export class ApiStack extends cdk.Stack {
  public readonly api: appsync.GraphQLApi;

  constructor(scope: cdk.Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { userPoolId, dictionaryTableName } = props;
    const userPool = cognito.UserPool.fromUserPoolId(this, 'user-pool', userPoolId);
    const dictionaryTable = dynamodb.Table.fromTableName(
      this,
      'table-dictionary',
      dictionaryTableName,
    );

    /**
     * AppSync API
     */
    this.api = new appsync.GraphQLApi(this, 'api-appsync', {
      name: `tifo-api`,
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool,
            defaultAction: UserPoolDefaultAction.ALLOW,
          },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.API_KEY,
            apiKeyConfig: {
              name: 'test-public-key',
              description: 'Public API_KEY for testing',
              expires: this.getApiKeyExpiration(320),
            },
          },
        ],
      },
      schemaDefinition: appsync.SchemaDefinition.FILE,
      schemaDefinitionFile: SCHEMA_FILE,
    });

    /**
     * Dictionary
     */
    this.createDictionaryDataSource(dictionaryTable);

    new cdk.CfnOutput(this, 'api-url', { value: this.api.graphQlUrl });
  }

  createDictionaryDataSource(dictionaryTable: ITable) {
    const dictionaryFunction = new lambda.Function(this, 'dictionary', {
      functionName: 'api-dictionary',
      code: lambda.Code.fromAsset(path.join(__dirname, '../', 'functions', 'api', 'dictionary')),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      environment: {},
    });

    dictionaryTable.grantReadData(dictionaryFunction);

    const dictionaryDS = this.api.addLambdaDataSource('dictionaryFunction', '', dictionaryFunction);

    /**
     * Query: countries
     */
    dictionaryDS.createResolver({
      typeName: 'Query',
      fieldName: 'countries',
      requestMappingTemplate: MappingTemplate.fromString(`
        {
          "version" : "2017-02-28",
          "operation": "Invoke",
          "payload": {
            "field": "countries",
            "arguments":  $utils.toJson($context.arguments)
          }
        }
      `),
      responseMappingTemplate: MappingTemplate.fromString(`
        $util.toJson($context.result)
      `),
    });

    /**
     * Query: languages
     */
    dictionaryDS.createResolver({
      typeName: 'Query',
      fieldName: 'languages',
      requestMappingTemplate: MappingTemplate.fromString(`
        {
          "version" : "2017-02-28",
          "operation": "Invoke",
          "payload": {
            "field": "languages",
            "arguments":  $utils.toJson($context.arguments)
          }
        }
      `),
      responseMappingTemplate: MappingTemplate.fromString(`
        $util.toJson($context.result)
      `),
    });

    // dictionaryDS.createResolver({
    //   typeName: 'Query',
    //   fieldName: 'countries',
    //   requestMappingTemplate: MappingTemplate.fromString(`
    //     {
    //       "version": "2017-02-28",
    //       "operation": "Scan",
    //       "limit": $util.defaultIfNull($ctx.args.limit, 10),
    //       "nextToken": $util.toJson($util.defaultIfNullOrEmpty($ctx.args.nextToken, null))
    //     }
    //   `),
    //   responseMappingTemplate: MappingTemplate.fromString(`
    //     #**
    //       Scan and Query operations return a list of items and a nextToken. Pass them
    //       to the client for use in pagination.
    //     *#
    //     {
    //       "items": $util.toJson($ctx.result.items),
    //       "nextToken": $util.toJson($util.defaultIfNullOrBlank($context.result.nextToken, null))
    //     }
    //   `),
    // });

    /**
     * Query: place
     */
    // placeDS.createResolver({
    //   typeName: 'Query',
    //   fieldName: 'place',
    //   requestMappingTemplate: MappingTemplate.dynamoDbGetItem('placeId', 'placeId'),
    //   responseMappingTemplate: MappingTemplate.dynamoDbResultItem(),
    // });

    /**
     * Mutation: createPlace
     */
    // placeDS.createResolver({
    //   typeName: 'Mutation',
    //   fieldName: 'createPlace',
    //   requestMappingTemplate: MappingTemplate.dynamoDbPutItem(
    //     PrimaryKey.partition('placeId').auto(),
    //     Values.projecting('input'),
    //   ),
    //   responseMappingTemplate: MappingTemplate.dynamoDbResultItem(),
    // });

    /**
     * Mutation: updatePlace
     */
    // placeDS.createResolver({
    //   typeName: 'Mutation',
    //   fieldName: 'updatePlace',
    //   requestMappingTemplate: MappingTemplate.dynamoDbPutItem(
    //     PrimaryKey.partition('placeId').is('placeId'),
    //     Values.projecting('input'),
    //   ),
    //   responseMappingTemplate: MappingTemplate.dynamoDbResultItem(),
    // });

    /**
     * Mutation: deletePlace
     */
    // placeDS.createResolver({
    //   typeName: 'Mutation',
    //   fieldName: 'deletePlace',
    //   requestMappingTemplate: MappingTemplate.dynamoDbDeleteItem('placeId', 'placeId'),
    //   responseMappingTemplate: MappingTemplate.dynamoDbResultItem(),
    // });
  }

  getApiKeyExpiration(days: number): string {
    const dateNow = new Date();
    dateNow.setDate(dateNow.getDate() + days);
    return dateNow.toISOString();
  }
}
