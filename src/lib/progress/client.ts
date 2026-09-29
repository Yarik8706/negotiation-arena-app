"use client";
export function getLocalProfileId() {
  const key = "arena-profile-id";
  let id = window.localStorage.getItem(key);
  if (!id) { id = `local-${window.crypto.randomUUID()}`; window.localStorage.setItem(key, id); }
  return id;
}
