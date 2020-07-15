import * as cdk from '@aws-cdk/core';
import * as appsync from '@aws-cdk/aws-appsync';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import { MappingTemplate, PrimaryKey, Values, UserPoolDefaultAction } from '@aws-cdk/aws-appsync';
import * as cognito from '@aws-cdk/aws-cognito';

const SCHEMA_FILE = './schema.graphql';

export interface ApiStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
}

export class ApiStack extends cdk.Stack {
  public readonly api: appsync.GraphQLApi;

  constructor(scope: cdk.Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { userPool } = props;

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
      schemaDefinitionFile: SCHEMA_FILE,
    });

    /**
     * Place
     */
    // this.createPlaceDataSource(placeTable);

    new cdk.CfnOutput(this, 'api-url', { value: this.api.graphQlUrl });
  }

  // createPlaceDataSource(placeTable: dynamodb.Table) {
  //   const placeDS = this.api.addDynamoDbDataSource('Place', 'The Place data source', placeTable);

  //   /**
  //    * Query: allPlaces
  //    */
  //   placeDS.createResolver({
  //     typeName: 'Query',
  //     fieldName: 'allPlaces',
  //     requestMappingTemplate: MappingTemplate.fromString(`
  //       {
  //         "version": "2017-02-28",
  //         "operation": "Scan",
  //         "limit": $util.defaultIfNull($ctx.args.limit, 10),
  //         "nextToken": $util.toJson($util.defaultIfNullOrEmpty($ctx.args.nextToken, null))
  //       }
  //     `),
  //     responseMappingTemplate: MappingTemplate.fromString(`
  //       #**
  //         Scan and Query operations return a list of items and a nextToken. Pass them
  //         to the client for use in pagination.
  //       *#
  //       {
  //         "items": $util.toJson($ctx.result.items),
  //         "nextToken": $util.toJson($util.defaultIfNullOrBlank($context.result.nextToken, null))
  //       }
  //     `),
  //   });

  //   /**
  //    * Query: place
  //    */
  //   placeDS.createResolver({
  //     typeName: 'Query',
  //     fieldName: 'place',
  //     requestMappingTemplate: MappingTemplate.dynamoDbGetItem('placeId', 'placeId'),
  //     responseMappingTemplate: MappingTemplate.dynamoDbResultItem(),
  //   });

  //   /**
  //    * Mutation: createPlace
  //    */
  //   placeDS.createResolver({
  //     typeName: 'Mutation',
  //     fieldName: 'createPlace',
  //     requestMappingTemplate: MappingTemplate.dynamoDbPutItem(
  //       PrimaryKey.partition('placeId').auto(),
  //       Values.projecting('input'),
  //     ),
  //     responseMappingTemplate: MappingTemplate.dynamoDbResultItem(),
  //   });

  //   /**
  //    * Mutation: updatePlace
  //    */
  //   placeDS.createResolver({
  //     typeName: 'Mutation',
  //     fieldName: 'updatePlace',
  //     requestMappingTemplate: MappingTemplate.dynamoDbPutItem(
  //       PrimaryKey.partition('placeId').is('placeId'),
  //       Values.projecting('input'),
  //     ),
  //     responseMappingTemplate: MappingTemplate.dynamoDbResultItem(),
  //   });

  //   /**
  //    * Mutation: deletePlace
  //    */
  //   placeDS.createResolver({
  //     typeName: 'Mutation',
  //     fieldName: 'deletePlace',
  //     requestMappingTemplate: MappingTemplate.dynamoDbDeleteItem('placeId', 'placeId'),
  //     responseMappingTemplate: MappingTemplate.dynamoDbResultItem(),
  //   });
  // }

  getApiKeyExpiration(days: number): string {
    const dateNow = new Date();
    dateNow.setDate(dateNow.getDate() + days);
    return dateNow.toISOString();
  }
}
