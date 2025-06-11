import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import crypto from "crypto";
import { BitbucketWebhookPayloadSchema } from "./server";

// AWS Lambda handler for Bitbucket webhooks
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const webhookSecret = process.env.BITBUCKET_WEBHOOK_SECRET || "";
  const triggerPhrase = process.env.TRIGGER_PHRASE || "@claude";
  const bitbucketAuthToken = process.env.BITBUCKET_AUTH_TOKEN || "";
  const bitbucketPipelineToken = process.env.BITBUCKET_PIPELINE_TOKEN || "";

  try {
    // Verify webhook signature
    if (webhookSecret) {
      const signature = event.headers["x-hook-uuid"];
      const hash = crypto
        .createHmac("sha256", webhookSecret)
        .update(event.body || "")
        .digest("hex");

      if (hash !== signature) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: "Invalid webhook signature" }),
        };
      }
    }

    // Parse and validate payload
    const payload = JSON.parse(event.body || "{}");
    const validatedPayload = BitbucketWebhookPayloadSchema.parse(payload);

    // Check if this is a PR comment event with trigger phrase
    if (
      validatedPayload.comment &&
      validatedPayload.pullrequest &&
      validatedPayload.comment.content.raw
        .toLowerCase()
        .includes(triggerPhrase.toLowerCase())
    ) {
      const repository = validatedPayload.repository.full_name;
      const prNumber = validatedPayload.pullrequest.id;
      const commentId = validatedPayload.comment.id;

      // Trigger Bitbucket Pipeline via API
      const [workspace, repoSlug] = repository.split("/");
      const pipelineUrl = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pipelines`;

      const pipelinePayload = {
        target: {
          type: "pipeline_ref_target",
          ref_type: "branch",
          ref_name: validatedPayload.pullrequest.source.branch.name,
          selector: {
            type: "custom",
            pattern: "claude-code-action",
          },
        },
        variables: [
          {
            key: "CLAUDE_PR_NUMBER",
            value: prNumber.toString(),
          },
          {
            key: "CLAUDE_COMMENT_ID",
            value: commentId.toString(),
          },
          {
            key: "CLAUDE_TRIGGER_USER",
            value: validatedPayload.comment.user.nickname,
          },
        ],
      };

      const response = await fetch(pipelineUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bitbucketPipelineToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pipelinePayload),
      });

      if (!response.ok) {
        console.error("Failed to trigger pipeline:", await response.text());
        return {
          statusCode: 500,
          body: JSON.stringify({ error: "Failed to trigger pipeline" }),
        };
      }

      const pipelineData = await response.json();

      return {
        statusCode: 200,
        body: JSON.stringify({
          status: "triggered",
          repository,
          pr: prNumber,
          comment: commentId,
          pipeline: pipelineData.uuid,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ status: "ignored", reason: "No trigger phrase found" }),
    };
  } catch (error) {
    console.error("Webhook processing error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}