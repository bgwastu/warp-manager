import { spawnSync } from "bun";

const WARP_SH = process.env.WARP_SH || "/app/warp.sh";

function runWarp(args: string[], timeout = 30): string {
  const proc = spawnSync(["bash", WARP_SH, ...args], {
    timeout: timeout * 1000,
    env: { ...process.env, PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin" },
  });
  if (proc.exitCode !== 0) {
    const err = (proc.stderr?.toString() || proc.stdout?.toString() || "").trim();
    throw new Error(err || `warp.sh exited with code ${proc.exitCode}`);
  }
  return proc.stdout?.toString() || "";
}

export function parseRefreshParts(config: string) {
  let cf_token = "", device_id = "", wg_private_key = "";
  let inInterface = false;

  for (const line of config.split("\n")) {
    const s = line.trim();
    if (s === "[Interface]") { inInterface = true; continue; }
    if (s.startsWith("[")) { inInterface = false; continue; }
    const t = s.match(/^#CFToken\s*=\s*(.+)$/);
    if (t) { cf_token = t[1].trim(); continue; }
    const d = s.match(/^#CFDeviceId\s*=\s*(.+)$/);
    if (d) { device_id = d[1].trim(); continue; }
    if (inInterface) {
      const k = s.match(/^PrivateKey\s*=\s*(.+)$/);
      if (k) wg_private_key = k[1].trim();
    }
  }
  return { cf_token, device_id, wg_private_key };
}

/**
 * Generate a WARP config.
 * @param deviceName - name for the device
 * @param jwt - optional Teams JWT. If omitted, generates a consumer (non-Teams) config.
 */
export function generateConfig(deviceName: string, jwt?: string) {
  const args: string[] = ["-d", deviceName];
  if (jwt) args.push("-T", jwt);

  const config = runWarp(args);

  // Try to parse refresh parts — consumer WARP won't have CFDeviceId/CFToken
  const parts = parseRefreshParts(config);

  // For consumer WARP (no JWT), we won't have CFToken/CFDeviceId
  // That's OK — refresh won't be supported but the config still works
  if (jwt) {
    const missing: string[] = [];
    if (!parts.cf_token) missing.push("CFToken");
    if (!parts.device_id) missing.push("CFDeviceId");
    if (!parts.wg_private_key) missing.push("PrivateKey");
    if (missing.length > 0) {
      throw new Error(`Could not parse ${missing.join(", ")}. The JWT may be invalid or expired.`);
    }
  }

  // For consumer WARP without JWT, we still need the private key
  if (!jwt && !parts.wg_private_key) {
    throw new Error("Failed to parse PrivateKey from warp.sh output");
  }

  return { config, ...parts };
}

export function refreshConfig(cf_token: string, device_id: string, wg_private_key: string) {
  const refreshToken = `${cf_token},${device_id},${wg_private_key}`;
  return runWarp(["-R", refreshToken]);
}
