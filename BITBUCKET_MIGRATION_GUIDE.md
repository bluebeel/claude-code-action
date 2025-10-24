# Bitbucket Pipeline Migration Guide

This guide outlines the necessary changes to migrate the Claude Code GitHub Action to work with Bitbucket Pipelines.

## Overview

The migration from GitHub Actions to Bitbucket Pipelines requires significant architectural changes due to fundamental differences between the platforms:

### Key Differences

1. **Event System**: GitHub Actions has native support for issue/PR comment events, while Bitbucket requires webhooks or API polling
2. **Authentication**: Bitbucket uses different authentication mechanisms (App passwords, OAuth, JWT)
3. **API Structure**: Different API endpoints and data structures
4. **CI/CD Syntax**: Different YAML syntax and features

## Required Changes

### 1. Infrastructure Changes

#### a. Pipeline Configuration
- Created `bitbucket-pipelines.yml` to replace GitHub Actions workflow
- Bitbucket doesn't support comment-triggered pipelines natively
- Need to implement webhook receiver or polling mechanism

#### b. Authentication
Replace GitHub App authentication with Bitbucket equivalent:
- Use Bitbucket App passwords or OAuth for API access
- No direct equivalent to GitHub's OIDC for cloud providers
- Need to store credentials as repository variables

### 2. Code Changes Needed

While the core logic in `src/` can remain mostly unchanged, the following adaptations are required:

#### a. API Client Replacement
**Files to modify:**
- `src/github/api/client.ts` → Create `src/bitbucket/api/client.ts`
- `src/github/api/queries/github.ts` → Create Bitbucket GraphQL/REST queries

**Changes needed:**
- Replace Octokit with Bitbucket API client
- Adapt all API calls to Bitbucket's REST API v2
- Update authentication headers and methods

#### b. Context Parsing
**Files to modify:**
- `src/github/context.ts` → Create `src/bitbucket/context.ts`

**Changes needed:**
- Parse Bitbucket pipeline environment variables instead of GitHub context
- Map Bitbucket webhook payloads to expected format
- Handle different event types (PR created, updated, commented)

#### c. Data Fetching
**Files to modify:**
- `src/github/data/fetcher.ts` → Create `src/bitbucket/data/fetcher.ts`
- `src/github/data/formatter.ts` → Adapt for Bitbucket data structures

**Changes needed:**
- Fetch PR/issue data from Bitbucket API
- Transform Bitbucket data structures to match expected format
- Handle different comment/review structures

#### d. Operations
**Files to modify:**
- All files in `src/github/operations/` → Create Bitbucket equivalents

**Changes needed:**
- Branch operations using Bitbucket API
- Comment creation/updates via Bitbucket API
- Different permission checks

### 3. Trigger Mechanism

Since Bitbucket doesn't support comment-triggered pipelines natively, implement one of these approaches:

#### Option A: Webhook Receiver (Recommended)
1. Deploy a webhook receiver service (e.g., AWS Lambda, Google Cloud Function)
2. Configure Bitbucket webhooks to send PR/comment events
3. Receiver checks for trigger phrase and triggers pipeline via API

#### Option B: Polling Approach
1. Set up scheduled pipeline (e.g., every 5 minutes)
2. Check recent PR comments for trigger phrase
3. Process unhandled triggers

#### Option C: Manual Triggers
1. Use Bitbucket's manual pipeline triggers
2. Users manually run pipeline with parameters

### 4. MCP Server Adaptation

The GitHub MCP server needs replacement:
- Create Bitbucket MCP server with equivalent functionality
- Update file operations to use Bitbucket API
- Adapt commit/PR operations

### 5. Environment Variables Mapping

| GitHub Action | Bitbucket Pipeline |
|---------------|-------------------|
| `GITHUB_TOKEN` | `BITBUCKET_AUTH_TOKEN` |
| `GITHUB_RUN_ID` | `BITBUCKET_BUILD_NUMBER` |
| `GITHUB_REPOSITORY` | `BITBUCKET_REPO_SLUG` |
| `GITHUB_ACTOR` | `BITBUCKET_STEP_TRIGGERER_UUID` |
| `GITHUB_EVENT_NAME` | Custom implementation needed |
| `GITHUB_EVENT_PATH` | Parse from webhook payload |

## Implementation Steps

1. **Phase 1: Infrastructure Setup**
   - Set up Bitbucket pipeline configuration
   - Configure repository variables
   - Set up webhook receiver (if using Option A)

2. **Phase 2: Core Adaptation**
   - Create Bitbucket API client
   - Adapt context parsing
   - Update data fetching logic

3. **Phase 3: Feature Parity**
   - Implement all operations (comments, branches, etc.)
   - Adapt MCP server
   - Handle edge cases

4. **Phase 4: Testing**
   - Test trigger detection
   - Verify API operations
   - Ensure Claude integration works

## Limitations

Some features may not have direct equivalents in Bitbucket:
- No native comment event triggers
- Different permission models
- No OIDC authentication for cloud providers
- Limited CI/CD conditionals compared to GitHub Actions

## Next Steps

1. Choose trigger mechanism approach
2. Set up development environment with Bitbucket repository
3. Begin implementing API client adaptations
4. Test with simple PR comment scenarios

## Implementation Status

### ✅ Completed

#### Phase 1: Infrastructure Setup
- **Webhook Receiver** (`src/bitbucket/webhook-receiver/`)
  - Express server implementation for standalone deployment
  - AWS Lambda handler for serverless deployment
  - Webhook signature verification
  - Trigger phrase detection
  - Pipeline triggering via Bitbucket API

#### Phase 2: Code Adaptation
- **Bitbucket API Client** (`src/bitbucket/api/client.ts`)
  - REST API v2 client implementation
  - PR/Issue/Comment operations
  - Repository and branch operations
  - Pipeline triggering support
  
- **Data Models** (`src/bitbucket/types.ts`)
  - Complete TypeScript types for Bitbucket entities
  - Mapped to GitHub equivalents where possible
  
- **Data Fetcher** (`src/bitbucket/data/fetcher.ts`)
  - Fetch PR data with comments, commits, and diff stats
  - Fetch issue data with comments
  - Pagination support for all endpoints
  
- **Data Formatter** (`src/bitbucket/data/formatter.ts`)
  - Format PR/Issue data for Claude prompts
  - Consistent output format with GitHub version

#### Phase 3: Trigger Mechanism
- **Trigger Validation** (`src/bitbucket/validation/trigger.ts`)
  - Detect trigger phrases in comments
  - User allowlist support
  - Command extraction from comments
  
- **Comment Operations** (`src/bitbucket/operations/comments.ts`)
  - Create/update PR and issue comments
  - Progress tracking with Claude signature
  - Find existing Claude comments
  
- **Branch Operations** (`src/bitbucket/operations/branch.ts`)
  - Create branches for issues
  - Check branch existence
  - Generate branch names

#### Phase 4: Pipeline Updates
- **Pipeline Configuration** (`bitbucket-pipelines.yml`)
  - Environment variable validation step
  - Custom pipeline for webhook triggers
  - Manual trigger pipeline for testing
  - Scheduled polling pipeline option
  
- **Entrypoints** (`src/entrypoints/bitbucket-*.ts`)
  - `bitbucket-prepare.ts`: Main entry point for processing triggers
  - `bitbucket-update-comment.ts`: Update comments with results
  - `bitbucket-poll-triggers.ts`: Poll for new triggers (scheduled approach)
  
- **Deployment Guide** (`docs/BITBUCKET_DEPLOYMENT.md`)
  - Complete deployment instructions
  - Multiple deployment options (webhook, polling, manual)
  - Security considerations

### ❌ Not Implemented

1. **File Operations**
   - Bitbucket doesn't have direct file update APIs
   - Requires commit creation through Source API
   - Would need significant additional work

2. **Pull Request Creation**
   - API exists but not implemented
   - Would need additional methods in branch operations

3. **MCP Server for Bitbucket**
   - Would need complete rewrite of GitHub MCP server
   - File operations would work differently

4. **Review Comments**
   - Inline code review comments
   - Different structure than GitHub

5. **Integration with claude-code-base-action**
   - The main action still expects GitHub context
   - Would need adapter layer or fork

### 🔧 Limitations

1. **No Native Comment Events**
   - Must use webhook receiver or polling
   - Adds deployment complexity

2. **Different Permission Model**
   - Bitbucket uses different auth mechanisms
   - No OIDC support like GitHub

3. **API Differences**
   - No GraphQL API (REST only)
   - Some operations require multiple API calls

### 📋 Setup Instructions

See [`docs/BITBUCKET_DEPLOYMENT.md`](docs/BITBUCKET_DEPLOYMENT.md) for complete deployment instructions.

#### Quick Start

1. **Deploy Webhook Receiver** (choose one):
   - AWS Lambda: See deployment guide
   - Google Cloud Functions: See deployment guide
   - Standalone server: `cd src/bitbucket/webhook-receiver && npm start`

2. **Configure Bitbucket**:
   - Add webhook pointing to receiver
   - Set repository variables (see deployment guide)

3. **Test Integration**:
   - Create PR and comment with `@claude test`
   - Check Pipelines page for execution

## Additional Resources

- [Bitbucket API Documentation](https://developer.atlassian.com/cloud/bitbucket/rest/)
- [Bitbucket Pipelines Documentation](https://support.atlassian.com/bitbucket-cloud/docs/bitbucket-pipelines-configuration-reference/)
- [Bitbucket Webhooks](https://support.atlassian.com/bitbucket-cloud/docs/manage-webhooks/)