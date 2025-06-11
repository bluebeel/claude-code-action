import fetch from "node-fetch";
import { z } from "zod";

export const BITBUCKET_API_URL = "https://api.bitbucket.org/2.0";

export class BitbucketClient {
  private authToken: string;
  private baseUrl: string;

  constructor(authToken: string, baseUrl: string = BITBUCKET_API_URL) {
    this.authToken = authToken;
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      Authorization: `Bearer ${this.authToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Bitbucket API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }

  // Pull Request operations
  async getPullRequest(
    workspace: string,
    repoSlug: string,
    prId: number
  ) {
    return this.request(`/repositories/${workspace}/${repoSlug}/pullrequests/${prId}`);
  }

  async getPullRequestComments(
    workspace: string,
    repoSlug: string,
    prId: number,
    page: number = 1
  ) {
    return this.request(
      `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments?page=${page}`
    );
  }

  async createPullRequestComment(
    workspace: string,
    repoSlug: string,
    prId: number,
    content: string
  ) {
    return this.request(
      `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`,
      {
        method: "POST",
        body: JSON.stringify({
          content: {
            raw: content,
          },
        }),
      }
    );
  }

  async updatePullRequestComment(
    workspace: string,
    repoSlug: string,
    prId: number,
    commentId: number,
    content: string
  ) {
    return this.request(
      `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments/${commentId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          content: {
            raw: content,
          },
        }),
      }
    );
  }

  // Issue operations
  async getIssue(
    workspace: string,
    repoSlug: string,
    issueId: number
  ) {
    return this.request(`/repositories/${workspace}/${repoSlug}/issues/${issueId}`);
  }

  async getIssueComments(
    workspace: string,
    repoSlug: string,
    issueId: number,
    page: number = 1
  ) {
    return this.request(
      `/repositories/${workspace}/${repoSlug}/issues/${issueId}/comments?page=${page}`
    );
  }

  async createIssueComment(
    workspace: string,
    repoSlug: string,
    issueId: number,
    content: string
  ) {
    return this.request(
      `/repositories/${workspace}/${repoSlug}/issues/${issueId}/comments`,
      {
        method: "POST",
        body: JSON.stringify({
          content: {
            raw: content,
          },
        }),
      }
    );
  }

  // Repository operations
  async getRepository(workspace: string, repoSlug: string) {
    return this.request(`/repositories/${workspace}/${repoSlug}`);
  }

  async createBranch(
    workspace: string,
    repoSlug: string,
    branchName: string,
    fromHash: string
  ) {
    return this.request(
      `/repositories/${workspace}/${repoSlug}/refs/branches`,
      {
        method: "POST",
        body: JSON.stringify({
          name: branchName,
          target: {
            hash: fromHash,
          },
        }),
      }
    );
  }

  async getBranch(
    workspace: string,
    repoSlug: string,
    branchName: string
  ) {
    return this.request(
      `/repositories/${workspace}/${repoSlug}/refs/branches/${encodeURIComponent(branchName)}`
    );
  }

  // Commit operations
  async getCommits(
    workspace: string,
    repoSlug: string,
    branch: string,
    page: number = 1
  ) {
    return this.request(
      `/repositories/${workspace}/${repoSlug}/commits/${encodeURIComponent(branch)}?page=${page}`
    );
  }

  async getDiffStat(
    workspace: string,
    repoSlug: string,
    spec: string
  ) {
    return this.request(
      `/repositories/${workspace}/${repoSlug}/diffstat/${encodeURIComponent(spec)}`
    );
  }

  // File operations
  async getFileContent(
    workspace: string,
    repoSlug: string,
    path: string,
    ref: string
  ) {
    return this.request(
      `/repositories/${workspace}/${repoSlug}/src/${encodeURIComponent(ref)}/${encodeURIComponent(path)}`
    );
  }

  async createOrUpdateFile(
    workspace: string,
    repoSlug: string,
    path: string,
    content: string,
    message: string,
    branch: string,
    author?: { name: string; email: string }
  ) {
    // Note: Bitbucket doesn't have a direct file update API
    // This would typically be done through a commit creation
    // which is more complex and requires multiple API calls
    throw new Error(
      "File operations in Bitbucket require commit creation - not yet implemented"
    );
  }

  // Pipeline operations
  async triggerPipeline(
    workspace: string,
    repoSlug: string,
    branch: string,
    customPattern: string,
    variables: Array<{ key: string; value: string }>
  ) {
    return this.request(
      `/repositories/${workspace}/${repoSlug}/pipelines`,
      {
        method: "POST",
        body: JSON.stringify({
          target: {
            type: "pipeline_ref_target",
            ref_type: "branch",
            ref_name: branch,
            selector: {
              type: "custom",
              pattern: customPattern,
            },
          },
          variables,
        }),
      }
    );
  }

  async getPipelineStatus(
    workspace: string,
    repoSlug: string,
    pipelineUuid: string
  ) {
    return this.request(
      `/repositories/${workspace}/${repoSlug}/pipelines/${pipelineUuid}`
    );
  }
}

// Factory function for creating Bitbucket client
export function createBitbucketClient(authToken: string): BitbucketClient {
  return new BitbucketClient(authToken);
}