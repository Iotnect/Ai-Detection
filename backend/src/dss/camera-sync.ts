import type { CameraInventoryStore } from "../db/camera-inventory-store.js";
import type { AppLogger } from "../logging.js";
import { DssClient, type DssCamera } from "./client.js";
import { DssHttpError } from "./http-client.js";
import { DssSessionManager } from "./session-manager.js";

const STATUS_BATCH_SIZE = 100;

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

export class DssCameraSynchronizer {
  private cameras: DssCamera[] = [];
  private discoveryTimer?: NodeJS.Timeout;
  private statusTimer?: NodeJS.Timeout;
  private maintenance: Promise<void> = Promise.resolve();
  private stopped = true;

  constructor(
    private readonly client: DssClient,
    private readonly sessionManager: DssSessionManager,
    private readonly store: CameraInventoryStore,
    private readonly monitoringChannelId: string,
    private readonly discoveryIntervalMs: number,
    private readonly statusIntervalMs: number,
    private readonly logger: AppLogger,
  ) {}

  start(): void {
    if (!this.stopped) return;

    this.stopped = false;
    this.schedule(() => this.discover(), "DSS camera discovery failed");
    this.discoveryTimer = setInterval(
      () => this.schedule(() => this.discover(), "DSS camera discovery failed"),
      this.discoveryIntervalMs,
    );
    this.statusTimer = setInterval(
      () => this.schedule(() => this.refreshStatuses(), "DSS camera status sync failed"),
      this.statusIntervalMs,
    );
    this.discoveryTimer.unref();
    this.statusTimer.unref();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    clearInterval(this.discoveryTimer);
    clearInterval(this.statusTimer);
    await this.maintenance;
  }

  private async discover(): Promise<void> {
    if (this.stopped) return;

    const token = await this.sessionManager.getToken();
    this.cameras = await this.client.getVideoCameras(token);
    const synchronized = await this.store.sync(
      this.cameras,
      this.monitoringChannelId,
    );

    this.logger.info(
      { cameraCount: synchronized },
      "DSS camera inventory synchronized",
    );
  }

  private async refreshStatuses(): Promise<void> {
    if (this.stopped) return;

    if (this.cameras.length === 0) {
      await this.discover();
      return;
    }

    const token = await this.sessionManager.getToken();
    const deviceCodes = Array.from(
      new Set(this.cameras.map((camera) => camera.deviceCode)),
    );
    const statusByChannel = new Map<string, boolean>();

    for (const batch of chunk(deviceCodes, STATUS_BATCH_SIZE)) {
      const statuses = await this.client.getChannelStatuses(token, batch);

      for (const status of statuses) {
        statusByChannel.set(status.channelId, status.online);
      }
    }

    this.cameras = this.cameras.map((camera) => ({
      ...camera,
      online: statusByChannel.get(camera.channelId) ?? camera.online,
    }));
    const synchronized = await this.store.sync(
      this.cameras,
      this.monitoringChannelId,
    );

    this.logger.info(
      { cameraCount: synchronized },
      "DSS camera statuses synchronized",
    );
  }

  private schedule(operation: () => Promise<void>, message: string): void {
    this.maintenance = this.maintenance
      .then(operation, operation)
      .catch((error: unknown) => {
        if (error instanceof DssHttpError && error.statusCode === 401) {
          this.sessionManager.invalidate();
        }

        this.logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          message,
        );
      });
  }
}
