import { z } from "zod";

// Bitbucket Pipeline environment variable schemas
const BitbucketPipelineEnvSchema = z.object({
  // Repository information
  BITBUCKET_WORKSPACE: z.string(),
  BITBUCKET_REPO_SLUG: z.string(),
  BITBUCKET_REPO_FULL_NAME: z.string(),
  BITBUCKET_REPO_UUID: z.string(),
  
  // Build information
  BITBUCKET_BUILD_NUMBER: z.string(),
  BITBUCKET_COMMIT: z.string(),
  BITBUCKET_BRANCH: z.string().optional(),
  BITBUCKET_TAG: z.string().optional(),
  
  // PR information (only available in PR pipelines)
  BITBUCKET_PR_ID: z.string().optional(),
  BITBUCKET_PR_DESTINATION_BRANCH: z.string().optional(),
  
  // User information
  BITBUCKET_STEP_TRIGGERER_UUID: z.string().optional(),
  
  // Custom variables from webhook receiver
  CLAUDE_PR_NUMBER: z.string().optional(),
  CLAUDE_ISSUE_NUMBER: z.string().optional(),
  CLAUDE_COMMENT_ID: z.string().optional(),
  CLAUDE_TRIGGER_USER: z.string().optional(),
  CLAUDE_EVENT_TYPE: z.string().optional(),
});

export type BitbucketContext = {
  workspace: string;
  repoSlug: string;
  repoFullName: string;
  buildNumber: string;
  commit: string;
  branch?: string;
  tag?: string;
  prNumber?: number;
  issueNumber?: number;
  commentId?: number;
  triggerUser?: string;
  eventType: "pull_request" | "issue" | "push" | "tag";
  isTriggeredByComment: boolean;
};

export class BitbucketContextParser {
  static parse(): BitbucketContext {
    const env = process.env;
    
    // Validate environment variables
    const validatedEnv = BitbucketPipelineEnvSchema.parse(env);
    
    // Determine event type
    let eventType: BitbucketContext["eventType"] = "push";
    if (validatedEnv.BITBUCKET_PR_ID || validatedEnv.CLAUDE_PR_NUMBER) {
      eventType = "pull_request";
    } else if (validatedEnv.CLAUDE_ISSUE_NUMBER) {
      eventType = "issue";
    } else if (validatedEnv.BITBUCKET_TAG) {
      eventType = "tag";
    }
    
    // Check if triggered by comment
    const isTriggeredByComment = !!(
      validatedEnv.CLAUDE_COMMENT_ID &&
      validatedEnv.CLAUDE_TRIGGER_USER
    );
    
    return {
      workspace: validatedEnv.BITBUCKET_WORKSPACE,
      repoSlug: validatedEnv.BITBUCKET_REPO_SLUG,
      repoFullName: validatedEnv.BITBUCKET_REPO_FULL_NAME,
      buildNumber: validatedEnv.BITBUCKET_BUILD_NUMBER,
      commit: validatedEnv.BITBUCKET_COMMIT,
      branch: validatedEnv.BITBUCKET_BRANCH,
      tag: validatedEnv.BITBUCKET_TAG,
      prNumber: validatedEnv.CLAUDE_PR_NUMBER
        ? parseInt(validatedEnv.CLAUDE_PR_NUMBER, 10)
        : validatedEnv.BITBUCKET_PR_ID
        ? parseInt(validatedEnv.BITBUCKET_PR_ID, 10)
        : undefined,
      issueNumber: validatedEnv.CLAUDE_ISSUE_NUMBER
        ? parseInt(validatedEnv.CLAUDE_ISSUE_NUMBER, 10)
        : undefined,
      commentId: validatedEnv.CLAUDE_COMMENT_ID
        ? parseInt(validatedEnv.CLAUDE_COMMENT_ID, 10)
        : undefined,
      triggerUser: validatedEnv.CLAUDE_TRIGGER_USER,
      eventType,
      isTriggeredByComment,
    };
  }
  
  static getAuthToken(): string {
    const token = process.env.BITBUCKET_AUTH_TOKEN;
    if (!token) {
      throw new Error("BITBUCKET_AUTH_TOKEN environment variable is not set");
    }
    return token;
  }
  
  static getTriggerPhrase(): string {
    return process.env.TRIGGER_PHRASE || "@claude";
  }
  
  static getAnthropicApiKey(): string {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    return key;
  }
  
  static getAllowedTools(): string[] {
    const tools = process.env.ALLOWED_TOOLS;
    return tools ? tools.split(",").map(t => t.trim()) : [];
  }
  
  static getDisallowedTools(): string[] {
    const tools = process.env.DISALLOWED_TOOLS;
    return tools ? tools.split(",").map(t => t.trim()) : [];
  }
  
  static getCustomInstructions(): string | undefined {
    return process.env.CUSTOM_INSTRUCTIONS;
  }
  
  static shouldDebug(): boolean {
    return process.env.DEBUG === "true";
  }
  
  // Helper to construct URLs
  static getPullRequestUrl(context: BitbucketContext, prNumber?: number): string {
    const pr = prNumber || context.prNumber;
    if (!pr) throw new Error("No PR number available");
    return `https://bitbucket.org/${context.repoFullName}/pull-requests/${pr}`;
  }
  
  static getIssueUrl(context: BitbucketContext, issueNumber?: number): string {
    const issue = issueNumber || context.issueNumber;
    if (!issue) throw new Error("No issue number available");
    return `https://bitbucket.org/${context.repoFullName}/issues/${issue}`;
  }
  
  static getCommitUrl(context: BitbucketContext, commit?: string): string {
    const sha = commit || context.commit;
    return `https://bitbucket.org/${context.repoFullName}/commits/${sha}`;
  }
  
  static getBuildUrl(context: BitbucketContext): string {
    return `https://bitbucket.org/${context.repoFullName}/pipelines/results/${context.buildNumber}`;
  }
}