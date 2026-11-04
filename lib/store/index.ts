import type { Store } from "./base";
import { FirestoreStore } from "./firestore-store";

let storePromise: Promise<Store> | null = null;

async function createStore(): Promise<Store> {
  const driver = process.env.STORE_DRIVER ?? "firestore";
  if (driver !== "firestore") {
    throw new Error(
      `STORE_DRIVER=${driver} is not supported. The pilot uses Firestore only.`,
    );
  }
  return new FirestoreStore();
}

export async function getStore(): Promise<Store> {
  if (!storePromise) storePromise = createStore();
  return storePromise;
}

export function resetStoreForTests(): void {
  storePromise = null;
}
