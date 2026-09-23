import http from "node:http";
import https from "node:https";

export interface DssHttpResponse<T> {
  statusCode: number;
  body: T;
}

export class DssHttpError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly platformCode?: number,
  ) {
    super(message);
    this.name = "DssHttpError";
  }
}

export class DssHttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly rejectUnauthorized: boolean,
  ) {}

  request<T>(
    method: string,
    path: string,
    body?: unknown,
    token?: string,
  ): Promise<DssHttpResponse<T>> {
    const url = new URL(path, this.baseUrl);
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const transport = url.protocol === "https:" ? https : http;

    return new Promise((resolve, reject) => {
      const request = transport.request(
        url,
        {
          method,
          rejectUnauthorized: this.rejectUnauthorized,
          headers: {
            Accept: "application/json",
            ...(payload
              ? {
                  "Content-Type": "application/json",
                  "Content-Length": Buffer.byteLength(payload),
                }
              : {}),
            ...(token ? { "X-Subject-Token": token } : {}),
          },
        },
        (response) => {
          const chunks: Buffer[] = [];

          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");

            try {
              resolve({
                statusCode: response.statusCode ?? 0,
                body: (text ? JSON.parse(text) : {}) as T,
              });
            } catch {
              reject(
                new DssHttpError(
                  "DSS returned a non-JSON response",
                  response.statusCode,
                ),
              );
            }
          });
        },
      );

      request.setTimeout(15_000, () => {
        request.destroy(new DssHttpError("DSS request timed out"));
      });
      request.on("error", reject);

      if (payload) {
        request.write(payload);
      }

      request.end();
    });
  }
}
