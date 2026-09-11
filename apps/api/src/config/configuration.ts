import { validateEnv } from './env.validation';

export default () => {
  const env = validateEnv(process.env);

  return {
    app: {
      name: env.APP_NAME,
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
      apiPrefix: env.API_PREFIX,
      isProduction: env.NODE_ENV === 'production',
      isStaging: env.NODE_ENV === 'staging',
      isTest: env.NODE_ENV === 'test',
    },
    database: {
      url: env.DATABASE_URL,
      ssl: env.DATABASE_SSL,
      logging: env.DATABASE_LOGGING,
    },
    owners: {
      coreUrl: env.CORE_API_URL,
      paymentGatewayUrl: env.PAYMENT_GATEWAY_URL,
      creditIntelligenceUrl: env.CREDIT_INTELLIGENCE_URL,
      keycloakIssuer: env.KEYCLOAK_ISSUER,
    },
    logging: {
      level: env.LOG_LEVEL,
    },
    cors: {
      origins: env.CORS_ORIGINS
        ? env.CORS_ORIGINS.split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    },
  };
};
