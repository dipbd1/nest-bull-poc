import { Job } from 'bullmq';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service.js';
import { jobQueueName } from '../config/queue.config.js';
import { ConversationService } from '../conversation/conversation.service.js';
import type { ProducerJobData } from '../producer/producer.service.js';

export const JOB_SYSTEM_PROMPT =
  'You are processing a queued job. Use the job name and description to produce a useful first response.';

export function jobUserPrompt(name: string, description: string): string {
  return `Job name: ${name}\n\n${description}`;
}

@Processor(jobQueueName)
export class ConsumerProcessor extends WorkerHost {
  private readonly logger = new Logger(ConsumerProcessor.name);

  constructor(
    private readonly ai: AiService,
    private readonly conversations: ConversationService,
  ) {
    super();
  }

  async process(
    job: Job<ProducerJobData>,
  ): Promise<{ conversationId: string; text: string }> {
    const jobId = String(job.id);
    const existing = await this.conversations.findByJobId(jobId);
    if (existing) {
      this.logger.log(`Job ${jobId} already has a conversation; skipping model`);
      return this.conversations.completedJobResult(existing);
    }

    const { name, description, model, userId } = job.data;
    if (!userId) {
      throw new Error('Job is missing userId');
    }
    if (!model) {
      throw new Error('Job is missing model');
    }

    const userContent = jobUserPrompt(name, description);
    const generated = await this.ai.generateText({
      provider: 'openrouter',
      model,
      messages: [
        { role: 'system', content: JOB_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    });

    const conversation = await this.conversations.createInitial({
      jobId,
      userId,
      title: name,
      provider: generated.provider,
      model,
      systemContent: JOB_SYSTEM_PROMPT,
      userContent,
      assistantContent: generated.text,
    });

    return {
      conversationId: conversation.id,
      text: generated.text,
    };
  }
}
