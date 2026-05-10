import 'dotenv/config'
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'

const client = new DynamoDBClient({ region: process.env.AWS_REGION })

async function peek(tableName: string) {
  console.log(`\n=== ${tableName} ===`)
  const res = await client.send(
    new ScanCommand({ TableName: tableName, Limit: 2 }),
  )
  console.log(`Total scanned (this page): ${res.Items?.length ?? 0}`)
  for (const item of res.Items ?? []) {
    console.log(JSON.stringify(unmarshall(item), null, 2))
  }
}

await peek('tasks-prod')
await peek('history-prod')
