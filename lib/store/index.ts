import path from "node:path";
import { ownerEmail } from "../config";
import type { Store } from "./base";
import { JsonStore } from "./json-store";

let storePromise: Promise<Store> | null = null;

async function createStore(): Promise<Store> {
  const driver = process.env.STORE_DRIVER ?? "json";
  if (driver !== "json") {
    throw new Error(
      `STORE_DRIVER=${driver} is not configured in this checkpoint. Use json for local/mock mode.`,
    );
  }
  const filePath = process.env.DATA_FILE
    ? path.resolve(process.env.DATA_FILE)
    : path.join(process.cwd(), ".data", "store.json");
  return JsonStore.open(filePath, ownerEmail());
}

export async function getStore(): Promise<Store> {
  if (!storePromise) storePromise = createStore();
  return storePromise;
}

export function resetStoreForTests(): void {
  storePromise = null;
}
