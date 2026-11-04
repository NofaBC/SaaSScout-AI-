import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoreData } from "../types";
import { BaseStore } from "./base";
import { createSeedData } from "./seed";

export class JsonStore extends BaseStore {
  private readonly filePath: string;

  private constructor(data: StoreData, filePath: string) {
    super(data);
    this.filePath = filePath;
  }

  static async open(filePath: string, ownerEmail: string): Promise<JsonStore> {
    await mkdir(path.dirname(filePath), { recursive: true });
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as StoreData;
      if (!parsed.workspace || !Array.isArray(parsed.products) || !Array.isArray(parsed.prospects)) {
        throw new Error("Local store is missing required collections.");
      }
      return new JsonStore(parsed, filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const seed = createSeedData(ownerEmail);
      const store = new JsonStore(seed, filePath);
      await store.persist();
      return store;
    }
  }

  protected async persist(): Promise<void> {
    await writeFile(this.filePath, `${JSON.stringify(this.data, null, 2)}\n`, "utf8");
  }
}
