import {
  constants,
  createHash,
  publicEncrypt,
  randomInt,
} from "node:crypto";

import { DssHttpClient, DssHttpError } from "./http-client.js";

interface PlatformResponse<T = unknown> {
  code?: number;
  desc?: string;
  data?: T;
  token?: string;
  credential?: string;
  duration?: number;
}

interface AuthenticationChallenge {
  realm?: string;
  randomKey?: string;
  publickey?: string;
}

interface SessionData {
  token: string;
  credential?: string;
  duration?: number;
}

interface StreamData {
  url?: string;
  token?: string | number;
}

export interface DssSession {
  token: string;
  credential?: string;
  duration?: number;
}

export interface DssStreamSource {
  rtspUrl: string;
}

const AUTH_PATH = "/brms/api/v1.0/accounts/authorize";

function md5(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

function randomAlphaNumeric(length: number): string {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  return Array.from(
    { length },
    () => characters[randomInt(0, characters.length)],
  ).join("");
}

function asPublicKeyPem(value: string): string {
  if (value.includes("BEGIN PUBLIC KEY")) {
    return value;
  }

  const lines = value.match(/.{1,64}/g)?.join("\n") ?? value;
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
}

function encryptWithPublicKey(publicKey: string, value: string): string {
  return publicEncrypt(
    {
      key: asPublicKeyPem(publicKey),
      padding: constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(value),
  ).toString("base64");
}

function requirePlatformSuccess<T>(
  response: PlatformResponse<T>,
  action: string,
): PlatformResponse<T> {
  if (response.code !== 1000) {
    throw new DssHttpError(
      `DSS ${action} failed: ${response.desc ?? "unknown platform error"}`,
      undefined,
      response.code,
    );
  }

  return response;
}

function sessionFromResponse(response: PlatformResponse<SessionData>): DssSession {
  const data = response.data;
  const token = data?.token ?? response.token;

  if (!token) {
    throw new DssHttpError("DSS authentication response has no session token");
  }

  return {
    token,
    credential: data?.credential ?? response.credential,
    duration: data?.duration ?? response.duration,
  };
}

export class DssClient {
  private readonly http: DssHttpClient;

  constructor(
    baseUrl: string,
    rejectUnauthorized: boolean,
    private readonly username: string,
    private readonly password: string,
    private readonly clientMac: string,
    private readonly loginType: "1" | "2" = "2",
  ) {
    this.http = new DssHttpClient(baseUrl, rejectUnauthorized);
  }

  async authenticate(): Promise<DssSession> {
    const challengeResponse = await this.http.request<AuthenticationChallenge>(
      "POST",
      AUTH_PATH,
      {
        userName: this.username,
        ipAddress: "",
        clientType: "WINPC_V2",
      },
    );
    const challenge = challengeResponse.body;

    if (!challenge.realm || !challenge.randomKey || !challenge.publickey) {
      throw new DssHttpError(
        "DSS did not return a complete authentication challenge",
        challengeResponse.statusCode,
      );
    }

    const passwordHash = md5(this.password);
    const usernamePasswordHash = md5(this.username + passwordHash);
    const doubleHash = md5(usernamePasswordHash);
    const realmHash = md5(
      `${this.username}:${challenge.realm}:${doubleHash}`,
    );
    const signature = md5(`${realmHash}:${challenge.randomKey}`);
    const aesKey = randomAlphaNumeric(32);
    const aesVector = randomAlphaNumeric(16);

    const credentialsResponse = await this.http.request<
      PlatformResponse<SessionData>
    >("POST", AUTH_PATH, {
      mac: this.clientMac,
      deviceSN: "",
      signature,
      userName: this.username,
      randomKey: challenge.randomKey,
      publicKey: "",
      secretKey: encryptWithPublicKey(challenge.publickey, aesKey),
      secretVector: encryptWithPublicKey(challenge.publickey, aesVector),
      ipAddress: "",
      clientType: "WINPC_V2",
      userType: "0",
      loginType: this.loginType,
    });

    if (credentialsResponse.statusCode >= 400) {
      throw new DssHttpError(
        "DSS rejected the submitted credentials",
        credentialsResponse.statusCode,
      );
    }

    const authenticationResponse = credentialsResponse.body;

    // DSS V8.6 can return the session fields directly, while newer releases
    // can wrap them in the standard { code, data } platform response.
    if (authenticationResponse.token || authenticationResponse.data?.token) {
      return sessionFromResponse(authenticationResponse);
    }

    return sessionFromResponse(
      requirePlatformSuccess(authenticationResponse, "authentication"),
    );
  }

  async keepAlive(token: string): Promise<void> {
    const response = await this.http.request<PlatformResponse>(
      "PUT",
      "/brms/api/v1.0/accounts/keepalive",
      { token },
      token,
    );

    if (response.statusCode === 401) {
      throw new DssHttpError("DSS session is unauthorized", 401);
    }

    requirePlatformSuccess(response.body, "keepalive");
  }

  async updateToken(token: string): Promise<DssSession> {
    const response = await this.http.request<PlatformResponse<SessionData>>(
      "POST",
      "/brms/api/v1.0/accounts/updateToken",
      {},
      token,
    );

    if (response.statusCode === 401) {
      throw new DssHttpError("DSS session is unauthorized", 401);
    }

    return sessionFromResponse(
      requirePlatformSuccess(response.body, "token refresh"),
    );
  }

  async logout(token: string): Promise<void> {
    const response = await this.http.request<PlatformResponse>(
      "POST",
      "/brms/api/v1.0/accounts/unauthorize",
      {},
      token,
    );

    if (response.statusCode === 401) {
      return;
    }

    requirePlatformSuccess(response.body, "logout");
  }

  async startVideo(token: string, channelId: string): Promise<DssStreamSource> {
    const response = await this.http.request<PlatformResponse<StreamData>>(
      "POST",
      "/brms/api/v1.0/MTS/Video/StartVideo",
      {
        data: {
          streamType: "1",
          trackId: "",
          channelId,
          keyCode: "",
          dataType: "2",
          enableRtsps: "0",
          enableMulticast: "0",
          fakeSdp: "0",
        },
      },
      token,
    );

    if (response.statusCode === 401) {
      throw new DssHttpError("DSS session is unauthorized", 401);
    }

    const stream = requirePlatformSuccess(response.body, "StartVideo").data;

    if (!stream?.url || stream.token === undefined || stream.token === null) {
      throw new DssHttpError("DSS StartVideo response is missing URL or token");
    }

    const candidates = stream.url
      .replaceAll("\\/", "/")
      .split("|")
      .map((value) => value.trim())
      .filter(Boolean);
    const publicCandidate = candidates.at(-1);

    if (!publicCandidate?.startsWith("rtsp://")) {
      throw new DssHttpError("DSS returned an invalid RTSP URL");
    }

    const separator = publicCandidate.includes("?") ? "&" : "?";

    return {
      rtspUrl: `${publicCandidate}${separator}token=${encodeURIComponent(String(stream.token))}`,
    };
  }
}
