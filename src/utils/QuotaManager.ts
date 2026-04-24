/**
 * KV 配额管理器
 *
 * 用于 Free Plan 配额保护
 * 注意：精确的配额计数需要额外的 KV 读取，反而消耗配额
 * 因此这里采用保守策略：只记录，不阻止
 */

const KV_READ_QUOTA_FREE = 100000;
const KV_READ_WARNING_THRESHOLD = 0.8;

interface QuotaData {
  date: string;
  readCount: number;
}

export class QuotaManager {
  private static readonly QUOTA_KEY = "_internal:kv_quota";

  static getToday(): string {
    return new Date().toISOString().split("T")[0];
  }

  static async getQuotaInfo(env: Env): Promise<{ date: string; readCount: number; limit: number; usagePercent: number }> {
    const quotaKey = `${this.QUOTA_KEY}:${this.getToday()}`;
    const quotaValue = await env.SPKS_CACHE.get(quotaKey);

    let readCount = 0;
    if (quotaValue) {
      try {
        const data: QuotaData = JSON.parse(quotaValue);
        if (data.date === this.getToday()) {
          readCount = data.readCount;
        }
      } catch {
        // ignore
      }
    }

    const usagePercent = Math.round((readCount / KV_READ_QUOTA_FREE) * 100);

    return {
      date: this.getToday(),
      readCount,
      limit: KV_READ_QUOTA_FREE,
      usagePercent,
    };
  }

  static async incrementReadCount(env: Env): Promise<void> {
    const quotaKey = `${this.QUOTA_KEY}:${this.getToday()}`;
    const quotaValue = await env.SPKS_CACHE.get(quotaKey);

    let readCount = 0;
    if (quotaValue) {
      try {
        const data: QuotaData = JSON.parse(quotaValue);
        if (data.date === this.getToday()) {
          readCount = data.readCount;
        }
      } catch {
        // ignore
      }
    }

    const newData: QuotaData = {
      date: this.getToday(),
      readCount: readCount + 1,
    };

    await env.SPKS_CACHE.put(quotaKey, JSON.stringify(newData), { expirationTtl: 86400 * 2 });
  }

  static isQuotaExceeded(usagePercent: number): boolean {
    return usagePercent >= 100;
  }

  static isQuotaWarning(usagePercent: number): boolean {
    return usagePercent >= KV_READ_WARNING_THRESHOLD * 100;
  }

  static getRecommendedMaxAge(usagePercent: number): number {
    if (usagePercent >= 90) {
      return 3600;
    } else if (usagePercent >= 70) {
      return 600;
    } else if (usagePercent >= 50) {
      return 300;
    }
    return 300;
  }
}
