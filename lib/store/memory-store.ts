import type { StoreData } from "../types";
import { BaseStore } from "./base";

export class MemoryStore extends BaseStore {
  constructor(data: StoreData) {
    super(data);
  }

  protected async persist(): Promise<void> {
    // Intentionally in-memory for tests and local mock mode.
  }
}
