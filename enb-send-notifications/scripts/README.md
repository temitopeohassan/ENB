# FID Batch Fetcher Script

This script fetches all FIDs from your Redis database and organizes them into batches of 99 for easy processing.

## Features

- 🔍 **Scans Redis**: Finds all FID keys matching the pattern `fid:*:notifications`
- 📦 **Batch Processing**: Groups FIDs into batches of 99 (configurable)
- 📊 **Detailed Output**: Shows batch information with FID counts and previews
- 💾 **Export Support**: Can export results to JSON files
- ⚡ **Fast Execution**: Uses efficient Redis scanning
- 🔧 **Environment Aware**: Uses the same Redis configuration as your main app

## Prerequisites

Make sure you have your Redis environment variables set up:

```bash
# Preferred (Upstash standard)
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here

# Or fallback (legacy)
REDIS_URL=https://your-database.upstash.io
REDIS_TOKEN=your-token-here
```

## Usage

### Basic Usage

```bash
# Run the script to display FIDs in batches
npm run fetch-fids

# Or run directly with node
node scripts/fetch-fids-batch.js
```

### Export to File

```bash
# Export with default filename (includes date)
npm run fetch-fids:export

# Export with custom filename
node scripts/fetch-fids-batch.js --export --file=my-fids.json

# Export with short flag
node scripts/fetch-fids-batch.js -e --file=production-fids.json
```

## Output Format

### Console Output

```
🚀 FID Batch Fetcher
==================
🔍 Checking environment variables...
   UPSTASH_REDIS_REST_URL: ✅ Set
   REDIS_URL: ❌ Not set
   UPSTASH_REDIS_REST_TOKEN: ✅ Set
   REDIS_TOKEN: ❌ Not set
✅ Redis client initialized
🔍 Testing Redis connection...
✅ Redis connection test successful
🔍 Scanning for FID keys...
📊 Found 247 FID keys
📋 Extracted 247 unique FIDs

🎉 FID Fetch Complete!
==================================================
📊 Total FIDs found: 247
📦 Total batches created: 3
⏱️  Execution time: 1250ms
==================================================

📋 Batch Details:
------------------------------

📦 Batch 1:
   Count: 99 FIDs
   FIDs: 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010
   FIDs (last 10): 1091, 1092, 1093, 1094, 1095, 1096, 1097, 1098, 1099, 1100
   ... and 79 more FIDs in between

📦 Batch 2:
   Count: 99 FIDs
   FIDs: 1101, 1102, 1103, 1104, 1105, 1106, 1107, 1108, 1109, 1110
   FIDs (last 10): 1191, 1192, 1193, 1194, 1195, 1196, 1197, 1198, 1199, 1200
   ... and 79 more FIDs in between

📦 Batch 3:
   Count: 49 FIDs
   FIDs: 1201, 1202, 1203, 1204, 1205, 1206, 1207, 1208, 1209, 1210
   FIDs (last 10): 1241, 1242, 1243, 1244, 1245, 1246, 1247, 1248, 1249, 1250
   ... and 29 more FIDs in between
```

### JSON Export Format

When exported, the script creates a JSON file with this structure:

```json
{
  "metadata": {
    "exportedAt": "2024-01-15T10:30:00.000Z",
    "totalFIDs": 247,
    "totalBatches": 3,
    "batchSize": 99,
    "executionTime": 1250
  },
  "batches": [
    {
      "batchNumber": 1,
      "fids": [1001, 1002, 1003, ...],
      "count": 99
    },
    {
      "batchNumber": 2,
      "fids": [1101, 1102, 1103, ...],
      "count": 99
    },
    {
      "batchNumber": 3,
      "fids": [1201, 1202, 1203, ...],
      "count": 49
    }
  ]
}
```

## Command Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `--export` or `-e` | Export results to JSON file | `--export` |
| `--file=filename` | Specify custom filename for export | `--file=my-fids.json` |

## File Locations

- **Script**: `scripts/fetch-fids-batch.js`
- **TypeScript Version**: `scripts/fetch-fids-batch.ts`
- **Exports**: `scripts/exports/` (created automatically)
- **Documentation**: `scripts/README.md`

## How It Works

1. **Connection**: Connects to Redis using your environment variables
2. **Scanning**: Uses `KEYS fid:*:notifications` to find all FID-related keys
3. **Extraction**: Extracts FID numbers from the key names using regex
4. **Sorting**: Sorts FIDs numerically for consistent ordering
5. **Batching**: Groups FIDs into batches of 99 (or fewer for the last batch)
6. **Output**: Displays results in a readable format

## Redis Key Pattern

The script looks for keys matching this pattern:
```
fid:{fid}:notifications
```

Examples:
- `fid:1001:notifications`
- `fid:12345:notifications`
- `fid:999999:notifications`

## Error Handling

The script includes comprehensive error handling:

- ✅ **Environment Variables**: Checks for required Redis credentials
- ✅ **Connection Testing**: Tests Redis connection before scanning
- ✅ **Key Validation**: Validates FID extraction from keys
- ✅ **Graceful Failures**: Provides clear error messages

## Performance Notes

- **Scanning**: Uses `KEYS` command which can be slow on large databases
- **Memory**: Loads all FIDs into memory for sorting and batching
- **Network**: Single Redis connection for all operations

For very large databases (10,000+ FIDs), consider:
- Running during off-peak hours
- Using Redis SCAN instead of KEYS (future enhancement)
- Processing in smaller chunks

## Troubleshooting

### Common Issues

1. **"Missing Redis credentials"**
   - Check your environment variables
   - Ensure either Upstash or legacy variables are set

2. **"Redis connection failed"**
   - Verify your Redis URL and token
   - Check network connectivity
   - Ensure Redis database is active

3. **"No FIDs found"**
   - Check if you have any notifications stored
   - Verify the key pattern matches your data structure

### Debug Mode

For more detailed logging, you can modify the script to add debug output or check the Redis connection manually.

## Integration

This script can be integrated into:
- **CI/CD Pipelines**: Export FIDs for batch processing
- **Data Analysis**: Get FID lists for analytics
- **Migration Scripts**: Process FIDs in batches
- **Monitoring**: Track FID growth over time

## Future Enhancements

Potential improvements:
- [ ] Use Redis SCAN for better performance
- [ ] Add filtering options (date ranges, status)
- [ ] Support for different batch sizes
- [ ] CSV export format
- [ ] Progress indicators for large datasets
