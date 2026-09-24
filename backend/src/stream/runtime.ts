import { config } from "../config.js";
import { DssClient } from "../dss/client.js";
import { DssSessionManager } from "../dss/session-manager.js";
import type { AppLogger } from "../logging.js";
import { StreamSupervisor, type StreamStatus } from "./supervisor.js";

export interface StreamRuntime {
  start(): Promise<void>;
  stop(): Promise<void>;
  status(): StreamStatus;
}

const disabledStatus: StreamStatus = {
  state: "idle",
  restartCount: 0,
  updatedAt: new Date().toISOString(),
};

export function createStreamRuntime(logger: AppLogger): StreamRuntime {
  if (!config.dss || !config.mediaMtxPublishUrl) {
    return {
      async start() {
        logger.info({}, "DSS stream automation is disabled");
      },
      async stop() {},
      status: () => ({ ...disabledStatus }),
    };
  }

  const client = new DssClient(
    config.dss.baseUrl,
    config.dss.tlsRejectUnauthorized,
    config.dss.username,
    config.dss.password,
    config.dss.clientMac,
    config.dss.loginType,
  );
  const sessionManager = new DssSessionManager(
    client,
    config.dss.keepAliveIntervalMs,
    config.dss.tokenRefreshIntervalMs,
    logger,
  );
  const supervisor = new StreamSupervisor(
    client,
    sessionManager,
    config.dss.channelId,
    config.mediaMtxPublishUrl,
    config.ffmpegPath,
    config.streamTranscodeH264,
    logger,
  );

  return {
    async start() {
      await sessionManager.start();
      supervisor.start();
    },
    async stop() {
      await supervisor.stop();
      await sessionManager.stop();
    },
    status: () => supervisor.getStatus(),
  };
}
