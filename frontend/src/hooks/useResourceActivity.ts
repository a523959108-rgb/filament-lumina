import { useEffect } from "react";
import type { ResourceKind } from "../api/resources";
import { useCommunityStore } from "../stores/communityStore";
import { isLocalLuminaAppOrigin } from "../utils/localAppOrigin";

export function useResourceActivity(kind: ResourceKind, ids: string[], enabled = true) {
  const active = enabled && isLocalLuminaAppOrigin();
  const epoch = useCommunityStore((state) => state.epoch);
  const subject = useCommunityStore((state) => state.connection?.subject);
  const idKey = JSON.stringify([...new Set(ids)].sort());
  useEffect(() => {
    if (!active) return;
    const refresh = () => { void useCommunityStore.getState().refreshConnection().then(() => {
      void useCommunityStore.getState().loadMine(kind);
      void useCommunityStore.getState().loadStats(kind, JSON.parse(idKey));
    }); };
    void useCommunityStore.getState().refreshConnection();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [active, kind, idKey]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => { void useCommunityStore.getState().loadStats(kind, JSON.parse(idKey)); }, 140);
    return () => window.clearTimeout(timer);
  }, [active, kind, idKey, epoch]);
  useEffect(() => { if (active && subject) void useCommunityStore.getState().loadMine(kind); }, [active, kind, subject, epoch]);
}
