# Cloud Infrastructure of TIFO

## AWS Services

- Lambda
- Cognito
- DynamoDB
- DynamoDB Streams
- Elasticsearch
- AppSync
- API Gateway HTTP
- S3
- SES
- SNS
- EventBridge
- CloudFront
- Route53
- ACM

## Architecture

## Commands

- `npm run build` compile typescript to js
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template
- `cdk ls` lists all stacks in the app

## AWS CDK Bootsteap

```shell
export TIFO_ENV=test
npm run build && cdk synth
cdk bootstrap --profile tifo-$TIFO_ENV
```

## Deployment

```shell
cdk deploy acm-us-stack --profile tifo-$TIFO_ENV
cdk deploy acm-eu-stack --profile tifo-$TIFO_ENV
cdk deploy layers-stack --profile tifo-$TIFO_ENV
cdk deploy es-stack --profile tifo-$TIFO_ENV
cdk deploy table-stack --profile tifo-$TIFO_ENV
cdk deploy admin-website-stack --profile tifo-$TIFO_ENV
cdk deploy mobile-website-stack --profile tifo-$TIFO_ENV
cdk deploy images-storage-stack --profile tifo-$TIFO_ENV
cdk deploy private-storage-stack --profile tifo-$TIFO_ENV
cdk deploy cognito-stack --profile tifo-$TIFO_ENV
cdk deploy events-stack --profile tifo-$TIFO_ENV
cdk deploy hapi-stack --profile tifo-$TIFO_ENV
cdk deploy api-stack --profile tifo-$TIFO_ENV
cdk deploy api2-stack --profile tifo-$TIFO_ENV
cdk deploy api-domain-stack --profile tifo-$TIFO_ENV
```

## Manual installation

- Route53
  - tifo-sport.com
- SES
  - no-reply@tifo-sport.com (eu-central-1)
- ACM
  - Click "Add to Route53"
- SNS
  - SenderID: Tifo
  - Budget

## AWS CLI commands

- Cognito

  ```shell
  aws cognito-idp list-user-pools\
    --max-results 20\
    --profile tifo-$TIFO_ENV

  aws cognito-idp list-user-pool-clients\
    --user-pool-id XXX-XXX \
    --max-results 20\
    --profile tifo-$TIFO_ENV
  ```

- ACM
  ```shell
  aws acm list-certificates\
    --max-items 20\
    --region us-east-1\
    --profile tifo-$TIFO_ENV
  ```
