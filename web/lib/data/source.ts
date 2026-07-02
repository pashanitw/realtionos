import { createSeed, type SeedData } from "./seed";
import type { Buyer, Message, Unit, Client, OrgUser } from "./types";

/**
 * The single seam every screen reads through.
 * Demo: backed by the in-memory seed below. Production: re-implemented
 * against the RelationOS / LiteLLM endpoints — one file changes, no screens touched.
 */
export interface DataSource {
  snapshot(): SeedData;
  getBuyer(id: string): Buyer | undefined;
  getConversation(buyerId: string): Message[];
  getUnit(id: string): Unit | undefined;
  getClient(id: string): Client | undefined;
  getUser(id: string): OrgUser | undefined;
}

let cache: SeedData | null = null;
function data(): SeedData {
  if (!cache) cache = createSeed();
  return cache;
}

export const mockDataSource: DataSource = {
  snapshot: () => data(),
  getBuyer: (id) => data().buyers.find((b) => b.id === id),
  getConversation: (buyerId) =>
    data()
      .messages.filter((m) => m.buyerId === buyerId)
      .sort((a, b) => a.timestamp - b.timestamp),
  getUnit: (id) => data().units.find((u) => u.id === id),
  getClient: (id) => data().clients.find((c) => c.id === id),
  getUser: (id) => data().users.find((u) => u.id === id),
};
