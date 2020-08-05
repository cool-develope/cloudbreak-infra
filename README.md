# Cloud Infrastructure of TIFO

## Services

- Lambda
- Cognito
- DynamoDB
- AppSync
- S3
- CloudFront
  - api.tifo-sport.com
- Route53
  - api.tifo-sport.com
- ACM
  - tifo-sport.com
  - \*.tifo-sport.com

## Architecture

## Commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template

## AWS CDK Bootsteap

```shell
cdk bootstrap --profile tifo-dev
cdk bootstrap --profile tifo-prod
```

## Deploy Dev env

```shell
export TIFO_ENV=dev
npm run build
cdk synth
cdk deploy acm-us-stack  --profile tifo-dev
// set usCertificateArn
cdk deploy '*' --profile tifo-dev
```

## Deploy Prod env

```shell
export TIFO_ENV=prod
npm run build
cdk synth
cdk deploy acm-us-stack  --profile tifo-prod
// set usCertificateArn
cdk deploy '*' --profile tifo-prod
```

## Manual installation

- Route53
  - tifo-sport.com
- SES
  - no-reply@tifo-sport.com (eu-central-1)
  - no-reply@tifo-sport.com (eu-west-1) - used in Cognito
- AppSync
  - API keys - increase Expires date