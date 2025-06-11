#!/usr/bin/env bun

import { BitbucketContextParser } from "../bitbucket/context";
import { BitbucketOperations } from "../bitbucket/operations";
import * as fs from "fs/promises";
import * as path from "path";

async function main() {
  try {
    console.log("📝 Updating Bitbucket comment with results...");

    // Load saved context
    const promptsDir = path.join(process.cwd(), "claude-prompts");
    const contextFile = path.join(promptsDir, "context.json");
    
    let savedContext;
    try {
      const contextData = await fs.readFile(contextFile, "utf-8");
      savedContext = JSON.parse(contextData);
    } catch (error) {
      console.error("❌ Could not load saved context");
      return;
    }

    // Get auth token
    const authToken = BitbucketContextParser.getAuthToken();
    const operations = new BitbucketOperations(authToken);

    // Check for execution results
    const resultsDir = path.join(process.cwd(), "execution-results");
    let executionResult = "No execution results found";
    
    try {
      const resultFiles = await fs.readdir(resultsDir);
      if (resultFiles.length > 0) {
        // Read the most recent result file
        const latestResult = resultFiles.sort().pop();
        if (latestResult) {
          const resultPath = path.join(resultsDir, latestResult);
          executionResult = await fs.readFile(resultPath, "utf-8");
        }
      }
    } catch (error) {
      console.log("No execution results directory found");
    }

    // Calculate duration
    const startTime = savedContext.startTime || Date.now();
    const duration = formatDuration(Date.now() - startTime);

    // Update comment based on context
    if (savedContext.prNumber) {
      await updatePRComment(operations, savedContext, executionResult, duration);
    } else if (savedContext.issueNumber) {
      await updateIssueComment(operations, savedContext, executionResult, duration);
    }

    console.log("✅ Comment updated successfully!");

  } catch (error) {
    console.error("❌ Error updating comment:", error);
  }
}

async function updatePRComment(
  operations: BitbucketOperations,
  context: any,
  result: string,
  duration: string
) {
  const claudeComment = await operations.comments.findClaudeComment(
    context.workspace,
    context.repoSlug,
    context.prNumber
  );

  if (!claudeComment) {
    console.error("Could not find Claude comment to update");
    return;
  }

  const content = operations.comments.createSuccessComment(result, duration);
  
  await operations.comments.updatePRComment(
    context.workspace,
    context.repoSlug,
    context.prNumber,
    claudeComment.id,
    content
  );
}

async function updateIssueComment(
  operations: BitbucketOperations,
  context: any,
  result: string,
  duration: string
) {
  // For issues, create a new comment with results
  const content = operations.comments.createSuccessComment(result, duration);
  
  await operations.comments.createIssueComment(
    context.workspace,
    context.repoSlug,
    context.issueNumber,
    content
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// Run main function
main().catch(console.error);