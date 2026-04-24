/**
 * 存储工厂
 *
 * 根据配置创建相应的存储实例
 * - kv: 纯 KV 存储（简单场景）
 * - d1: 纯 D1 数据库存储（需要 SQL 查询）
 * - hybrid: 混合模式（D1 持久化 + KV 缓存）✅ 推荐
 */

import { IStorage } from "./IStorage";
import { D1Storage } from "./D1Storage";
import { KVStorage } from "./KVStorage";
import { HybridStorage } from "./HybridStorage";

export class StorageFactory {
  static createStorage(type: "kv" | "d1" | "hybrid"): IStorage {
    switch (type) {
      case "d1":
        return new D1Storage();
      case "hybrid":
        return new HybridStorage();
      case "kv":
      default:
        return new KVStorage();
    }
  }
}
