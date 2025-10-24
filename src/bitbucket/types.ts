// Types for Bitbucket API responses
export type BitbucketAuthor = {
  display_name: string;
  uuid: string;
  nickname: string;
  type: string;
  links: {
    avatar: {
      href: string;
    };
  };
};

export type BitbucketComment = {
  id: number;
  content: {
    raw: string;
    html: string;
    markup: string;
  };
  created_on: string;
  updated_on: string;
  user: BitbucketAuthor;
  inline?: {
    path: string;
    from: number | null;
    to: number | null;
  };
};

export type BitbucketCommit = {
  hash: string;
  message: string;
  date: string;
  author: {
    raw: string;
    user?: BitbucketAuthor;
  };
  links: {
    self: {
      href: string;
    };
  };
};

export type BitbucketFile = {
  path: string;
  type: string;
  size?: number;
  links: {
    self: {
      href: string;
    };
  };
};

export type BitbucketDiffStat = {
  path: {
    to: string;
    from?: string;
  };
  lines_added: number;
  lines_removed: number;
  status: "added" | "removed" | "modified" | "renamed";
};

export type BitbucketPullRequest = {
  id: number;
  title: string;
  description: string;
  state: "OPEN" | "MERGED" | "DECLINED" | "SUPERSEDED";
  author: BitbucketAuthor;
  created_on: string;
  updated_on: string;
  source: {
    branch: {
      name: string;
    };
    commit: {
      hash: string;
    };
    repository: {
      full_name: string;
    };
  };
  destination: {
    branch: {
      name: string;
    };
    commit: {
      hash: string;
    };
    repository: {
      full_name: string;
    };
  };
  merge_commit: {
    hash: string;
  } | null;
  participants: Array<{
    user: BitbucketAuthor;
    role: "PARTICIPANT" | "REVIEWER";
    approved: boolean;
    state: "approved" | "changes_requested" | null;
  }>;
  links: {
    self: {
      href: string;
    };
    html: {
      href: string;
    };
    commits: {
      href: string;
    };
    comments: {
      href: string;
    };
    diff: {
      href: string;
    };
    diffstat: {
      href: string;
    };
  };
};

export type BitbucketIssue = {
  id: number;
  title: string;
  content: {
    raw: string;
    html: string;
    markup: string;
  };
  state: "new" | "open" | "resolved" | "on hold" | "invalid" | "duplicate" | "wontfix" | "closed";
  priority: "trivial" | "minor" | "major" | "critical" | "blocker";
  kind: "bug" | "enhancement" | "proposal" | "task";
  reporter: BitbucketAuthor;
  assignee?: BitbucketAuthor;
  created_on: string;
  updated_on: string;
  links: {
    self: {
      href: string;
    };
    html: {
      href: string;
    };
    comments: {
      href: string;
    };
  };
};

// Paginated response wrapper
export type BitbucketPaginatedResponse<T> = {
  size: number;
  page: number;
  pagelen: number;
  next?: string;
  previous?: string;
  values: T[];
};

// API Response types
export type PullRequestResponse = BitbucketPullRequest;
export type IssueResponse = BitbucketIssue;
export type CommentsResponse = BitbucketPaginatedResponse<BitbucketComment>;
export type CommitsResponse = BitbucketPaginatedResponse<BitbucketCommit>;
export type DiffStatResponse = BitbucketPaginatedResponse<BitbucketDiffStat>;