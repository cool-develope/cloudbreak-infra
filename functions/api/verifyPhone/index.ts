// @ts-ignore
import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';

const db = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();
const { MAIN_TABLE_NAME = '' } = process.env;

enum FieldName {
  verifyPhone = 'verifyPhone',
  sendPhoneVerification = 'sendPhoneVerification',
}

const getRandomInteger = (min: number, max: number) =>
  Math.round(Math.random() * (max - min) + min);

const randomDigits = (len: number): string =>
  new Array(len)
    .fill(0)
    .map(() => getRandomInteger(0, 9))
    .join('');

const getUpdateExpression = (attributes: any = {}) =>
  Object.keys(attributes)
    .map((key) =>
      attributes[key] !== undefined && attributes[key] !== null ? `${key} = :${key}` : null,
    )
    .filter((attr) => !!attr)
    .join(', ');

const getExpressionAttributeValues = (attributes = {}) => {
  const obj: any = {};
  Object.entries(attributes).forEach(([key, value]) =>
    value !== undefined && value !== null ? (obj[`:${key}`] = value) : null,
  );
  return obj;
};

const updateItem = (pk: string, sk: string, attributes: any) => {
  const condition = 'SET ' + getUpdateExpression(attributes);
  const values = getExpressionAttributeValues(attributes);

  const params = {
    TableName: MAIN_TABLE_NAME,
    Key: { pk, sk },
    UpdateExpression: condition,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  };

  return db.update(params).promise();
};

const queryItems = (pk: string, sk: string) => {
  const params = {
    TableName: MAIN_TABLE_NAME,
    KeyConditionExpression: 'pk = :pk and begins_with(sk, :sk)',
    ExpressionAttributeValues: {
      ':pk': pk,
      ':sk': sk,
    },
  };

  return db.query(params).promise();
};

const sendPhoneVerification = async (sub: string, phoneNumber: string) => {
  const errors: string[] = [];
  const code = randomDigits(5);

  /**
   * TODO: validate phone number
   * TODO: check frequiecy of sending
   * TODO: move to EventBridge
   */

  const params = {
    Message: `Verification code: ${code}`,
    PhoneNumber: phoneNumber,
  };

  try {
    const result = await sns.publish(params).promise();
    await updateItem(`user#${sub}`, `phone-verification#${uuidv4()}`, {
      code,
      createdAt: new Date().toISOString(),
      verified: false,
      phoneNumber,
    });
  } catch (err) {
    errors.push(err.code);
    console.log('sendPhoneVerification', {
      phoneNumber,
      err,
    });
  }

  return {
    errors,
  };
};

const verifyPhone = async (sub: string, phoneNumber: string, code: string) => {
  /**
   * TODO: is phone already verified
   * TODO: expired in XX min
   */

  const errors: string[] = [];
  let verified = false;
  const { Items } = await queryItems(`user#${sub}`, 'phone-verification#');

  if (Items && Items.length > 0) {
    // @ts-ignore
    const [lastVerification] = Items.filter(
      (item: any) => !item.verified && item.phoneNumber === phoneNumber && item.code === code,
    ).sort(
      // @ts-ignore
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );

    if (lastVerification) {
      verified = true;

      await updateItem(lastVerification.pk, lastVerification.sk, {
        modifiedAt: new Date().toISOString(),
        verified,
      });

      await updateItem(lastVerification.pk, 'metadata', {
        phone: phoneNumber,
      });
    } else {
      errors.push("Can't find pending verifications");
    }
  } else {
    errors.push("Can't find pending verifications");
  }

  return {
    errors,
    verified,
  };
};

export const handler: Handler = async (event) => {
  const {
    arguments: {
      input: { phoneNumber = '', code = '' },
    },
    identity: { sub },
    info: { fieldName },
  } = event;

  const field = fieldName as FieldName;

  if (field === FieldName.sendPhoneVerification) {
    return await sendPhoneVerification(sub, phoneNumber);
  } else if (field === FieldName.verifyPhone) {
    return await verifyPhone(sub, phoneNumber, code);
  }

  return {
    errors: [`Unhandled request`],
  };
};
