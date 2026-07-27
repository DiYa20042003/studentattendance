import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

const region = process.env.AWS_REGION || 'us-east-1';
const endpoint = process.env.COGNITO_ENDPOINT || undefined;

export const cognitoClient = new CognitoIdentityProviderClient({
  region,
  ...(endpoint ? { endpoint } : {}),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
  },
});

export const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'us-east-1_localpool';
export const CLIENT_ID = process.env.COGNITO_CLIENT_ID || 'localappclient12345';
