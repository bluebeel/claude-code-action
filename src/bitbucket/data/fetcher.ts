import { BitbucketClient } from "../api/client";
import {
  BitbucketPullRequest,
  BitbucketIssue,
  BitbucketComment,
  BitbucketCommit,
  BitbucketDiffStat,
  BitbucketPaginatedResponse,
} from "../types";

export class BitbucketDataFetcher {
  private client: BitbucketClient;

  constructor(client: BitbucketClient) {
    this.client = client;
  }

  async fetchPullRequestData(
    workspace: string,
    repoSlug: string,
    prNumber: number
  ): Promise<{
    pullRequest: BitbucketPullRequest;
    comments: BitbucketComment[];
    commits: BitbucketCommit[];
    diffStats: BitbucketDiffStat[];
  }> {
    // Fetch PR details
    const pullRequest = await this.client.getPullRequest(
      workspace,
      repoSlug,
      prNumber
    ) as BitbucketPullRequest;

    // Fetch all comments (handling pagination)
    const comments = await this.fetchAllPages<BitbucketComment>(
      async (page) =>
        this.client.getPullRequestComments(
          workspace,
          repoSlug,
          prNumber,
          page
        ) as Promise<BitbucketPaginatedResponse<BitbucketComment>>
    );

    // Fetch commits
    const commitsSpec = `${pullRequest.destination.commit.hash}..${pullRequest.source.commit.hash}`;
    const commits = await this.fetchAllPages<BitbucketCommit>(
      async (page) =>
        this.client.getCommits(
          workspace,
          repoSlug,
          pullRequest.source.branch.name,
          page
        ) as Promise<BitbucketPaginatedResponse<BitbucketCommit>>
    );

    // Fetch diff stats
    const diffStats = await this.fetchAllPages<BitbucketDiffStat>(
      async (page) =>
        this.client.getDiffStat(
          workspace,
          repoSlug,
          commitsSpec
        ) as Promise<BitbucketPaginatedResponse<BitbucketDiffStat>>
    );

    return {
      pullRequest,
      comments,
      commits,
      diffStats,
    };
  }

  async fetchIssueData(
    workspace: string,
    repoSlug: string,
    issueNumber: number
  ): Promise<{
    issue: BitbucketIssue;
    comments: BitbucketComment[];
  }> {
    // Fetch issue details
    const issue = await this.client.getIssue(
      workspace,
      repoSlug,
      issueNumber
    ) as BitbucketIssue;

    // Fetch all comments (handling pagination)
    const comments = await this.fetchAllPages<BitbucketComment>(
      async (page) =>
        this.client.getIssueComments(
          workspace,
          repoSlug,
          issueNumber,
          page
        ) as Promise<BitbucketPaginatedResponse<BitbucketComment>>
    );

    return {
      issue,
      comments,
    };
  }

  async fetchFileContent(
    workspace: string,
    repoSlug: string,
    path: string,
    ref: string
  ): Promise<string> {
    const response = await this.client.getFileContent(
      workspace,
      repoSlug,
      path,
      ref
    );
    
    // Bitbucket returns file content as a string directly
    return response as string;
  }

  private async fetchAllPages<T>(
    fetcher: (page: number) => Promise<BitbucketPaginatedResponse<T>>
  ): Promise<T[]> {
    const allItems: T[] = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const response = await fetcher(page);
      allItems.push(...response.values);
      
      hasNextPage = !!response.next;
      page++;
    }

    return allItems;
  }

  // Helper method to check if a user can trigger Claude
  async canUserTrigger(
    workspace: string,
    repoSlug: string,
    userUuid: string
  ): Promise<boolean> {
    try {
      // In Bitbucket, check if user has write access to the repository
      // This is a simplified check - in practice, you might want to check
      // repository permissions more thoroughly
      const repo = await this.client.getRepository(workspace, repoSlug);
      return true; // Simplified for now - would need proper permission check
    } catch (error) {
      console.error("Error checking user permissions:", error);
      return false;
    }
  }

  // Helper to get repository default branch
  async getDefaultBranch(
    workspace: string,
    repoSlug: string
  ): Promise<string> {
    const repo = await this.client.getRepository(workspace, repoSlug) as any;
    return repo.mainbranch?.name || "main";
  }
}