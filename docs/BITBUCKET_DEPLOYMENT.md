# Bitbucket Deployment Guide

This guide walks through deploying Claude Code Action for Bitbucket repositories.

## Prerequisites

1. Bitbucket repository with Pipelines enabled
2. Anthropic API key for Claude
3. Bitbucket App password or OAuth token with these permissions:
   - Pull requests: Read and Write
   - Issues: Read and Write (if using issue triggers)
   - Pipelines: Write (for triggering)
   - Webhooks: Admin (for webhook setup)

## Deployment Options

### Option A: Webhook Receiver (Recommended)

This approach provides real-time responses to comment triggers.

#### 1. Deploy Webhook Receiver

##### AWS Lambda Deployment

```bash
cd src/bitbucket/webhook-receiver

# Install dependencies
npm install

# Build TypeScript
npm run build

# Create deployment package
zip -r webhook-lambda.zip lambda.js node_modules/

# Deploy using AWS CLI
aws lambda create-function \
  --function-name bitbucket-claude-webhook \
  --runtime nodejs20.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler lambda.handler \
  --zip-file fileb://webhook-lambda.zip \
  --environment Variables="{
    BITBUCKET_WEBHOOK_SECRET=your-secret,
    TRIGGER_PHRASE=@claude,
    BITBUCKET_PIPELINE_TOKEN=your-pipeline-token
  }"

# Create API Gateway trigger
aws apigatewayv2 create-api \
  --name bitbucket-claude-webhook \
  --protocol-type HTTP \
  --target arn:aws:lambda:REGION:ACCOUNT:function:bitbucket-claude-webhook
```

##### Google Cloud Functions Deployment

```bash
cd src/bitbucket/webhook-receiver

gcloud functions deploy bitbucket-claude-webhook \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point handler \
  --source . \
  --set-env-vars "BITBUCKET_WEBHOOK_SECRET=your-secret,TRIGGER_PHRASE=@claude,BITBUCKET_PIPELINE_TOKEN=your-token"
```

#### 2. Configure Bitbucket Webhook

1. Go to Repository Settings → Webhooks
2. Click "Add webhook"
3. Configure:
   - **URL**: Your deployed webhook endpoint
   - **Triggers**: 
     - Pull request: Comment created
     - Pull request: Comment updated
     - Issue: Comment created (optional)
   - **Secret**: Same as `BITBUCKET_WEBHOOK_SECRET`

#### 3. Set Repository Variables

In Repository Settings → Pipelines → Repository variables:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
BITBUCKET_AUTH_TOKEN=your-app-password

# Optional
TRIGGER_PHRASE=@claude
ALLOWED_TOOLS=read_file,write_file,run_command
DISALLOWED_TOOLS=delete_file
CUSTOM_INSTRUCTIONS="Always format code with prettier"
ALLOWED_USERS=user1,user2
```

### Option B: Polling Approach

Use this if you can't deploy a webhook receiver.

#### 1. Enable Scheduled Pipeline

In your `bitbucket-pipelines.yml`, the scheduled pipeline is already configured:

```yaml
schedules:
  - cron: "*/10 * * * *"  # Every 10 minutes
    pipelines:
      - step:
          name: Poll for Claude Triggers
          # ... (already configured)
```

#### 2. Configure Schedule

1. Go to Repository Settings → Pipelines → Schedules
2. Add new schedule:
   - **Branch**: main (or your default branch)
   - **Pipeline**: Select the polling pipeline
   - **Schedule**: Every 10 minutes (or as needed)

### Option C: Manual Triggers

For testing or low-volume usage:

1. Go to Pipelines → Run pipeline
2. Select "Custom: claude-manual"
3. Add variables:
   - `CLAUDE_PR_NUMBER`: PR number to process
   - `CLAUDE_COMMENT_ID`: Comment ID (optional)

## Testing the Integration

### 1. Create a Test PR

```bash
git checkout -b test-claude
echo "test" > test.txt
git add test.txt
git commit -m "Test Claude integration"
git push origin test-claude
```

Create PR via Bitbucket UI.

### 2. Trigger Claude

Comment on the PR:
```
@claude Can you review this change?
```

### 3. Monitor Pipeline

- Check Pipelines page for execution
- Claude should post a comment within 1-2 minutes

## Security Considerations

1. **Token Security**:
   - Use Bitbucket App passwords, not personal passwords
   - Limit token permissions to minimum required
   - Rotate tokens regularly

2. **Webhook Security**:
   - Always verify webhook signatures
   - Use HTTPS endpoints only
   - Implement rate limiting

3. **User Restrictions**:
   - Set `ALLOWED_USERS` to limit who can trigger Claude
   - Review trigger commands in untrusted repositories

## Troubleshooting

### Pipeline Not Triggering

1. Check webhook delivery history in Bitbucket
2. Verify environment variables are set
3. Check pipeline logs for errors

### Claude Not Responding

1. Verify `ANTHROPIC_API_KEY` is valid
2. Check comment contains trigger phrase
3. Ensure user has permissions

### Authentication Errors

1. Verify `BITBUCKET_AUTH_TOKEN` has required permissions
2. Check token hasn't expired
3. Ensure workspace/repo names are correct

## Migration from GitHub

If migrating from GitHub Actions:

1. Map environment variables (see migration guide)
2. Update any custom scripts referencing GitHub APIs
3. Test thoroughly with non-critical repositories first

## Advanced Configuration

### Custom MCP Servers

To use Bitbucket-specific MCP servers:

1. Implement Bitbucket file operations server
2. Update MCP configuration
3. Set `MCP_CONFIG` environment variable

### Multi-Repository Setup

For organizations with multiple repositories:

1. Deploy webhook receiver once
2. Configure webhook on each repository
3. Use repository variables for repo-specific settings

### Pipeline Optimization

To reduce pipeline execution time:

1. Cache dependencies aggressively
2. Use parallel steps where possible
3. Minimize artifact size