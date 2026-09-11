export type FilterOperator =
  | "eq"      // Equal
  | "ne"      // Not equal
  | "gt"      // Greater than
  | "gte"     // Greater than or equal
  | "lt"      // Less than
  | "lte"     // Less than or equal
  | "in"      // In array
  | "nin"     // Not in array
  | "like"    // Contains (case insensitive)
  | "ilike"   // Contains (PostgreSQL)
  | "between" // Between two values
  | "isNull"  // Is null
  | "isNotNull"; // Is not null

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value?: any;
}

export interface QueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
  search?: string;
  searchFields?: string[];
  filters?: Record<string, any>;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
