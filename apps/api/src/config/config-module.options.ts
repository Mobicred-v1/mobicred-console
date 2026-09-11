import { ConfigModuleOptions } from '@nestjs/config';
import configuration from './configuration';
import { envValidationSchema } from './env.validation';

export const configModuleOptions: ConfigModuleOptions = {
  isGlobal: true,
  load: [configuration],
  validationSchema: envValidationSchema,
  validationOptions: {
    abortEarly: false,
    allowUnknown: true,
  },
  envFilePath: ['.env.local', '.env'],
  cache: true,
  expandVariables: true,
};
