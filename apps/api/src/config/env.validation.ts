import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3005),
  API_PREFIX: Joi.string().trim().default('api/v1'),
  APP_NAME: Joi.string().trim().default('mobicred-console-api'),

  DATABASE_URL: Joi.string()
    .trim()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .optional(),
  DATABASE_SSL: Joi.boolean().truthy('true').falsy('false').default(false),
  DATABASE_LOGGING: Joi.boolean().truthy('true').falsy('false').default(false),

  CORE_API_URL: Joi.string().trim().uri().optional(),
  PAYMENT_GATEWAY_URL: Joi.string().trim().uri().optional(),
  CREDIT_INTELLIGENCE_URL: Joi.string().trim().uri().optional(),
  KEYCLOAK_ISSUER: Joi.string().trim().uri().optional(),

  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose')
    .default('info'),
  CORS_ORIGINS: Joi.string().trim().allow('').default('http://localhost:3006'),
})
  .prefs({
    abortEarly: false,
    allowUnknown: true,
    convert: true,
  });

export type ValidatedEnv = {
  NODE_ENV: 'development' | 'test' | 'staging' | 'production';
  PORT: number;
  API_PREFIX: string;
  APP_NAME: string;
  DATABASE_URL?: string;
  DATABASE_SSL: boolean;
  DATABASE_LOGGING: boolean;
  CORE_API_URL?: string;
  PAYMENT_GATEWAY_URL?: string;
  CREDIT_INTELLIGENCE_URL?: string;
  KEYCLOAK_ISSUER?: string;
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  CORS_ORIGINS: string;
};

export function validateEnv(config: Record<string, unknown>): ValidatedEnv {
  const { error, value } = envValidationSchema.validate(config);

  if (error) {
    const message = error.details
      .map((detail) => `  - ${detail.path.join('.')}: ${detail.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${message}`);
  }

  return value as ValidatedEnv;
}
