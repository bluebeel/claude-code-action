import { BitbucketClient } from "../api/client";
import { BitbucketComment } from "../types";

export class BitbucketCommentOperations {
  private client: BitbucketClient;

  constructor(client: BitbucketClient) {
    this.client = client;
  }

  async createPRComment(
    workspace: string,
    repoSlug: string,
    prNumber: number,
    content: string
  ): Promise<BitbucketComment> {
    const formattedContent = this.formatComment(content);
    return await this.client.createPullRequestComment(
      workspace,
      repoSlug,
      prNumber,
      formattedContent
    ) as BitbucketComment;
  }

  async updatePRComment(
    workspace: string,
    repoSlug: string,
    prNumber: number,
    commentId: number,
    content: string
  ): Promise<BitbucketComment> {
    const formattedContent = this.formatComment(content);
    return await this.client.updatePullRequestComment(
      workspace,
      repoSlug,
      prNumber,
      commentId,
      formattedContent
    ) as BitbucketComment;
  }

  async createIssueComment(
    workspace: string,
    repoSlug: string,
    issueNumber: number,
    content: string
  ): Promise<BitbucketComment> {
    const formattedContent = this.formatComment(content);
    return await this.client.createIssueComment(
      workspace,
      repoSlug,
      issueNumber,
      formattedContent
    ) as BitbucketComment;
  }

  async findClaudeComment(
    workspace: string,
    repoSlug: string,
    prNumber: number
  ): Promise<BitbucketComment | null> {
    const comments = await this.client.getPullRequestComments(
      workspace,
      repoSlug,
      prNumber
    ) as any;

    // Look for Claude's comment
    for (const comment of comments.values) {
      if (this.isClaudeComment(comment)) {
        return comment;
      }
    }

    return null;
  }

  private formatComment(content: string): string {
    // Add Claude signature to the comment
    const signature = "\n\n---\n🤖 Generated with [Claude Code](https://claude.ai/code)";
    
    // Add build link if available
    const buildNumber = process.env.BITBUCKET_BUILD_NUMBER;
    const repoFullName = process.env.BITBUCKET_REPO_FULL_NAME;
    
    if (buildNumber && repoFullName) {
      const buildLink = `\n[View job run](https://bitbucket.org/${repoFullName}/pipelines/results/${buildNumber})`;
      return content + buildLink + signature;
    }

    return content + signature;
  }

  private isClaudeComment(comment: BitbucketComment): boolean {
    const indicators = [
      "Claude Code is working",
      "Claude finished",
      "Claude encountered an error",
      "🤖 Generated with Claude",
    ];

    const content = comment.content.raw;
    return indicators.some(indicator => content.includes(indicator));
  }

  // Helper to create progress comment
  createProgressComment(taskDescription?: string): string {
    const spinner = "⏳";
    const header = `${spinner} **Claude Code is working...**`;
    
    if (taskDescription) {
      return `${header}\n\n${taskDescription}`;
    }

    return header;
  }

  // Helper to create success comment
  createSuccessComment(result: string, duration?: string): string {
    const checkmark = "✅";
    const header = duration
      ? `${checkmark} **Claude finished the task in ${duration}**`
      : `${checkmark} **Claude finished the task**`;

    return `${header}\n\n${result}`;
  }

  // Helper to create error comment
  createErrorComment(error: string, duration?: string): string {
    const cross = "❌";
    const header = duration
      ? `${cross} **Claude encountered an error after ${duration}**`
      : `${cross} **Claude encountered an error**`;

    return `${header}\n\n\`\`\`\n${error}\n\`\`\``;
  }

  // Create checklist comment for tracking progress
  createChecklistComment(tasks: Array<{ task: string; completed: boolean }>): string {
    const lines = ["**Task Progress:**", ""];

    for (const { task, completed } of tasks) {
      const checkbox = completed ? "[x]" : "[ ]";
      lines.push(`- ${checkbox} ${task}`);
    }

    return lines.join("\n");
  }
}