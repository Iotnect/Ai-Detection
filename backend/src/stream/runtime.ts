import { config } from "../config.js";
import { createCameraInventoryStore } from "../db/camera-inventory-store.js";
import { DssCameraSynchronizer } from "../dss/camera-sync.js";
import { DssClient } from "../dss/client.js";
import { DssSessionManager } from "../dss/session-manager.js";
import type { AppLogger } from "../logging.js";
import { StreamSupervisor, type StreamStatus } from "./supervisor.js";

export interface StreamRuntime {
  start(): Promise<void>;
  stop(): Promise<void>;
  requestCamera(path: string, channelId: string): Promise<boolean>;
  touchCamera(path: string): void;
  status(): StreamStatus;
}

const disabledStatus: StreamStatus = {
  state: "idle",
  restartCount: 0,
  updatedAt: new Date().toISOString(),
};

export function createStreamRuntime(logger: AppLogger): StreamRuntime {
  if (!config.dss) {
    return {
      async start() {
        logger.info({}, "DSS stream automation is disabled");
      },
      async stop() {},
      async requestCamera() { return false; },
      touchCamera() {},
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
  const supervisor = config.mediaMtxPublishUrl
    ? new StreamSupervisor(
        client,
        sessionManager,
        config.dss.channelId,
        config.mediaMtxPublishUrl,
        config.ffmpegPath,
        config.streamTranscodeH264,
        logger,
      )
    : undefined;
  const relays = new Map<string, { supervisor: StreamSupervisor; timer?: NodeJS.Timeout; stopping?: Promise<void> }>();
  let shuttingDown = false;
  function touchCamera(path: string) {
    const relay = relays.get(path);
    if (!relay || relay.stopping || shuttingDown) return;
    clearTimeout(relay.timer);
    relay.timer = setTimeout(() => {
      relay.stopping = relay.supervisor.stop().finally(() => relays.delete(path));
    }, 45_000);
    relay.timer.unref();
  }
  async function requestCamera(path: string, channelId: string): Promise<boolean> {
    if (!config.mediaMtxPublishUrl || shuttingDown) return false;
    const existing = relays.get(path);
    if (existing?.stopping) {
      await existing.stopping;
      return requestCamera(path, channelId);
    }
    if (!existing) {
      const url = new URL(config.mediaMtxPublishUrl);
      url.pathname = "/" + path;
      const supervisor = new StreamSupervisor(client, sessionManager, channelId, url.href,
        config.ffmpegPath, config.streamTranscodeH264, logger);
      relays.set(path, { supervisor });
      supervisor.start();
    }
    touchCamera(path);
    return true;
  }
  const inventoryStore = createCameraInventoryStore(config.dss?.cameraStatusIntervalMs);
  const cameraSynchronizer = inventoryStore
    ? new DssCameraSynchronizer(
        client,
        sessionManager,
        inventoryStore,
        config.dss.channelId,
        config.dss.cameraDiscoveryIntervalMs,
        config.dss.cameraStatusIntervalMs,
        logger,
      )
    : undefined;

  return {
    async start() {
      await sessionManager.start();
      supervisor?.start();
      cameraSynchronizer?.start();

      if (!cameraSynchronizer) {
        logger.info({}, "DSS camera inventory sync is disabled");
      }
    },
    requestCamera, touchCamera,
    async stop() {
      shuttingDown = true;
      await Promise.all([...relays.values()].map(relay => {
        clearTimeout(relay.timer);
        return relay.stopping ?? relay.supervisor.stop();
      }));
      await cameraSynchronizer?.stop();
      await supervisor?.stop();
      await sessionManager.stop();
    },
    status: () => supervisor?.getStatus() ?? { ...disabledStatus },
  };
}
