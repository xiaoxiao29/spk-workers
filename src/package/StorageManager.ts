/**
 * 存储管理器
 *
 * 统一管理包信息的存储操作，支持 KV、D1 和 Hybrid 三种后端
 */

import { IStorage } from "../db/IStorage";
import { StorageFactory } from "../db/StorageFactory";
import { PackageMetadata, PackageInfo } from "./Package";

export class StorageManager {
  private storage: IStorage;

  constructor(storageType: "kv" | "d1" | "hybrid") {
    this.storage = StorageFactory.createStorage(storageType);
  }

  async savePackage(
    env: Env,
    packageName: string,
    r2Key: string,
    metadata: Partial<PackageMetadata>
  ): Promise<void> {
    await this.storage.savePackage(env, packageName, r2Key, metadata);
  }

  async deletePackage(env: Env, packageName: string): Promise<void> {
    await this.storage.deletePackage(env, packageName);
  }

  async getPackage(
    env: Env,
    packageName: string
  ): Promise<PackageInfo | null> {
    return this.storage.getPackage(env, packageName);
  }

  async getPackagesByArch(
    env: Env,
    arch: string,
    baseUrl: string
  ): Promise<PackageInfo[]> {
    return this.storage.getPackagesByArch(env, arch, baseUrl);
  }

  async getAllPackageNames(env: Env): Promise<string[]> {
    return this.storage.getAllPackageNames(env);
  }
}
