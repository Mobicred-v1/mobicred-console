import { Params } from "nestjs-pino";

export const loggerConfig: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL || "info",
    transport:
      process.env.NODE_ENV !== "production"
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              singleLine: true,
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
            },
          }
        : undefined,
    autoLogging: {
      ignore: (req) => {
        // Don't log health check requests
        return req.url?.includes("/health") || false;
      },
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers['set-cookie']",
        "body.password",
        "body.token",
        "body.secret",
      ],
      censor: "[REDACTED]",
    },
    customProps: (req) => ({
      requestId: req.id,
      userAgent: req.headers["user-agent"],
    }),
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage: (req, res, err) => {
      return `${req.method} ${req.url} failed: ${err.message}`;
    },
  },
};
