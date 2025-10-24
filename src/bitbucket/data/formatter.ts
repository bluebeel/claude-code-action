import {
  BitbucketPullRequest,
  BitbucketIssue,
  BitbucketComment,
  BitbucketCommit,
  BitbucketDiffStat,
} from "../types";

export class BitbucketDataFormatter {
  formatPullRequestData(data: {
    pullRequest: BitbucketPullRequest;
    comments: BitbucketComment[];
    commits: BitbucketCommit[];
    diffStats: BitbucketDiffStat[];
  }): string {
    const { pullRequest, comments, commits, diffStats } = data;

    const sections: string[] = [];

    // PR Header
    sections.push(this.formatPRHeader(pullRequest, commits, diffStats));

    // PR Body
    if (pullRequest.description) {
      sections.push(this.formatSection("PR Description", pullRequest.description));
    }

    // Changed Files
    if (diffStats.length > 0) {
      sections.push(this.formatChangedFiles(diffStats));
    }

    // Commits
    if (commits.length > 0) {
      sections.push(this.formatCommits(commits));
    }

    // Comments
    if (comments.length > 0) {
      sections.push(this.formatComments(comments, "PR"));
    }

    return sections.join("\n\n");
  }

  formatIssueData(data: {
    issue: BitbucketIssue;
    comments: BitbucketComment[];
  }): string {
    const { issue, comments } = data;

    const sections: string[] = [];

    // Issue Header
    sections.push(this.formatIssueHeader(issue));

    // Issue Body
    if (issue.content.raw) {
      sections.push(this.formatSection("Issue Description", issue.content.raw));
    }

    // Comments
    if (comments.length > 0) {
      sections.push(this.formatComments(comments, "Issue"));
    }

    return sections.join("\n\n");
  }

  private formatPRHeader(
    pr: BitbucketPullRequest,
    commits: BitbucketCommit[],
    diffStats: BitbucketDiffStat[]
  ): string {
    const additions = diffStats.reduce((sum, stat) => sum + stat.lines_added, 0);
    const deletions = diffStats.reduce((sum, stat) => sum + stat.lines_removed, 0);

    return `# Pull Request #${pr.id}: ${pr.title}

**Author:** ${pr.author.display_name} (@${pr.author.nickname})
**Branch:** ${pr.source.branch.name} → ${pr.destination.branch.name}
**State:** ${pr.state}
**Created:** ${this.formatDate(pr.created_on)}
**Updated:** ${this.formatDate(pr.updated_on)}

**Changes:** +${additions} -${deletions} (${diffStats.length} files)
**Commits:** ${commits.length}`;
  }

  private formatIssueHeader(issue: BitbucketIssue): string {
    return `# Issue #${issue.id}: ${issue.title}

**Reporter:** ${issue.reporter.display_name} (@${issue.reporter.nickname})
**Assignee:** ${issue.assignee ? `${issue.assignee.display_name} (@${issue.assignee.nickname})` : "Unassigned"}
**State:** ${issue.state}
**Priority:** ${issue.priority}
**Kind:** ${issue.kind}
**Created:** ${this.formatDate(issue.created_on)}
**Updated:** ${this.formatDate(issue.updated_on)}`;
  }

  private formatChangedFiles(diffStats: BitbucketDiffStat[]): string {
    const lines = ["## Changed Files", ""];

    const sortedStats = [...diffStats].sort((a, b) => {
      // Sort by status (added, modified, removed), then by path
      const statusOrder = { added: 0, modified: 1, renamed: 2, removed: 3 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.path.to.localeCompare(b.path.to);
    });

    for (const stat of sortedStats) {
      const statusIcon = {
        added: "➕",
        modified: "📝",
        removed: "❌",
        renamed: "➡️",
      }[stat.status];

      const path = stat.path.from && stat.path.from !== stat.path.to
        ? `${stat.path.from} → ${stat.path.to}`
        : stat.path.to;

      lines.push(
        `${statusIcon} ${path} (+${stat.lines_added} -${stat.lines_removed})`
      );
    }

    return lines.join("\n");
  }

  private formatCommits(commits: BitbucketCommit[]): string {
    const lines = ["## Commits", ""];

    for (const commit of commits) {
      const hash = commit.hash.substring(0, 7);
      const message = commit.message.split("\n")[0]; // First line only
      const author = this.extractAuthorName(commit.author.raw);
      lines.push(`- \`${hash}\` ${message} - ${author}`);
    }

    return lines.join("\n");
  }

  private formatComments(comments: BitbucketComment[], type: "PR" | "Issue"): string {
    const lines = [`## ${type} Comments`, ""];

    const sortedComments = [...comments].sort(
      (a, b) => new Date(a.created_on).getTime() - new Date(b.created_on).getTime()
    );

    for (const comment of sortedComments) {
      lines.push(`### Comment by ${comment.user.display_name} (@${comment.user.nickname})`);
      lines.push(`*${this.formatDate(comment.created_on)}*`);
      
      if (comment.inline) {
        lines.push(`📍 **File:** ${comment.inline.path}`);
        if (comment.inline.from !== null) {
          lines.push(`📍 **Line:** ${comment.inline.from}${comment.inline.to !== comment.inline.from ? `-${comment.inline.to}` : ""}`);
        }
      }

      lines.push("");
      lines.push(comment.content.raw);
      lines.push("");
      lines.push("---");
      lines.push("");
    }

    return lines.join("\n");
  }

  private formatSection(title: string, content: string): string {
    return `## ${title}\n\n${content}`;
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }

  private extractAuthorName(authorRaw: string): string {
    // Bitbucket author format: "Name <email>"
    const match = authorRaw.match(/^(.+?)\s*<.+>$/);
    return match ? match[1].trim() : authorRaw;
  }

  // Format for Claude prompt context
  formatForPrompt(data: {
    type: "pull_request" | "issue";
    content: any;
  }): string {
    if (data.type === "pull_request") {
      return this.formatPullRequestData(data.content);
    } else {
      return this.formatIssueData(data.content);
    }
  }
}