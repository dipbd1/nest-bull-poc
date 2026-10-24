export type ConversationMessageView = {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type ConversationSummary = {
  id: string;
  title: string;
  model: string;
  provider: string;
  jobId: string;
  preview: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversationDetail = ConversationSummary & {
  messages: ConversationMessageView[];
};

export type CreateInitialConversationInput = {
  jobId: string;
  userId: string;
  title: string;
  provider: string;
  model: string;
  systemContent: string;
  userContent: string;
  assistantContent: string;
};
