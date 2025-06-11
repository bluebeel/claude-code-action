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

## Additional Resources

- [Bitbucket API Documentation](https://developer.atlassian.com/cloud/bitbucket/rest/)
- [Bitbucket Pipelines Documentation](https://support.atlassian.com/bitbucket-cloud/docs/bitbucket-pipelines-configuration-reference/)
- [Bitbucket Webhooks](https://support.atlassian.com/bitbucket-cloud/docs/manage-webhooks/)