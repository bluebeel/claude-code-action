import { BitbucketClient } from "../api/client";

export class BitbucketBranchOperations {
  private client: BitbucketClient;

  constructor(client: BitbucketClient) {
    this.client = client;
  }

  async createBranch(
    workspace: string,
    repoSlug: string,
    branchName: string,
    baseBranch?: string
  ): Promise<void> {
    // Get the base branch commit hash
    let baseCommitHash: string;
    
    if (baseBranch) {
      const branch = await this.client.getBranch(workspace, repoSlug, baseBranch) as any;
      baseCommitHash = branch.target.hash;
    } else {
      // Use default branch
      const repo = await this.client.getRepository(workspace, repoSlug) as any;
      const defaultBranch = repo.mainbranch?.name || "main";
      const branch = await this.client.getBranch(workspace, repoSlug, defaultBranch) as any;
      baseCommitHash = branch.target.hash;
    }

    // Create the new branch
    await this.client.createBranch(
      workspace,
      repoSlug,
      branchName,
      baseCommitHash
    );
  }

  async branchExists(
    workspace: string,
    repoSlug: string,
    branchName: string
  ): Promise<boolean> {
    try {
      await this.client.getBranch(workspace, repoSlug, branchName);
      return true;
    } catch (error) {
      // Branch doesn't exist
      return false;
    }
  }

  generateBranchName(
    type: "issue" | "pr",
    number: number,
    title?: string
  ): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const prefix = `claude/${type}-${number}`;
    
    if (title) {
      // Sanitize title for branch name
      const sanitizedTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 30);
      
      return `${prefix}-${sanitizedTitle}-${timestamp}`;
    }

    return `${prefix}-${timestamp}`;
  }

  async getLatestCommit(
    workspace: string,
    repoSlug: string,
    branchName: string
  ): Promise<string> {
    const branch = await this.client.getBranch(workspace, repoSlug, branchName) as any;
    return branch.target.hash;
  }

  async createPullRequest(
    workspace: string,
    repoSlug: string,
    options: {
      title: string;
      description: string;
      sourceBranch: string;
      destinationBranch?: string;
      reviewers?: string[];
    }
  ): Promise<number> {
    // Note: Bitbucket PR creation would require additional API implementation
    // This is a placeholder showing the expected interface
    throw new Error(
      "Pull request creation not yet implemented - requires additional Bitbucket API methods"
    );
  }

  // Helper to format branch URL
  getBranchUrl(
    workspace: string,
    repoSlug: string,
    branchName: string
  ): string {
    const repoFullName = `${workspace}/${repoSlug}`;
    return `https://bitbucket.org/${repoFullName}/branch/${encodeURIComponent(branchName)}`;
  }

  // Helper to check if user has permission to push to branch
  async canUserPushToBranch(
    workspace: string,
    repoSlug: string,
    branchName: string,
    userUuid: string
  ): Promise<boolean> {
    // Simplified permission check
    // In practice, would need to check branch restrictions and user permissions
    try {
      const repo = await this.client.getRepository(workspace, repoSlug);
      // For now, assume write access to repo means can push to branch
      return true;
    } catch (error) {
      return false;
    }
  }
}