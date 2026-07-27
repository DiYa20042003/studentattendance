import {
  DynamoDBClient,
  CreateTableCommand,
  ListTablesCommand,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";

const region = process.env.AWS_REGION || "us-east-1";
const endpoint = process.env.DYNAMODB_ENDPOINT || "http://localhost:8000";
const tableName = process.env.DYNAMODB_TABLE_NAME || "StudentAttendance";

const ddbClient = new DynamoDBClient({
  region,
  endpoint,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local",
  },
});

async function main() {
  console.log(`🔍 Connecting to DynamoDB at endpoint: ${endpoint}...`);

  try {
    const listResult = await ddbClient.send(new ListTablesCommand({}));
    const tables = listResult.TableNames || [];

    if (tables.includes(tableName)) {
      console.log(`✅ Table "${tableName}" already exists.`);
    } else {
      console.log(`🛠️ Creating table "${tableName}"...`);
      await ddbClient.send(
        new CreateTableCommand({
          TableName: tableName,
          AttributeDefinitions: [
            { AttributeName: "studentId", AttributeType: "S" },
            { AttributeName: "date", AttributeType: "S" },
          ],
          KeySchema: [
            { AttributeName: "studentId", KeyType: "HASH" },
            { AttributeName: "date", KeyType: "RANGE" },
          ],
          BillingMode: "PAY_PER_REQUEST",
        })
      );
      console.log(`✅ Table "${tableName}" created successfully!`);
    }

    const describe = await ddbClient.send(
      new DescribeTableCommand({ TableName: tableName })
    );
    console.log(`📊 Table Details:
    - Name: ${describe.Table?.TableName}
    - Status: ${describe.Table?.TableStatus}
    - Key Schema: ${JSON.stringify(describe.Table?.KeySchema)}`);

    console.log("\n🚀 Local AWS setup complete!");
  } catch (error) {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  }
}

main();
