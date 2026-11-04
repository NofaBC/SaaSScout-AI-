"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { firebaseClientConfigured, firebasePublicConfig } from "./public-config";

function app() {
  return getApps().length ? getApp() : initializeApp(firebasePublicConfig);
}

export function firebaseAuth() {
  if (!firebaseClientConfigured()) {
    throw new Error("Firebase web configuration is missing.");
  }
  return getAuth(app());
}

export async function signInOwnerWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(firebaseAuth(), provider);
  return result.user;
}

export async function signOutOwner(): Promise<void> {
  await signOut(firebaseAuth());
}

export async function getIdToken(user: User): Promise<string> {
  return user.getIdToken(true);
}
