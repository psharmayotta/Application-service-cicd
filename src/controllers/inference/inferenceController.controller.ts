import express, { Request, Response } from 'express';
import { APP_ROUTES } from '../../core/AppRoutes';
import { InferenceService } from '../../services/inference/inferenceService.services';
import { BaseController } from '../baseController.controller';
import { StatusCode, ResponseStatus } from '../../config';
import { Readable } from 'stream'; // Import Node.js stream module
import { ReadableStream } from 'stream/web'; 

export class InferenceController extends BaseController {
  constructor(
    protected path: APP_ROUTES.INFERENCE,
    public router = express.Router(),
    public service: InferenceService = new InferenceService()
  ) {
    super(path, router, service);
  }

  public _initialiseRoutes(): void {
    super._initialiseRoutes();
    this.router.post(`${this.path}`, this.handleInference.bind(this));
    this.router.post(`${this.path}/api-key`, this.handleInferenceNew.bind(this));
  }

// Explicitly import Node.js Web Streams

protected async handleInference(req: Request, res: Response) {
  const apiKey = req.header('api-key');
  const modelId = req.header('model-id');
   const sessionId = req.header("session-id");
  const inputData = req.body;

  if (!apiKey || !modelId) {
    res.status(400).json({ success: false, message: 'Missing api-key or model-id in headers' });
    return;
  }

  try {
    // Expect a Node.js Readable stream
    const { stream, headers } = await this.service.processInference(inputData, modelId, apiKey, sessionId) as {
      stream: Readable;
      headers: Record<string, string>;
    };

    // Set response headers
    if (headers["content-type"]) {
      res.setHeader("Content-Type", headers["content-type"]);
    } else {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
    }
    res.setHeader("Transfer-Encoding", "chunked");

    // Pipe the Node.js Readable stream to the response
    stream.pipe(res);

    // Handle stream errors
    stream.on("error", (err) => {
      console.error("Stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "Error streaming data" });
      } else {
        res.end();
      }
    });

    // Handle stream end
    stream.on("end", () => {
      res.end();
    });
  } catch (error) {
    console.error("Inference error:", error);
    await this.service.logInferenceFailure(modelId, apiKey, error, sessionId);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Error processing inference" });
    } else {
      res.end();
    }
  }
}
protected async handleInferenceNew(req: Request, res: Response) {
  const apiKey = req.header('api-key');
  const modelId = req.header('model-id');
   const sessionId = req.header("session-id");
  const inputData = req.body;

  if (!apiKey || !modelId) {
    res.status(400).json({ success: false, message: 'Missing api-key or model-id in headers' });
    return;
  }

  try {
    // Expect a Node.js Readable stream
    const { stream, headers } = await this.service.processInferenceNew(inputData, modelId, apiKey, sessionId) as {
      stream: Readable;
      headers: Record<string, string>;
    };

    // Set response headers
    if (headers["content-type"]) {
      res.setHeader("Content-Type", headers["content-type"]);
    } else {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
    }
    res.setHeader("Transfer-Encoding", "chunked");

    // Pipe the Node.js Readable stream to the response
    stream.pipe(res);

    // Handle stream errors
    stream.on("error", (err) => {
      console.error("Stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "Error streaming data" });
      } else {
        res.end();
      }
    });

    // Handle stream end
    stream.on("end", () => {
      res.end();
    });
  } catch (error) {
    console.error("Inference error:", error);
    await this.service.logInferenceFailure(modelId, apiKey, error, sessionId);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Error processing inference" });
    } else {
      res.end();
    }
  }
}
}
