/**
 * 存储接口
 *
 * 定义包存储的抽象接口，支持 KV 和 D1 两种存储后端
 */

import { PackageMetadata, PackageInfo } from "../package/Package";

export interface IStorage {
  savePackage(
    env: Env,
    packageName: string,
    r2Key: string,
    metadata: Partial<PackageMetadata>
  ): Promise<void>;

  deletePackage(env: Env, packageName: string): Promise<void>;

  getPackage(env: Env, packageName: string): Promise<PackageInfo | null>;

  getPackagesByArch(
    env: Env,
    arch: string,
    baseUrl: string
  ): Promise<PackageInfo[]>;

  getAllPackageNames(env: Env): Promise<string[]>;
}
