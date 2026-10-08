import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../core/errors';
import { prisma } from '../../infrastructure/database/prisma';
import type { SaveWorkflowInput } from './ai-agent-studio.schemas';

type Node = { id: string; type: string; config: Record<string, unknown> };
type Edge = { id: string; source: string; target: string };
const json = (value: unknown) => value as Prisma.InputJsonValue;

export function validateWorkflow(nodes: Node[], edges: Edge[]) {
  const errors: string[] = [];
  const ids = new Set(nodes.map((node) => node.id));
  if (ids.size !== nodes.length) errors.push('Node identifiers must be unique');
  if (nodes.filter((node) => node.type === 'TRIGGER').length !== 1) errors.push('Workflow requires exactly one trigger');
  if (!nodes.some((node) => node.type === 'END')) errors.push('Workflow requires an end node');
  for (const edge of edges) if (!ids.has(edge.source) || !ids.has(edge.target)) errors.push(`Edge ${edge.id} references a missing node`);
  const adjacency = new Map<string, string[]>();
  edges.forEach((edge) => adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]));
  const visiting = new Set<string>(); const visited = new Set<string>();
  const cycle = (id: string): boolean => { if (visiting.has(id)) return true; if (visited.has(id)) return false; visiting.add(id); const found = (adjacency.get(id) ?? []).some(cycle); visiting.delete(id); visited.add(id); return found; };
  if (nodes.some((node) => cycle(node.id))) errors.push('Workflow cycles are not allowed');
  return { valid: errors.length === 0, errors, nodeCount: nodes.length, edgeCount: edges.length };
}

export class AgentWorkflowService {
  list(businessId: string, agentId: string) { return prisma.aiAutomationWorkflow.findMany({ where: { businessId, agentId }, orderBy: { updatedAt: 'desc' } }); }
  async save(businessId: string, agentId: string, workflowId: string | undefined, input: SaveWorkflowInput, userId: string) {
    if (!await prisma.aiAgent.findFirst({ where: { id: agentId, businessId } })) throw new NotFoundError('AI agent not found');
    if (workflowId && !input.expectedRevision) throw new ValidationError('Expected workflow revision is required');
    const validation = validateWorkflow(input.nodes, input.edges);
    if (input.publish && !validation.valid) throw new ValidationError(validation.errors.join('; '));
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`agent-workflow:${agentId}`}))`;
      const data = { name: input.name, description: input.description, triggerType: input.triggerType, nodes: json(input.nodes), edges: json(input.edges), validation: json(validation), status: input.publish ? 'ACTIVE' as const : validation.valid ? 'VALIDATED' as const : 'DRAFT' as const, ...(input.publish ? { publishedAt: new Date() } : {}), updatedByUserId: userId };
      const workflow = workflowId
        ? await tx.aiAutomationWorkflow.update({ where: { id: workflowId, businessId, agentId, revision: input.expectedRevision }, data: { ...data, revision: { increment: 1 } } }).catch(() => { throw new ValidationError('Workflow changed or was not found; refresh and try again'); })
        : await tx.aiAutomationWorkflow.create({ data: { businessId, agentId, ...data, createdByUserId: userId } });
      if (input.publish) await tx.aiAutomationWorkflow.updateMany({ where: { agentId, status: 'ACTIVE', id: { not: workflow.id } }, data: { status: 'ARCHIVED' } });
      await tx.auditLog.create({ data: { businessId, userId, action: workflowId ? 'UPDATE' : 'CREATE', entity: 'AiAutomationWorkflow', entityId: workflow.id, newData: json({ revision: workflow.revision, status: workflow.status, validation }) } });
      return workflow;
    });
  }
}
export const agentWorkflowService = new AgentWorkflowService();
