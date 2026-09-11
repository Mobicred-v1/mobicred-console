import { FilterCondition, QueryOptions, PaginatedResult } from "./filter.types";

/**
 * Parse filters to Prisma where conditions
 */
export function parseFiltersToPrisma(query: Record<string, any>): Record<string, any> {
  const where: Record<string, any> = {};

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (["page", "limit", "sortBy", "sortOrder", "search", "searchFields"].includes(key)) continue;

    const parts = key.split("__");
    const field = parts[0];
    const operator = parts[1] || "eq";

    where[field] = convertOperator(operator, value);
  }

  return where;
}

function convertOperator(op: string, value: any): any {
  switch (op) {
    case "eq": return value;
    case "ne": return { not: value };
    case "gt": return { gt: value };
    case "gte": return { gte: value };
    case "lt": return { lt: value };
    case "lte": return { lte: value };
    case "in": return { in: Array.isArray(value) ? value : value.split(",") };
    case "nin": return { notIn: Array.isArray(value) ? value : value.split(",") };
    case "like":
    case "contains": return { contains: value, mode: "insensitive" };
    case "startsWith": return { startsWith: value, mode: "insensitive" };
    case "endsWith": return { endsWith: value, mode: "insensitive" };
    case "isNull": return value === "true" ? null : { not: null };
    case "between":
      const [min, max] = Array.isArray(value) ? value : value.split(",");
      return { gte: min, lte: max };
    default: return value;
  }
}

/**
 * Build search conditions for Prisma
 */
export function buildSearchCondition(search: string, fields: string[]): Record<string, any> {
  if (!search || fields.length === 0) return {};
  return { OR: fields.map((field) => ({ [field]: { contains: search, mode: "insensitive" } })) };
}

/**
 * Execute filtered, paginated Prisma query
 */
export async function executePrismaQuery<T>(
  model: any,
  options: QueryOptions,
  defaultSearchFields: string[] = []
): Promise<PaginatedResult<T>> {
  const { page = 1, limit = 10, sortBy = "created_at", sortOrder = "DESC" } = options;

  // Build where
  const filterWhere = options.filters ? parseFiltersToPrisma(options.filters) : {};
  const searchWhere = options.search
    ? buildSearchCondition(options.search, options.searchFields || defaultSearchFields)
    : {};

  const where = {
    ...filterWhere,
    ...searchWhere,
    deleted_at: null,
  };

  const [items, total] = await Promise.all([
    model.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder.toLowerCase() },
    }),
    model.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
