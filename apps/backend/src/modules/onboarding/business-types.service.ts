import { prisma } from '../../infrastructure/database/prisma';
import catalog from '../../data/business-types.seed.json';

interface SeedType {
  id: string;
  label: string;
  icon: string;
  category: string;
  industry: string;
  description: string;
  keywords: string[];
}

const SEED_CATALOG = catalog as SeedType[];

export class BusinessTypesService {
  private seeded = false;

  async ensureSeeded() {
    if (this.seeded) return;
    const count = await prisma.businessTypeDefinition.count();
    if (count > 0) {
      this.seeded = true;
      return;
    }

    await prisma.$transaction(
      SEED_CATALOG.map((item, index) =>
        prisma.businessTypeDefinition.upsert({
          where: { id: item.id },
          create: {
            id: item.id,
            label: item.label,
            icon: item.icon,
            category: item.category,
            industry: item.industry,
            description: item.description,
            keywords: item.keywords,
            sortOrder: index,
          },
          update: {
            label: item.label,
            icon: item.icon,
            category: item.category,
            industry: item.industry,
            description: item.description,
            keywords: item.keywords,
            sortOrder: index,
            isActive: true,
          },
        })
      )
    );
    this.seeded = true;
  }

  async listGrouped() {
    await this.ensureSeeded();
    const rows = await prisma.businessTypeDefinition.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    const categories = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = categories.get(row.category) ?? [];
      list.push(row);
      categories.set(row.category, list);
    }

    return {
      total: rows.length,
      categories: Array.from(categories.entries()).map(([category, types]) => ({
        category,
        types: types.map((t) => ({
          id: t.id,
          label: t.label,
          icon: t.icon,
          category: t.category,
          industry: t.industry,
          description: t.description,
          keywords: t.keywords,
        })),
      })),
      types: rows.map((t) => ({
        id: t.id,
        label: t.label,
        icon: t.icon,
        category: t.category,
        industry: t.industry,
        description: t.description,
        keywords: t.keywords,
      })),
    };
  }
}

export const businessTypesService = new BusinessTypesService();
