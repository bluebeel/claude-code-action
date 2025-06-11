#!/usr/bin/env bun

import { BitbucketContextParser, BitbucketContext } from "../bitbucket/context";
import { BitbucketOperations } from "../bitbucket/operations";
import { createBitbucketClient } from "../bitbucket/api/client";
import * as fs from "fs/promises";
import * as path from "path";

async function main() {
  try {
    console.log("🚀 Starting Bitbucket Claude Code Action...");

    // Parse context
    const context = BitbucketContextParser.parse();
    console.log(`📋 Context: ${context.eventType} on ${context.repoFullName}`);
    
    if (context.prNumber) {
      console.log(`🔍 Processing PR #${context.prNumber}`);
    } else if (context.issueNumber) {
      console.log(`🔍 Processing Issue #${context.issueNumber}`);
    }

    // Get configuration
    const authToken = BitbucketContextParser.getAuthToken();
    const triggerPhrase = BitbucketContextParser.getTriggerPhrase();
    const allowedTools = BitbucketContextParser.getAllowedTools();
    const disallowedTools = BitbucketContextParser.getDisallowedTools();
    const customInstructions = BitbucketContextParser.getCustomInstructions();
    const anthropicApiKey = BitbucketContextParser.getAnthropicApiKey();

    // Initialize Bitbucket operations
    const operations = new BitbucketOperations(authToken, { triggerPhrase });

    // Process the trigger
    console.log("⚡ Processing trigger...");
    const result = await operations.processTrigger(context);

    if (!result.success) {
      console.error(`❌ Error: ${result.error}`);
      process.exit(1);
    }

    // Create prompt for Claude
    const prompt = createClaudePrompt(context, result.message || "", {
      triggerPhrase,
      customInstructions,
      allowedTools,
      disallowedTools,
    });

    // Save prompt for claude-code-base-action
    const promptsDir = path.join(process.cwd(), "claude-prompts");
    await fs.mkdir(promptsDir, { recursive: true });
    
    const promptFile = path.join(promptsDir, `prompt-${Date.now()}.md`);
    await fs.writeFile(promptFile, prompt);
    
    console.log(`✅ Prompt saved to: ${promptFile}`);

    // Save context for update script
    const contextFile = path.join(promptsDir, "context.json");
    await fs.writeFile(contextFile, JSON.stringify({
      ...context,
      anthropicApiKey,
      promptFile,
    }, null, 2));

    console.log("🎯 Ready for Claude processing!");

  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

function createClaudePrompt(
  context: BitbucketContext,
  formattedData: string,
  config: {
    triggerPhrase: string;
    customInstructions?: string;
    allowedTools: string[];
    disallowedTools: string[];
  }
): string {
  const sections: string[] = [];

  // Header
  sections.push("# Claude Code Action - Bitbucket");
  sections.push(`Repository: ${context.repoFullName}`);
  sections.push(`Build: ${context.buildNumber}`);
  sections.push("");

  // Context
  if (context.prNumber) {
    sections.push(`## Pull Request #${context.prNumber}`);
  } else if (context.issueNumber) {
    sections.push(`## Issue #${context.issueNumber}`);
  }
  sections.push("");

  // Trigger information
  if (context.triggerUser) {
    sections.push(`Triggered by: @${context.triggerUser}`);
  }
  sections.push(`Trigger phrase: ${config.triggerPhrase}`);
  sections.push("");

  // Data
  sections.push("## Context Data");
  sections.push(formattedData);
  sections.push("");

  // Instructions
  sections.push("## Instructions");
  sections.push("You are Claude, an AI assistant helping with code reviews and development tasks.");
  sections.push(`Respond to requests that begin with "${config.triggerPhrase}".`);
  
  if (config.customInstructions) {
    sections.push("");
    sections.push("### Custom Instructions");
    sections.push(config.customInstructions);
  }

  // Tool restrictions
  if (config.allowedTools.length > 0) {
    sections.push("");
    sections.push("### Allowed Tools");
    sections.push(config.allowedTools.join(", "));
  }

  if (config.disallowedTools.length > 0) {
    sections.push("");
    sections.push("### Disallowed Tools");
    sections.push(config.disallowedTools.join(", "));
  }

  return sections.join("\n");
}

// Run main function
main().catch(console.error);