import { BitbucketComment } from "../types";

export class BitbucketTriggerValidator {
  private triggerPhrase: string;
  private allowedUsers?: string[];
  private requireMention: boolean;

  constructor(config: {
    triggerPhrase?: string;
    allowedUsers?: string[];
    requireMention?: boolean;
  }) {
    this.triggerPhrase = config.triggerPhrase || "@claude";
    this.allowedUsers = config.allowedUsers;
    this.requireMention = config.requireMention ?? true;
  }

  isValidTrigger(comment: BitbucketComment): {
    isValid: boolean;
    reason?: string;
  } {
    // Check if comment contains trigger phrase
    const content = comment.content.raw.toLowerCase();
    const triggerLower = this.triggerPhrase.toLowerCase();
    
    if (this.requireMention) {
      // For mentions, ensure it's a word boundary (not part of another word)
      const regex = new RegExp(`\\b${this.escapeRegex(triggerLower)}\\b`);
      if (!regex.test(content)) {
        return {
          isValid: false,
          reason: `Comment does not contain trigger phrase: ${this.triggerPhrase}`,
        };
      }
    } else {
      // Simple contains check
      if (!content.includes(triggerLower)) {
        return {
          isValid: false,
          reason: `Comment does not contain trigger phrase: ${this.triggerPhrase}`,
        };
      }
    }

    // Check if user is allowed (if allowlist is configured)
    if (this.allowedUsers && this.allowedUsers.length > 0) {
      const username = comment.user.nickname;
      if (!this.allowedUsers.includes(username)) {
        return {
          isValid: false,
          reason: `User @${username} is not in the allowed users list`,
        };
      }
    }

    return { isValid: true };
  }

  extractCommand(comment: BitbucketComment): {
    command: string;
    hasCommand: boolean;
  } {
    const content = comment.content.raw;
    const triggerIndex = content.toLowerCase().indexOf(this.triggerPhrase.toLowerCase());
    
    if (triggerIndex === -1) {
      return { command: "", hasCommand: false };
    }

    // Extract everything after the trigger phrase
    const afterTrigger = content.substring(triggerIndex + this.triggerPhrase.length).trim();
    
    // Remove any markdown formatting
    const command = afterTrigger
      .replace(/```[\s\S]*?```/g, "") // Remove code blocks
      .replace(/`[^`]*`/g, "") // Remove inline code
      .replace(/\*\*/g, "") // Remove bold
      .replace(/\*/g, "") // Remove italic
      .replace(/_/g, "") // Remove underline
      .trim();

    return {
      command,
      hasCommand: command.length > 0,
    };
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Check if this is a Claude-generated comment (to avoid loops)
  isClaudeComment(comment: BitbucketComment): boolean {
    const content = comment.content.raw;
    const claudeIndicators = [
      "Claude Code is working",
      "Claude finished",
      "Claude encountered an error",
      "🤖 Generated with Claude",
      "[View job run]",
    ];

    return claudeIndicators.some(indicator => content.includes(indicator));
  }

  // Find the most recent valid trigger in a list of comments
  findLatestTrigger(comments: BitbucketComment[]): {
    comment: BitbucketComment | null;
    command: string;
  } {
    // Sort comments by date (newest first)
    const sortedComments = [...comments].sort(
      (a, b) => new Date(b.created_on).getTime() - new Date(a.created_on).getTime()
    );

    for (const comment of sortedComments) {
      // Skip Claude's own comments
      if (this.isClaudeComment(comment)) {
        continue;
      }

      const validation = this.isValidTrigger(comment);
      if (validation.isValid) {
        const { command } = this.extractCommand(comment);
        return { comment, command };
      }
    }

    return { comment: null, command: "" };
  }
}