# Bitbucket Webhook Receiver

This webhook receiver enables comment-triggered pipelines for Bitbucket, mimicking GitHub's native comment event support.

## Overview

The webhook receiver listens for Bitbucket PR comment events and triggers pipelines when it detects the configured trigger phrase (default: `@claude`).

## Deployment Options

### Option 1: AWS Lambda

1. Build the Lambda function:
   ```bash
   npm run build
   zip -r webhook-lambda.zip lambda.js node_modules/
   ```

2. Create Lambda function with API Gateway trigger
3. Set environment variables:
   - `BITBUCKET_WEBHOOK_SECRET`: Secret for webhook verification
   - `TRIGGER_PHRASE`: Trigger phrase (default: @claude)
   - `BITBUCKET_PIPELINE_TOKEN`: Token for triggering pipelines

4. Configure Bitbucket webhook to point to API Gateway URL

### Option 2: Google Cloud Functions

1. Deploy using gcloud CLI:
   ```bash
   gcloud functions deploy bitbucket-webhook \
     --runtime nodejs20 \
     --trigger-http \
     --allow-unauthenticated \
     --entry-point handler \
     --set-env-vars BITBUCKET_WEBHOOK_SECRET=xxx,TRIGGER_PHRASE=@claude
   ```

### Option 3: Standalone Server

1. Build and run:
   ```bash
   npm install
   npm run build
   npm start
   ```

2. Use a process manager like PM2 for production:
   ```bash
   pm2 start server.js --name bitbucket-webhook
   ```

## Bitbucket Configuration

1. Go to Repository Settings > Webhooks
2. Add webhook with URL pointing to your deployment
3. Select events:
   - Pull request: Comment created
   - Pull request: Comment updated

## Environment Variables

- `BITBUCKET_WEBHOOK_SECRET`: Secret for webhook signature verification
- `TRIGGER_PHRASE`: Phrase to trigger pipeline (default: @claude)
- `BITBUCKET_AUTH_TOKEN`: Bitbucket API authentication token
- `BITBUCKET_PIPELINE_TOKEN`: Token for triggering pipelines via API
- `PORT`: Port for standalone server (default: 3000)

## Security

- Always use webhook signature verification in production
- Use HTTPS for webhook endpoints
- Restrict API tokens to minimum required permissions