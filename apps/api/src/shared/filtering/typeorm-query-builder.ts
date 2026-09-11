import { SelectQueryBuilder, Brackets } from "typeorm";
import { FilterCondition, QueryOptions, PaginatedResult } from "./filter.types";

/**
 * Parse filter parameters from query string
 * Supports format: field__operator=value (e.g., age__gte=18, name__like=john)
 */
export function parseFilters(query: Record<string, any>): FilterCondition[] {
  const conditions: FilterCondition[] = [];
  const operatorMap: Record<string, string> = {
    eq: "eq", ne: "ne", gt: "gt", gte: "gte", lt: "lt", lte: "lte",
    in: "in", nin: "nin", like: "like", ilike: "ilike",
    between: "between", isNull: "isNull", isNotNull: "isNotNull",
  };

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (["page", "limit", "sortBy", "sortOrder", "search", "searchFields"].includes(key)) continue;

    const parts = key.split("__");
    const field = parts[0];
    const operatorKey = parts[1] || "eq";
    const operator = operatorMap[operatorKey] || "eq";

    conditions.push({ field, operator: operator as any, value });
  }

  return conditions;
}

/**
 * Apply filters to TypeORM QueryBuilder
 */
export function applyFilters<T>(
  qb: SelectQueryBuilder<T>,
  conditions: FilterCondition[],
  alias: string
): SelectQueryBuilder<T> {
  for (const { field, operator, value } of conditions) {
    const paramKey = `${field}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const col = `${alias}.${field}`;

    switch (operator) {
      case "eq":
        qb.andWhere(`${col} = :${paramKey}`, { [paramKey]: value });
        break;
      case "ne":
        qb.andWhere(`${col} != :${paramKey}`, { [paramKey]: value });
        break;
      case "gt":
        qb.andWhere(`${col} > :${paramKey}`, { [paramKey]: value });
        break;
      case "gte":
        qb.andWhere(`${col} >= :${paramKey}`, { [paramKey]: value });
        break;
      case "lt":
        qb.andWhere(`${col} < :${paramKey}`, { [paramKey]: value });
        break;
      case "lte":
        qb.andWhere(`${col} <= :${paramKey}`, { [paramKey]: value });
        break;
      case "in":
        qb.andWhere(`${col} IN (:...${paramKey})`, {
          [paramKey]: Array.isArray(value) ? value : value.split(",")
        });
        break;
      case "nin":
        qb.andWhere(`${col} NOT IN (:...${paramKey})`, {
          [paramKey]: Array.isArray(value) ? value : value.split(",")
        });
        break;
      case "like":
        qb.andWhere(`LOWER(${col}) LIKE LOWER(:${paramKey})`, { [paramKey]: `%${value}%` });
        break;
      case "ilike":
        qb.andWhere(`${col} ILIKE :${paramKey}`, { [paramKey]: `%${value}%` });
        break;
      case "between":
        const [min, max] = Array.isArray(value) ? value : value.split(",");
        qb.andWhere(`${col} BETWEEN :${paramKey}_min AND :${paramKey}_max`, {
          [`${paramKey}_min`]: min, [`${paramKey}_max`]: max
        });
        break;
      case "isNull":
        qb.andWhere(`${col} IS NULL`);
        break;
      case "isNotNull":
        qb.andWhere(`${col} IS NOT NULL`);
        break;
    }
  }
  return qb;
}

/**
 * Apply search across multiple fields
 */
export function applySearch<T>(
  qb: SelectQueryBuilder<T>,
  search: string,
  fields: string[],
  alias: string
): SelectQueryBuilder<T> {
  if (!search || fields.length === 0) return qb;

  qb.andWhere(new Brackets((sub) => {
    for (const field of fields) {
      sub.orWhere(`LOWER(${alias}.${field}) LIKE LOWER(:search)`, { search: `%${search}%` });
    }
  }));

  return qb;
}

/**
 * Execute filtered, paginated query
 */
export async function executeQuery<T>(
  qb: SelectQueryBuilder<T>,
  options: QueryOptions,
  alias: string,
  defaultSearchFields: string[] = []
): Promise<PaginatedResult<T>> {
  const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "DESC" } = options;

  // Apply filters
  if (options.filters) {
    applyFilters(qb, parseFilters(options.filters), alias);
  }

  // Apply search
  if (options.search) {
    applySearch(qb, options.search, options.searchFields || defaultSearchFields, alias);
  }

  // Get total before pagination
  const total = await qb.getCount();

  // Apply pagination
  qb.skip((page - 1) * limit).take(limit).orderBy(`${alias}.${sortBy}`, sortOrder);

  const items = await qb.getMany();
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
