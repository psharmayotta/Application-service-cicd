import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const ENV_NAME = process.env.NODE_ENV || 'dev';

export const requestTraceMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    const sessionTraceId = req.headers['x-session-trace-id'] as string | undefined;

    (req as any).requestId = requestId;
    (req as any).sessionTraceId = sessionTraceId;

    // Forward trace headers downstream so other services can correlate
    req.headers['x-request-id'] = requestId;

    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Environment', ENV_NAME);

    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;

        // Pull OTEL traceId from active span so Loki log links to Tempo trace
        const activeSpan = trace.getActiveSpan();
        const spanContext = activeSpan?.spanContext();
        const traceId = spanContext?.traceId || null;

        if (activeSpan && res.statusCode >= 500) {
            activeSpan.setStatus({ code: SpanStatusCode.ERROR });
        }

        console.log(
            JSON.stringify({
                type: 'access',
                req_id: requestId,
                session_trace_id: sessionTraceId || null,
                traceId,
                env: ENV_NAME,
                method: req.method,
                url: req.originalUrl,
                status: res.statusCode,
                duration_ms: duration,
                ip: req.ip || req.headers['x-forwarded-for'],
            })
        );
    });

    next();
};
