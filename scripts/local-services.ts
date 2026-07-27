import http from 'http';
import jwt from 'jsonwebtoken';

const DYNAMODB_PORT = 8000;
const COGNITO_PORT = 9229;

// In-memory data store for local real-time execution without Docker dependency
const users = new Map<string, { email: string; passwordHash: string; sub: string }>();
const tables = new Set<string>(['StudentAttendance']);
const itemsByTable = new Map<string, Array<Record<string, any>>>();

itemsByTable.set('StudentAttendance', []);

const JWT_SECRET = 'local-dev-jwt-secret-key-123456789';

// -------------------------------------------------------------
// COGNITO LOCAL EMULATOR (PORT 9229)
// -------------------------------------------------------------
const cognitoServer = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    const target = req.headers['x-amz-target'] as string || '';
    const parsedBody = body ? JSON.parse(body) : {};

    res.setHeader('Content-Type', 'application/x-amz-json-1.1');

    if (target.endsWith('.SignUp')) {
      const { Username, Password } = parsedBody;
      const sub = `user-sub-${Date.now()}`;
      users.set(Username, { email: Username, passwordHash: Password, sub });

      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          UserSub: sub,
          UserConfirmed: true,
          CodeDeliveryDetails: null,
        })
      );
    }

    if (target.endsWith('.AdminConfirmSignUp')) {
      res.statusCode = 200;
      return res.end(JSON.stringify({}));
    }

    if (target.endsWith('.InitiateAuth')) {
      const username = parsedBody.AuthParameters?.USERNAME;
      const password = parsedBody.AuthParameters?.PASSWORD;

      const user = users.get(username);
      if (!user || user.passwordHash !== password) {
        // Allow auto-signup if user wasn't pre-created in dev test environment
        const sub = user?.sub || `user-sub-${Date.now()}`;
        if (!user) {
          users.set(username, { email: username, passwordHash: password, sub });
        }
      }

      const activeSub = users.get(username)?.sub || `user-${Date.now()}`;
      const token = jwt.sign(
        {
          sub: activeSub,
          email: username,
          username: username,
          token_use: 'access',
          iss: 'http://localhost:9229/us-east-1_localpool',
        },
        JWT_SECRET,
        { expiresIn: '2h' }
      );

      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          AuthenticationResult: {
            AccessToken: token,
            IdToken: token,
            RefreshToken: `refresh-${token}`,
            ExpiresIn: 7200,
            TokenType: 'Bearer',
          },
        })
      );
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({}));
  });
});

cognitoServer.listen(COGNITO_PORT, () => {
  console.log(`✅ Local Cognito Emulator running on http://localhost:${COGNITO_PORT}`);
});

// -------------------------------------------------------------
// DYNAMODB LOCAL EMULATOR (PORT 8000)
// -------------------------------------------------------------
const dynamodbServer = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    const target = req.headers['x-amz-target'] as string || '';
    const parsedBody = body ? JSON.parse(body) : {};

    res.setHeader('Content-Type', 'application/x-amz-json-1.0');

    if (target.endsWith('.CreateTable')) {
      const tableName = parsedBody.TableName;
      tables.add(tableName);
      if (!itemsByTable.has(tableName)) {
        itemsByTable.set(tableName, []);
      }
      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          TableDescription: {
            TableName: tableName,
            TableStatus: 'ACTIVE',
            KeySchema: parsedBody.KeySchema,
          },
        })
      );
    }

    if (target.endsWith('.ListTables')) {
      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          TableNames: Array.from(tables),
        })
      );
    }

    if (target.endsWith('.DescribeTable')) {
      const tableName = parsedBody.TableName;
      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          Table: {
            TableName: tableName,
            TableStatus: 'ACTIVE',
            KeySchema: [
              { AttributeName: 'studentId', KeyType: 'HASH' },
              { AttributeName: 'date', KeyType: 'RANGE' },
            ],
          },
        })
      );
    }

    if (target.endsWith('.PutItem')) {
      const tableName = parsedBody.TableName;
      const rawItem = parsedBody.Item;
      const list = itemsByTable.get(tableName) || [];

      // Upsert by studentId + date
      const studentId = rawItem.studentId?.S;
      const date = rawItem.date?.S;

      const existingIndex = list.findIndex(
        i => i.studentId?.S === studentId && i.date?.S === date
      );

      if (existingIndex >= 0) {
        list[existingIndex] = rawItem;
      } else {
        list.push(rawItem);
      }
      itemsByTable.set(tableName, list);

      res.statusCode = 200;
      return res.end(JSON.stringify({}));
    }

    if (target.endsWith('.Query')) {
      const tableName = parsedBody.TableName;
      const list = itemsByTable.get(tableName) || [];
      const exprValues = parsedBody.ExpressionAttributeValues || {};
      const targetStudentId = exprValues[':studentId']?.S;

      const matching = list.filter(item => item.studentId?.S === targetStudentId);

      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          Count: matching.length,
          ScannedCount: list.length,
          Items: matching,
        })
      );
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({}));
  });
});

dynamodbServer.listen(DYNAMODB_PORT, () => {
  console.log(`✅ Local DynamoDB Emulator running on http://localhost:${DYNAMODB_PORT}`);
});
