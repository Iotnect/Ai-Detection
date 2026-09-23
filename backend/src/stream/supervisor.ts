import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";

import { DssClient } from "../dss/client.js";
import { DssHttpError } from "../dss/http-client.js";
import { DssSessionManager } from "../dss/session-manager.js";
import type { AppLogger } from "../logging.js";

export type StreamState = "idle" | "starting" | "online" | "reconnecting" | "stopped";

export interface StreamStatus {
  state: StreamState;
  restartCount: number;
  updatedAt: string;
}

const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 30_000];

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export class StreamSupervisor {
  private child?: ChildProcess;
  private stopping = false;
  private loop?: Promise<void>;
  private retryAbort?: AbortController;
  private status: StreamStatus = {
    state: "idle",
    restartCount: 0,
    updatedAt: new Date().toISOString(),
  };

  constructor(
    private readonly client: DssClient,
    private readonly sessionManager: DssSessionManager,
    private readonly channelId: string,
    private readonly publishUrl: string,
    private readonly ffmpegPath: string,
    private readonly transcodeH264: boolean,
    private readonly logger: AppLogger,
  ) {}

  start(): void {
    if (!this.loop) {
      this.stopping = false;
      this.loop = this.run();
    }
  }

  getStatus(): StreamStatus {
    return { ...this.status };
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.retryAbort?.abort();
    this.setState("stopped");

    if (this.child && !this.child.killed) {
      this.child.kill("SIGTERM");
    }

    await this.loop;
    this.loop = undefined;
  }

  private async run(): Promise<void> {
    let attempt = 0;

    while (!this.stopping) {
      try {
        this.setState(attempt === 0 ? "starting" : "reconnecting");
        const token = await this.sessionManager.getToken();
        const source = await this.client.startVideo(token, this.channelId);

        if (this.stopping) {
          break;
        }

        const outputCodecArguments = this.transcodeH264
          ? [
              "-c:v",
              "libx264",
              "-preset",
              "veryfast",
              "-tune",
              "zerolatency",
              "-pix_fmt",
              "yuv420p",
              "-an",
            ]
          : ["-c", "copy"];
        const child = spawn(
          this.ffmpegPath,
          [
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "warning",
            "-rtsp_transport",
            "tcp",
            "-rw_timeout",
            "15000000",
            "-i",
            source.rtspUrl,
            "-map",
            "0:v:0",
            "-map",
            "0:a?",
            ...outputCodecArguments,
            "-f",
            "rtsp",
            "-rtsp_transport",
            "tcp",
            this.publishUrl,
          ],
          { stdio: ["ignore", "ignore", "pipe"] },
        );
        this.child = child;
        child.stderr?.resume();
        this.setState("online");
        this.logger.info({}, "DSS stream relay started");

        const [exitCode, signal] = (await once(child, "exit")) as [
          number | null,
          NodeJS.Signals | null,
        ];
        this.child = undefined;

        if (this.stopping) {
          break;
        }

        throw new Error(
          `FFmpeg relay exited (code ${exitCode ?? "none"}, signal ${signal ?? "none"})`,
        );
      } catch (error) {
        if (this.stopping) {
          break;
        }

        if (error instanceof DssHttpError && error.statusCode === 401) {
          this.sessionManager.invalidate();
        }

        this.status.restartCount += 1;
        this.setState("reconnecting");
        const delay =
          RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)] ??
          30_000;
        this.logger.warn(
          {
            delayMs: delay,
            error: error instanceof Error ? error.message : String(error),
          },
          "DSS stream relay will restart with a fresh stream token",
        );
        attempt += 1;
        this.retryAbort = new AbortController();
        await wait(delay, this.retryAbort.signal);
        this.retryAbort = undefined;
      }
    }
  }

  private setState(state: StreamState): void {
    this.status.state = state;
    this.status.updatedAt = new Date().toISOString();
  }
}
