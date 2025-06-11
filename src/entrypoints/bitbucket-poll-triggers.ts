#!/usr/bin/env bun

import { BitbucketContextParser } from "../bitbucket/context";
import { BitbucketOperations } from "../bitbucket/operations";
import { createBitbucketClient } from "../bitbucket/api/client";
import * as fs from "fs/promises";
import * as path from "path";

// Track processed triggers to avoid duplicates
const PROCESSED_TRIGGERS_FILE = ".processed-triggers.json";

interface ProcessedTrigger {
  commentId: number;
  timestamp: number;
}

async function main() {
  try {
    console.log("🔍 Polling for Bitbucket Claude triggers...");

    // Get configuration
    const authToken = BitbucketContextParser.getAuthToken();
    const triggerPhrase = BitbucketContextParser.getTriggerPhrase();
    const workspace = process.env.BITBUCKET_WORKSPACE!;
    const repoSlug = process.env.BITBUCKET_REPO_SLUG!;

    if (!workspace || !repoSlug) {
      console.error("❌ Missing BITBUCKET_WORKSPACE or BITBUCKET_REPO_SLUG");
      process.exit(1);
    }

    // Initialize operations
    const operations = new BitbucketOperations(authToken, { triggerPhrase });
    
    // Load processed triggers
    const processedTriggers = await loadProcessedTriggers();
    
    // Check for triggers in recent PRs
    await checkPullRequests(operations, workspace, repoSlug, processedTriggers);
    
    // Check for triggers in recent issues
    await checkIssues(operations, workspace, repoSlug, processedTriggers);
    
    // Save updated processed triggers
    await saveProcessedTriggers(processedTriggers);
    
    console.log("✅ Polling complete");

  } catch (error) {
    console.error("❌ Polling error:", error);
    process.exit(1);
  }
}

async function checkPullRequests(
  operations: BitbucketOperations,
  workspace: string,
  repoSlug: string,
  processedTriggers: ProcessedTrigger[]
) {
  console.log("📋 Checking pull requests...");
  
  // Get recent open PRs
  const prs = await operations.client.request(
    `/repositories/${workspace}/${repoSlug}/pullrequests?state=OPEN&pagelen=10`
  ) as any;

  for (const pr of prs.values) {
    console.log(`  Checking PR #${pr.id}...`);
    
    // Get PR comments
    const comments = await operations.dataFetcher.fetchPullRequestData(
      workspace,
      repoSlug,
      pr.id
    ).then(data => data.comments);

    // Find unprocessed triggers
    const latestTrigger = operations.triggerValidator.findLatestTrigger(comments);
    
    if (latestTrigger.comment && !isProcessed(latestTrigger.comment.id, processedTriggers)) {
      console.log(`  ✨ Found new trigger in PR #${pr.id}`);
      
      // Trigger pipeline via API
      await triggerPipeline(
        operations,
        workspace,
        repoSlug,
        pr.id,
        undefined,
        latestTrigger.comment.id,
        latestTrigger.comment.user.nickname
      );
      
      // Mark as processed
      processedTriggers.push({
        commentId: latestTrigger.comment.id,
        timestamp: Date.now(),
      });
    }
  }
}

async function checkIssues(
  operations: BitbucketOperations,
  workspace: string,
  repoSlug: string,
  processedTriggers: ProcessedTrigger[]
) {
  console.log("📋 Checking issues...");
  
  // Get recent open issues
  const issues = await operations.client.request(
    `/repositories/${workspace}/${repoSlug}/issues?state=open&pagelen=10`
  ) as any;

  for (const issue of issues.values) {
    console.log(`  Checking Issue #${issue.id}...`);
    
    // Get issue comments
    const comments = await operations.dataFetcher.fetchIssueData(
      workspace,
      repoSlug,
      issue.id
    ).then(data => data.comments);

    // Find unprocessed triggers
    const latestTrigger = operations.triggerValidator.findLatestTrigger(comments);
    
    if (latestTrigger.comment && !isProcessed(latestTrigger.comment.id, processedTriggers)) {
      console.log(`  ✨ Found new trigger in Issue #${issue.id}`);
      
      // Trigger pipeline via API
      await triggerPipeline(
        operations,
        workspace,
        repoSlug,
        undefined,
        issue.id,
        latestTrigger.comment.id,
        latestTrigger.comment.user.nickname
      );
      
      // Mark as processed
      processedTriggers.push({
        commentId: latestTrigger.comment.id,
        timestamp: Date.now(),
      });
    }
  }
}

async function triggerPipeline(
  operations: BitbucketOperations,
  workspace: string,
  repoSlug: string,
  prNumber?: number,
  issueNumber?: number,
  commentId?: number,
  triggerUser?: string
) {
  console.log("🚀 Triggering Claude pipeline...");
  
  const variables = [
    {
      key: "CLAUDE_EVENT_TYPE",
      value: prNumber ? "pull_request" : "issue",
    },
  ];

  if (prNumber) {
    variables.push({ key: "CLAUDE_PR_NUMBER", value: prNumber.toString() });
  }
  if (issueNumber) {
    variables.push({ key: "CLAUDE_ISSUE_NUMBER", value: issueNumber.toString() });
  }
  if (commentId) {
    variables.push({ key: "CLAUDE_COMMENT_ID", value: commentId.toString() });
  }
  if (triggerUser) {
    variables.push({ key: "CLAUDE_TRIGGER_USER", value: triggerUser });
  }

  // Get default branch for pipeline
  const defaultBranch = await operations.dataFetcher.getDefaultBranch(workspace, repoSlug);

  try {
    await operations.client.triggerPipeline(
      workspace,
      repoSlug,
      defaultBranch,
      "claude-code-action",
      variables
    );
    console.log("✅ Pipeline triggered successfully");
  } catch (error) {
    console.error("❌ Failed to trigger pipeline:", error);
  }
}

async function loadProcessedTriggers(): Promise<ProcessedTrigger[]> {
  try {
    const data = await fs.readFile(PROCESSED_TRIGGERS_FILE, "utf-8");
    const triggers = JSON.parse(data) as ProcessedTrigger[];
    
    // Clean up old triggers (older than 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return triggers.filter(t => t.timestamp > oneDayAgo);
  } catch {
    return [];
  }
}

async function saveProcessedTriggers(triggers: ProcessedTrigger[]) {
  await fs.writeFile(PROCESSED_TRIGGERS_FILE, JSON.stringify(triggers, null, 2));
}

function isProcessed(commentId: number, processedTriggers: ProcessedTrigger[]): boolean {
  return processedTriggers.some(t => t.commentId === commentId);
}

// Run main function
main().catch(console.error);