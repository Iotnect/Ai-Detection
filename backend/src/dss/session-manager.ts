import { DssClient, type DssSession } from "./client.js";
import { DssHttpError } from "./http-client.js";
import type { AppLogger } from "../logging.js";

export class DssSessionManager {
  private session?: DssSession;
  private authentication?: Promise<DssSession>;
  private keepAliveTimer?: NodeJS.Timeout;
  private refreshTimer?: NodeJS.Timeout;
  private maintenance: Promise<void> = Promise.resolve();
  private stopped = false;

  constructor(
    private readonly client: DssClient,
    private readonly keepAliveIntervalMs: number,
    private readonly refreshIntervalMs: number,
    private readonly logger: AppLogger,
  ) {}

  async start(): Promise<void> {
    this.stopped = false;

    this.keepAliveTimer = setInterval(
      () => this.scheduleMaintenance(() => this.runKeepAlive(), "DSS keepalive failed"),
      this.keepAliveIntervalMs,
    );
    this.refreshTimer = setInterval(
      () =>
        this.scheduleMaintenance(
          () => this.runTokenRefresh(),
          "DSS token refresh failed",
        ),
      this.refreshIntervalMs,
    );
    this.keepAliveTimer.unref();
    this.refreshTimer.unref();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    clearInterval(this.keepAliveTimer);
    clearInterval(this.refreshTimer);
    const session = this.session;
    this.session = undefined;

    if (session) {
      try {
        await this.client.logout(session.token);
        this.logger.info({}, "DSS session logged out");
      } catch (error) {
        this.logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          "DSS logout failed during shutdown",
        );
      }
    }
  }

  async getToken(): Promise<string> {
    if (this.session) {
      return this.session.token;
    }

    if (!this.authentication) {
      this.authentication = this.client
        .authenticate()
        .then((session) => {
          if (this.stopped) {
            throw new Error("DSS session manager has stopped");
          }

          this.session = session;
          this.logger.info({}, "DSS authentication succeeded");
          return session;
        })
        .finally(() => {
          this.authentication = undefined;
        });
    }

    return (await this.authentication).token;
  }

  invalidate(): void {
    this.session = undefined;
  }

  private async runKeepAlive(): Promise<void> {
    if (this.stopped) {
      return;
    }

    const token = await this.getToken();
    await this.client.keepAlive(token);
  }

  private async runTokenRefresh(): Promise<void> {
    if (this.stopped) {
      return;
    }

    const token = await this.getToken();
    this.session = await this.client.updateToken(token);
    this.logger.info({}, "DSS session token refreshed");
  }

  private scheduleMaintenance(
    operation: () => Promise<void>,
    failureMessage: string,
  ): void {
    this.maintenance = this.maintenance
      .then(operation, operation)
      .catch((error: unknown) => {
        this.handleSessionFailure(error, failureMessage);
      });
  }

  private handleSessionFailure(error: unknown, message: string): void {
    const unauthorized = error instanceof DssHttpError && error.statusCode === 401;
    this.invalidate();

    this.logger.warn(
      {
        unauthorized,
        error: error instanceof Error ? error.message : String(error),
      },
      message,
    );
  }
}
