/**
 * 同步 Cloudflare Access Bypass 配置
 *
 * 目标：
 * 1. 读取本地 conf/access-bypass.json
 * 2. 拉取远程 Access Apps
 * 3. 对比“受管”的 bypass 应用，不一致时更新，缺失时创建
 *
 * 必需环境变量：
 * - CLOUDFLARE_API_TOKEN: 需要 Access Apps 读写权限
 */

import { readFile } from "fs/promises";
import TOML from "@iarna/toml";

const CONFIG_PATH = "./conf/access-bypass.json";
const WRANGLER_TOML_PATH = "./wrangler.toml";
const MANAGED_NAME_PREFIX = "sspks-bypass:";
const API_BASE = "https://api.cloudflare.com/client/v4";

function assert(value, message) {
  if (!value) throw new Error(message);
}

function normalizePath(path) {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function makeDomain(targetDomain, path) {
  const p = normalizePath(path);
  return p === "/" ? targetDomain : `${targetDomain}${p}`;
}

function makeAppName(path) {
  return `${MANAGED_NAME_PREFIX}${normalizePath(path)}`;
}

function buildDesiredApps(config) {
  return config.bypassPaths.map((path, index) => {
    const normalizedPath = normalizePath(path);
    return {
      key: normalizedPath,
      payload: {
        name: makeAppName(normalizedPath),
        type: "self_hosted",
        domain: makeDomain(config.targetDomain, normalizedPath),
        session_duration: config.sessionDuration || "24h",
        app_launcher_visible: false,
        policies: [
          {
            name: `${makeAppName(normalizedPath)}:policy`,
            decision: "bypass",
            include: [{ everyone: {} }],
            precedence: index + 1
          }
        ]
      }
    };
  });
}

async function loadConfig() {
  const raw = await readFile(CONFIG_PATH, "utf-8");
  const config = JSON.parse(raw);

  if (config.enabled === false) {
    return config;
  }

  assert(Array.isArray(config.bypassPaths) && config.bypassPaths.length > 0, "access-bypass.json 缺少 bypassPaths");

  return config;
}

async function readWranglerConfig() {
  try {
    const raw = await readFile(WRANGLER_TOML_PATH, "utf-8");
    return TOML.parse(raw);
  } catch {
    return {};
  }
}

async function resolveAccountId() {
  const envAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || "";
  if (envAccountId) {
    return envAccountId;
  }

  const wranglerConfig = await readWranglerConfig();
  const wranglerAccountId = wranglerConfig.account_id || "";
  if (wranglerAccountId) {
    return wranglerAccountId;
  }

  throw new Error("缺少 Cloudflare account id，请设置 CLOUDFLARE_ACCOUNT_ID 或在 wrangler.toml 配置 account_id");
}

async function resolveTargetDomain(token, accountId, config) {
  if (config.targetDomain) {
    return config.targetDomain;
  }

  const wranglerConfig = await readWranglerConfig();
  const workerName = wranglerConfig.name || "";
  if (!workerName) {
    throw new Error("缺少 targetDomain，且 wrangler.toml 中未配置 name，无法自动推导");
  }

  const subdomainResult = await cfRequest(token, accountId, "GET", "/workers/subdomain", undefined);
  const workersSubdomain = subdomainResult?.subdomain || "";
  if (!workersSubdomain) {
    throw new Error("无法获取 Workers 子域名，请在 conf/access-bypass.json 显式配置 targetDomain");
  }

  return `${workerName}.${workersSubdomain}.workers.dev`;
}

async function cfRequest(token, accountId, method, path, body) {
  const response = await fetch(`${API_BASE}/accounts/${accountId}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    const errorCodes = Array.isArray(data?.errors) ? data.errors.map((e) => e.code).filter(Boolean) : [];
    const errors = data?.errors?.map((e) => e.message).join("; ") || response.statusText;
    const diagnostic = buildAuthDiagnostic(response.status, errorCodes, errors, accountId);
    throw new Error(`Cloudflare API ${method} ${path} 失败: ${errors}${diagnostic ? `\n${diagnostic}` : ""}`);
  }
  return data.result;
}

function buildAuthDiagnostic(status, errorCodes, errors, accountId) {
  const joinedCodes = errorCodes.join(",");
  const lowerErrors = (errors || "").toLowerCase();
  const isAuthRelated =
    status === 401 ||
    status === 403 ||
    joinedCodes.includes("10000") ||
    lowerErrors.includes("authentication") ||
    lowerErrors.includes("permission");

  if (!isAuthRelated) {
    return "";
  }

  const lines = [
    "诊断建议:",
    "- 检查 CLOUDFLARE_API_TOKEN 是否已设置且为最新值",
    "- 确认 Token 权限包含 Access: Apps and Policies (Read/Write)",
    `- 确认 Token 作用账号与当前 account_id 一致: ${accountId}`,
    "- 如刚更新 Token，请重新 export 后再执行脚本",
  ];

  if (status === 401 || lowerErrors.includes("authentication")) {
    lines.push("- 当前更像是 Token 无效/过期（401）");
  } else if (status === 403 || lowerErrors.includes("permission")) {
    lines.push("- 当前更像是权限不足或账号不匹配（403）");
  }

  return lines.join("\n");
}

async function listAllAccessApps(token, accountId) {
  const all = [];
  let page = 1;
  while (true) {
    const result = await cfRequest(token, accountId, "GET", `/access/apps?page=${page}&per_page=100`, undefined);
    all.push(...result);
    if (result.length < 100) break;
    page += 1;
  }
  return all;
}

function extractComparable(app) {
  const policy = Array.isArray(app.policies) ? app.policies.find((p) => p.decision === "bypass") : undefined;
  return {
    name: app.name,
    domain: app.domain,
    session_duration: app.session_duration || "24h",
    hasBypassEveryone: Boolean(
      policy &&
      Array.isArray(policy.include) &&
      policy.include.some((item) => typeof item === "object" && item?.everyone)
    )
  };
}

function isSameDesired(remoteComparable, desiredPayload) {
  return (
    remoteComparable.name === desiredPayload.name &&
    remoteComparable.domain === desiredPayload.domain &&
    remoteComparable.session_duration === desiredPayload.session_duration &&
    remoteComparable.hasBypassEveryone === true
  );
}

async function syncAccessBypass() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  assert(token, "缺少 CLOUDFLARE_API_TOKEN 环境变量");
  const accountId = await resolveAccountId();

  const config = await loadConfig();
  if (config.enabled === false) {
    console.log("ℹ Access bypass 同步已禁用，跳过。");
    return;
  }

  const targetDomain = await resolveTargetDomain(token, accountId, config);
  const desiredApps = buildDesiredApps({ ...config, targetDomain });
  console.log(`ℹ Access bypass 目标域名: ${targetDomain}`);
  const remoteApps = await listAllAccessApps(token, accountId);

  const managedRemote = remoteApps.filter((app) => app.name?.startsWith(MANAGED_NAME_PREFIX));
  const remoteByName = new Map(managedRemote.map((app) => [app.name, app]));

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const desired of desiredApps) {
    const existing = remoteByName.get(desired.payload.name);

    if (!existing) {
      try {
        await cfRequest(token, accountId, "POST", "/access/apps", desired.payload);
        created += 1;
        console.log(`✅ 已创建 bypass: ${desired.payload.domain}`);
      } catch (error) {
        if (error.message.includes("application_already_exists")) {
          const conflictApp = remoteApps.find(
            (app) => app.domain === desired.payload.domain || app.name === desired.payload.name
          );
          if (conflictApp) {
            remoteByName.set(desired.payload.name, conflictApp);
            try {
              await cfRequest(token, accountId, "PUT", `/access/apps/${conflictApp.id}`, desired.payload);
              updated += 1;
              console.log(`🔄 已更新冲突 bypass: ${desired.payload.domain}`);
            } catch (updateError) {
              skipped += 1;
              console.log(`⚠️ 跳过: ${desired.payload.domain} (更新失败: ${updateError.message})`);
            }
          } else {
            skipped += 1;
            console.log(`⚠️ 跳过: ${desired.payload.domain} (未找到冲突应用)`);
          }
        } else {
          throw error;
        }
      }
      continue;
    }

    const comparable = extractComparable(existing);
    if (isSameDesired(comparable, desired.payload)) {
      unchanged += 1;
      console.log(`✓ 保持一致: ${desired.payload.domain}`);
      continue;
    }

    await cfRequest(token, accountId, "PUT", `/access/apps/${existing.id}`, desired.payload);
    updated += 1;
    console.log(`🔄 已更新 bypass: ${desired.payload.domain}`);
  }

  console.log(`\n📊 Access bypass 同步完成: created=${created}, updated=${updated}, unchanged=${unchanged}, skipped=${skipped}`);
}

syncAccessBypass().catch((error) => {
  console.error("❌ Access bypass 同步失败:", error.message);
  process.exit(1);
});
