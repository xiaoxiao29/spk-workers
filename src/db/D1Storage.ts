/**
 * D1 存储实现
 *
 * 使用 D1 数据库存储包信息
 */

import { IStorage } from "./IStorage";
import { D1Database } from "./D1Database";
import { PackageMetadata, PackageInfo } from "../package/Package";

export class D1Storage implements IStorage {
  private d1: D1Database;

  constructor() {
    this.d1 = new D1Database();
  }

  async initialize(env: Env, recreateTables: boolean = false): Promise<void> {
    await this.d1.initialize(env, recreateTables);
  }

  async savePackage(
    env: Env,
    packageName: string,
    r2Key: string,
    metadata: Partial<PackageMetadata>
  ): Promise<void> {
    await this.d1.savePackage(env, packageName, r2Key, metadata);
  }

  async deletePackage(env: Env, packageName: string): Promise<void> {
    await this.d1.deletePackage(env, packageName);
  }

  async getPackage(env: Env, packageName: string): Promise<PackageInfo | null> {
    return this.d1.getPackage(env, packageName);
  }

  async getPackagesByArch(
    env: Env,
    arch: string,
    baseUrl: string
  ): Promise<PackageInfo[]> {
    return this.d1.getPackagesByArch(env, arch, baseUrl);
  }

  async getAllPackageNames(env: Env): Promise<string[]> {
    return this.d1.getAllPackageNames(env);
  }
}
