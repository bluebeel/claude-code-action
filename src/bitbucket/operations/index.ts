import { BitbucketClient } from "../api/client";
import { BitbucketCommentOperations } from "./comments";
import { BitbucketBranchOperations } from "./branch";
import { BitbucketDataFetcher } from "../data/fetcher";
import { BitbucketDataFormatter } from "../data/formatter";
import { BitbucketTriggerValidator } from "../validation/trigger";
import { BitbucketContext } from "../context";

export class BitbucketOperations {
  public client: BitbucketClient;
  public comments: BitbucketCommentOperations;
  public branches: BitbucketBranchOperations;
  public dataFetcher: BitbucketDataFetcher;
  public dataFormatter: BitbucketDataFormatter;
  public triggerValidator: BitbucketTriggerValidator;

  constructor(authToken: string, config?: {
    triggerPhrase?: string;
    allowedUsers?: string[];
  }) {
    this.client = new BitbucketClient(authToken);
    this.comments = new BitbucketCommentOperations(this.client);
    this.branches = new BitbucketBranchOperations(this.client);
    this.dataFetcher = new BitbucketDataFetcher(this.client);
    this.dataFormatter = new BitbucketDataFormatter();
    this.triggerValidator = new BitbucketTriggerValidator({
      triggerPhrase: config?.triggerPhrase,
      allowedUsers: config?.allowedUsers,
    });
  }

  // Main entry point for processing Claude triggers
  async processTrigger(context: BitbucketContext): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      // Determine the type of trigger
      if (context.prNumber) {
        return await this.processPRTrigger(context);
      } else if (context.issueNumber) {
        return await this.processIssueTrigger(context);
      } else {
        return {
          success: false,
          error: "No PR or issue number found in context",
        };
      }
    } catch (error) {
      console.error("Error processing trigger:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async processPRTrigger(context: BitbucketContext): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    const { workspace, repoSlug, prNumber } = context;
    if (!prNumber) {
      return { success: false, error: "No PR number in context" };
    }

    // Fetch PR data
    const prData = await this.dataFetcher.fetchPullRequestData(
      workspace,
      repoSlug,
      prNumber
    );

    // Check for valid trigger in comments
    const latestTrigger = this.triggerValidator.findLatestTrigger(prData.comments);
    if (!latestTrigger.comment) {
      return { success: false, error: "No valid trigger found in PR comments" };
    }

    // Create or update Claude comment
    let claudeComment = await this.comments.findClaudeComment(
      workspace,
      repoSlug,
      prNumber
    );

    if (!claudeComment) {
      claudeComment = await this.comments.createPRComment(
        workspace,
        repoSlug,
        prNumber,
        this.comments.createProgressComment("Processing PR request...")
      );
    } else {
      await this.comments.updatePRComment(
        workspace,
        repoSlug,
        prNumber,
        claudeComment.id,
        this.comments.createProgressComment("Processing PR request...")
      );
    }

    // Format PR data for Claude
    const formattedData = this.dataFormatter.formatPullRequestData(prData);

    return {
      success: true,
      message: formattedData,
    };
  }

  private async processIssueTrigger(context: BitbucketContext): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    const { workspace, repoSlug, issueNumber } = context;
    if (!issueNumber) {
      return { success: false, error: "No issue number in context" };
    }

    // Fetch issue data
    const issueData = await this.dataFetcher.fetchIssueData(
      workspace,
      repoSlug,
      issueNumber
    );

    // Check for valid trigger in comments
    const latestTrigger = this.triggerValidator.findLatestTrigger(issueData.comments);
    if (!latestTrigger.comment) {
      return { success: false, error: "No valid trigger found in issue comments" };
    }

    // Create Claude comment
    await this.comments.createIssueComment(
      workspace,
      repoSlug,
      issueNumber,
      this.comments.createProgressComment("Processing issue request...")
    );

    // Format issue data for Claude
    const formattedData = this.dataFormatter.formatIssueData(issueData);

    // Create branch for issue if requested
    if (latestTrigger.command.includes("create branch")) {
      const branchName = this.branches.generateBranchName(
        "issue",
        issueNumber,
        issueData.issue.title
      );

      if (!(await this.branches.branchExists(workspace, repoSlug, branchName))) {
        await this.branches.createBranch(workspace, repoSlug, branchName);
        
        const branchUrl = this.branches.getBranchUrl(workspace, repoSlug, branchName);
        await this.comments.createIssueComment(
          workspace,
          repoSlug,
          issueNumber,
          `Branch created: [${branchName}](${branchUrl})`
        );
      }
    }

    return {
      success: true,
      message: formattedData,
    };
  }
}

// Export all operations modules
export { BitbucketCommentOperations } from "./comments";
export { BitbucketBranchOperations } from "./branch";
export { BitbucketTriggerValidator } from "../validation/trigger";