import express from "express";
import crypto from "crypto";
import { z } from "zod";

// Webhook payload schemas
const BitbucketCommentSchema = z.object({
  id: z.number(),
  content: z.object({
    raw: z.string(),
    html: z.string(),
    markup: z.string(),
  }),
  created_on: z.string(),
  updated_on: z.string(),
  user: z.object({
    display_name: z.string(),
    uuid: z.string(),
    nickname: z.string(),
  }),
});

const BitbucketPullRequestSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  state: z.string(),
  author: z.object({
    display_name: z.string(),
    uuid: z.string(),
    nickname: z.string(),
  }),
  source: z.object({
    branch: z.object({
      name: z.string(),
    }),
    commit: z.object({
      hash: z.string(),
    }),
  }),
  destination: z.object({
    branch: z.object({
      name: z.string(),
    }),
  }),
});

const BitbucketWebhookPayloadSchema = z.object({
  repository: z.object({
    full_name: z.string(),
    uuid: z.string(),
  }),
  pullrequest: BitbucketPullRequestSchema.optional(),
  comment: BitbucketCommentSchema.optional(),
});

export type BitbucketWebhookPayload = z.infer<typeof BitbucketWebhookPayloadSchema>;

class BitbucketWebhookReceiver {
  private app: express.Application;
  private webhookSecret: string;
  private triggerPhrase: string;
  private bitbucketApiUrl: string;
  private bitbucketAuthToken: string;

  constructor(config: {
    webhookSecret: string;
    triggerPhrase?: string;
    bitbucketApiUrl?: string;
    bitbucketAuthToken: string;
  }) {
    this.app = express();
    this.webhookSecret = config.webhookSecret;
    this.triggerPhrase = config.triggerPhrase || "@claude";
    this.bitbucketApiUrl = config.bitbucketApiUrl || "https://api.bitbucket.org/2.0";
    this.bitbucketAuthToken = config.bitbucketAuthToken;

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Parse raw body for signature verification
    this.app.use(
      express.raw({
        type: "application/json",
        verify: (req, res, buf) => {
          (req as any).rawBody = buf.toString("utf8");
        },
      })
    );
  }

  private verifyWebhookSignature(payload: string, signature: string): boolean {
    const hash = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(payload)
      .digest("hex");
    return hash === signature;
  }

  private containsTriggerPhrase(text: string): boolean {
    return text.toLowerCase().includes(this.triggerPhrase.toLowerCase());
  }

  private async triggerPipeline(
    repository: string,
    prNumber: number,
    commentId: number
  ): Promise<void> {
    // In a real implementation, this would trigger the Bitbucket Pipeline
    // via the Bitbucket API with custom parameters
    console.log(`Triggering pipeline for ${repository} PR #${prNumber} comment ${commentId}`);
    
    // Example API call (would need actual implementation):
    // POST /repositories/{workspace}/{repo_slug}/pipelines
    // with custom variables containing PR and comment information
  }

  private setupRoutes() {
    // Health check endpoint
    this.app.get("/health", (req, res) => {
      res.json({ status: "healthy" });
    });

    // Webhook endpoint
    this.app.post("/webhook", async (req, res) => {
      try {
        // Verify webhook signature
        const signature = req.headers["x-hook-uuid"] as string;
        const rawBody = (req as any).rawBody;

        if (this.webhookSecret && !this.verifyWebhookSignature(rawBody, signature)) {
          return res.status(401).json({ error: "Invalid webhook signature" });
        }

        // Parse and validate payload
        const payload = JSON.parse(rawBody);
        const validatedPayload = BitbucketWebhookPayloadSchema.parse(payload);

        // Check if this is a PR comment event
        if (validatedPayload.comment && validatedPayload.pullrequest) {
          const comment = validatedPayload.comment;
          const pr = validatedPayload.pullrequest;

          // Check if comment contains trigger phrase
          if (this.containsTriggerPhrase(comment.content.raw)) {
            console.log(
              `Trigger phrase detected in comment ${comment.id} on PR #${pr.id}`
            );

            // Trigger the pipeline
            await this.triggerPipeline(
              validatedPayload.repository.full_name,
              pr.id,
              comment.id
            );

            return res.json({
              status: "triggered",
              repository: validatedPayload.repository.full_name,
              pr: pr.id,
              comment: comment.id,
            });
          }
        }

        res.json({ status: "ignored", reason: "No trigger phrase found" });
      } catch (error) {
        console.error("Webhook processing error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  }

  public start(port: number = 3000) {
    this.app.listen(port, () => {
      console.log(`Bitbucket webhook receiver listening on port ${port}`);
    });
  }
}

// Export for use in cloud functions or standalone server
export { BitbucketWebhookReceiver };

// Example usage for standalone server
if (require.main === module) {
  const receiver = new BitbucketWebhookReceiver({
    webhookSecret: process.env.BITBUCKET_WEBHOOK_SECRET || "",
    triggerPhrase: process.env.TRIGGER_PHRASE || "@claude",
    bitbucketAuthToken: process.env.BITBUCKET_AUTH_TOKEN || "",
  });

  const port = parseInt(process.env.PORT || "3000", 10);
  receiver.start(port);
}