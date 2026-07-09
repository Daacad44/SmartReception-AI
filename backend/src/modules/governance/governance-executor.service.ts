import { prisma } from '../../infrastructure/database/prisma';
import { knowledgeService } from '../knowledge/knowledge.service';
import { businessProfileService } from '../business-profile/business-profile.service';
import { whatsappModuleService } from '../whatsapp/whatsapp.service';
import { storageService } from '../../infrastructure/storage';
import { decryptToken, encryptToken, isEncryptedToken } from '../../infrastructure/crypto/token-crypto';
import { invalidateKnowledgeCache } from '../../infrastructure/ai/knowledge-search.service';
import { invalidateBusinessTenantCache } from '../../infrastructure/ai/business-tenant-cache.service';
import type {
  GovernanceApprovalRequest,
  GovernanceActionType,
  AiTrainingJobType,
} from '@prisma/client';
import type { CreateFaqInput } from '@smartreception/shared';
import { NotFoundError } from '../../core/errors';

function restorePayload(
  actionType: GovernanceActionType,
  payload: Record<string, unknown>
): Record<string, unknown> {
  if (actionType === 'WHATSAPP_CONNECT' && typeof payload.accessToken === 'string') {
    const token = payload.accessToken;
    return {
      ...payload,
      accessToken: isEncryptedToken(token) ? decryptToken(token) : token,
    };
  }
  return payload;
}

async function stagedFileAsMulter(request: GovernanceApprovalRequest): Promise<Express.Multer.File> {
  if (!request.stagingStorageKey) {
    throw new NotFoundError('Staged file not found for this request');
  }
  const buffer = await storageService.download(request.stagingStorageKey);
  return {
    buffer,
    originalname: request.stagingFilename ?? 'upload',
    mimetype: request.stagingMimeType ?? 'application/octet-stream',
    size: buffer.length,
  } as Express.Multer.File;
}

export async function executeGovernanceAction(
  request: GovernanceApprovalRequest,
  userId: string
): Promise<unknown> {
  const payload = restorePayload(
    request.actionType,
    request.payload as Record<string, unknown>
  );
  const businessId = request.businessId;

  switch (request.actionType) {
    case 'AI_UPLOAD_DOCUMENT': {
      const file = await stagedFileAsMulter(request);
      const result = await knowledgeService.uploadDocument(
        businessId,
        file,
        payload.title as string | undefined,
        payload.knowledgeBaseId as string | undefined
      );
      if (request.stagingStorageKey) {
        try {
          await storageService.delete(request.stagingStorageKey);
        } catch {
          // Staging cleanup is best-effort
        }
      }
      return result;
    }
    case 'AI_DELETE_DOCUMENT':
      return knowledgeService.deleteDocument(
        businessId,
        payload.documentId as string,
        userId
      );
    case 'AI_CREATE_FAQ':
      return knowledgeService.createFaq(
        businessId,
        payload as CreateFaqInput,
        userId
      );
    case 'AI_UPDATE_FAQ':
      return knowledgeService.updateFaq(
        businessId,
        payload.documentId as string,
        payload as Partial<CreateFaqInput>,
        userId
      );
    case 'AI_DELETE_FAQ':
      return knowledgeService.deleteFaq(businessId, payload.documentId as string, userId);
    case 'AI_CLEAR_KNOWLEDGE':
      return knowledgeService.clearKnowledgeBase(businessId, userId);
    case 'AI_UPDATE_PROFILE':
      return businessProfileService.update(businessId, payload);
    case 'AI_UPLOAD_PROFILE_PDF': {
      const file = await stagedFileAsMulter(request);
      const result = await businessProfileService.uploadPdf(
        businessId,
        file.buffer,
        file.originalname
      );
      if (request.stagingStorageKey) {
        try {
          await storageService.delete(request.stagingStorageKey);
        } catch {
          // Best-effort
        }
      }
      return result;
    }
    case 'AI_DELETE_PROFILE_PDF':
      return businessProfileService.deletePdf(businessId);
    case 'AI_CLEAR_PROFILE':
      return businessProfileService.clearProfile(businessId);
    case 'AI_REINDEX': {
      const documents = await prisma.knowledgeDocument.findMany({
        where: { knowledgeBase: { businessId }, status: { not: 'FAILED' } },
        select: { id: true, knowledgeBaseId: true },
      });
      for (const doc of documents) {
        await knowledgeService.processDocument(businessId, doc.id);
      }
      return { reindexed: documents.length };
    }
    case 'AI_RESET_MEMORY':
    case 'AI_DELETE_EMBEDDINGS': {
      const result = await prisma.knowledgeDocument.updateMany({
        where: { knowledgeBase: { businessId } },
        data: { embedding: null, status: 'UPLOADED' },
      });
      invalidateKnowledgeCache(businessId);
      invalidateBusinessTenantCache(businessId);
      return { affected: result.count };
    }
    case 'AI_TRAIN':
    case 'AI_RETRAIN':
    case 'AI_REBUILD_EMBEDDINGS': {
      // Authorization redeemed — now queue the versioned training pipeline
      // (train → sandbox → deployment). The job type is taken from the staged
      // payload, falling back to a sensible default per action.
      const { trainingJobService } = await import('../ai-training-mgmt/training-job.service');
      const fallback: Record<string, AiTrainingJobType> = {
        AI_TRAIN: 'FULL_TRAIN',
        AI_RETRAIN: 'RETRAIN',
        AI_REBUILD_EMBEDDINGS: 'EMBED_DOCUMENTS',
      };
      const jobType = (payload.type as AiTrainingJobType) ?? fallback[request.actionType];
      const result = await trainingJobService.createJob({
        businessId,
        type: jobType,
        userId,
        trainingNotes: payload.trainingNotes as string | undefined,
        documentIds: payload.documentIds as string[] | undefined,
      });
      return { jobId: result.job.id, existing: result.existing, type: jobType };
    }
    case 'WHATSAPP_CONNECT':
      return whatsappModuleService.connectAccount(businessId, {
        phoneNumberId: payload.phoneNumberId as string,
        phoneNumber: payload.phoneNumber as string,
        displayName: payload.displayName as string | undefined,
        wabaId: payload.wabaId as string | undefined,
        accessToken: payload.accessToken as string,
      });
    case 'WHATSAPP_DISCONNECT':
      return whatsappModuleService.disconnectAccount(
        businessId,
        payload.accountId as string
      );
    default:
      throw new NotFoundError(`Unsupported governance action: ${request.actionType}`);
  }
}

export function sanitizePayloadForStorage(
  actionType: GovernanceActionType,
  payload: Record<string, unknown>
): Record<string, unknown> {
  if (actionType === 'WHATSAPP_CONNECT' && typeof payload.accessToken === 'string') {
    return { ...payload, accessToken: encryptToken(payload.accessToken) };
  }
  return payload;
}
