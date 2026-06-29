export type TrainingOperation =
  | 'TRAIN_ONE'
  | 'RETRAIN_ONE'
  | 'TRAIN_MULTIPLE'
  | 'TRAIN_ALL'
  | 'REBUILD_EMBEDDINGS'
  | 'REINDEX'
  | 'VALIDATE'
  | 'OPTIMIZE'
  | 'DELETE_OLD_EMBEDDINGS'
  | 'GENERATE_EMBEDDINGS'
  | 'PREVIEW'
  | 'ROLLBACK'
  | 'COMPARE_VERSIONS';

export interface TrainingBusinessCard {
  businessId: string;
  name: string;
  logoUrl?: string | null;
  industry: string;
  status: string;
  knowledgeBaseSize: number;
  documents: number;
  faqs: number;
  products: number;
  services: number;
  embeddingsCount: number;
  knowledgeHealth: number;
  trainingStatus: string;
  lastTraining?: string | null;
  lastRetraining?: string | null;
  currentAiProvider: string;
  embeddingStatus: string;
  knowledgeVersion?: number | null;
  aiVersion: string;
  estimatedTrainingCost: number;
  trainingHealthScore?: number | null;
  productionVersionId?: string | null;
  sandboxVersionId?: string | null;
  lastJob?: {
    id: string;
    type: string;
    status: string;
    completedAt?: string | null;
    createdAt: string;
  } | null;
}

export interface TrainingVerificationRequest {
  requestId: string;
  operation: TrainingOperation;
  operationLabel: string;
  businessIds: string[];
  otpExpiresAt: string;
  message: string;
}

export interface TrainingSessionLog {
  id: string;
  jobId?: string | null;
  businessId: string;
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number | null;
  trainingType: string;
  knowledgeCount: number;
  documentsCount: number;
  faqCount: number;
  embeddingsCreated: number;
  embeddingsUpdated: number;
  embeddingsDeleted: number;
  tokensUsed: number;
  estimatedCost: number | string;
  qualityScore?: number | null;
  status: string;
  warnings?: unknown;
  errors?: unknown;
  validationResult?: Record<string, unknown> | null;
  business?: { id: string; name: string };
  operator?: { firstName: string; lastName: string; email: string } | null;
}

export const TRAINING_OPERATION_LABELS: Record<TrainingOperation, string> = {
  TRAIN_ONE: 'Train Business',
  RETRAIN_ONE: 'Retrain Business',
  TRAIN_MULTIPLE: 'Train Selected Businesses',
  TRAIN_ALL: 'Train All Businesses',
  REBUILD_EMBEDDINGS: 'Rebuild Embeddings',
  REINDEX: 'Reindex Knowledge',
  VALIDATE: 'Validate Knowledge',
  OPTIMIZE: 'Optimize Knowledge',
  DELETE_OLD_EMBEDDINGS: 'Delete Old Embeddings',
  GENERATE_EMBEDDINGS: 'Generate Embeddings',
  PREVIEW: 'Preview Training',
  ROLLBACK: 'Rollback Version',
  COMPARE_VERSIONS: 'Compare Versions',
};
