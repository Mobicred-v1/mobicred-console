/**
 * API Version Migration Helper
 *
 * Utilities for migrating between API versions
 */

export interface MigrationRule<TFrom, TTo> {
  fromVersion: string;
  toVersion: string;
  transform: (data: TFrom) => TTo;
}

export class VersionMigrator<T = any> {
  private rules: MigrationRule<any, any>[] = [];

  /**
   * Register a migration rule
   */
  register<TFrom, TTo>(
    fromVersion: string,
    toVersion: string,
    transform: (data: TFrom) => TTo
  ): this {
    this.rules.push({ fromVersion, toVersion, transform });
    return this;
  }

  /**
   * Migrate data from one version to another
   */
  migrate(data: T, fromVersion: string, toVersion: string): T {
    if (fromVersion === toVersion) return data;

    const path = this.findMigrationPath(fromVersion, toVersion);
    if (!path) {
      throw new Error(
        `No migration path found from v${fromVersion} to v${toVersion}`
      );
    }

    let result = data;
    for (const rule of path) {
      result = rule.transform(result);
    }

    return result;
  }

  private findMigrationPath(
    from: string,
    to: string
  ): MigrationRule<any, any>[] | null {
    // Simple linear path finding
    const path: MigrationRule<any, any>[] = [];
    let current = from;

    while (current !== to) {
      const rule = this.rules.find((r) => r.fromVersion === current);
      if (!rule) return null;
      path.push(rule);
      current = rule.toVersion;
    }

    return path;
  }
}

/**
 * Example usage:
 *
 * const userMigrator = new VersionMigrator<UserDto>();
 *
 * userMigrator
 *   .register("1", "2", (v1User) => ({
 *     ...v1User,
 *     fullName: `${v1User.firstName} ${v1User.lastName}`,
 *   }))
 *   .register("2", "3", (v2User) => ({
 *     ...v2User,
 *     email: v2User.email.toLowerCase(),
 *   }));
 *
 * const v3User = userMigrator.migrate(v1User, "1", "3");
 */

/**
 * Decorator for automatic response transformation based on version
 */
export function TransformForVersion<T>(
  migrator: VersionMigrator<T>,
  targetVersion: string
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);
      const request = args.find((arg) => arg?.apiVersion);
      const currentVersion = request?.apiVersion || "1";

      if (currentVersion !== targetVersion) {
        return migrator.migrate(result, targetVersion, currentVersion);
      }

      return result;
    };

    return descriptor;
  };
}
