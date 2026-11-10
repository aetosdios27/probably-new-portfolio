export const identity = {
  name: "aetos",
  /** Revealed on the homepage when the name is hovered. */
  givenName: "Pushpendra",
  summary: "I’m aetos, a systems engineer driven mostly by curiosity and an unreasonable attention to detail.",
  status: "Pre-final year CS undergraduate by day, and a builder outside uni hours.",
  timezone: "India (IST, UTC+5:30)",
  intro: "Hi, I'm aetos.",
  descriptor: "I build systems, tools, and the interfaces around them.",
  avatar: "/images/avatar.jpg",
};

// Editorial order, not a release timeline. Year metadata deliberately avoids
// implying exact completion dates. Keep this shortlist at four max.
export const highlightProjects = [
  { name: "Kiban", href: "https://github.com/aetosdios27/kiban", year: "2026", context: "An embedded LSM-tree storage engine written from first principles in Rust." },
  { name: "Kurogane", href: "https://github.com/aetosdios27/kurogane", year: "2026", context: "A from-scratch Raft implementation with deterministic simulation, persistence, snapshots, joint consensus, and a real networked runtime." },
  { name: "Styx", href: "https://github.com/aetosdios27/Styx", year: "2026", context: "A from-scratch BitTorrent client implementing the protocol stack in Rust." },
  { name: "Scribe", href: "https://github.com/aetosdios27/scribe", year: "2026", context: "Publishing infrastructure and an authoring SDK for technical writing." },
] as const;

// PR states checked on 2026-10-01. Keep pending work distinct from merged work.
export const openSource = [
  { name: "Zed", description: "Honor window preferences when opening remote projects", number: 61048, status: "Merged", href: "https://github.com/zed-industries/zed/pull/61048" },
  { name: "NativeLink", description: "Handle zero digests in CompressionStore", number: 2548, status: "Merged", href: "https://github.com/TraceMachina/nativelink/pull/2548" },
  { name: "HelixDB", description: "Share one property decode across ORDER BY keys", number: 1071, status: "Merged", href: "https://github.com/HelixDB/helix-db/pull/1071" },
  { name: "RocksDB", description: "Fix JNI local-reference leaks in ByteBuffer multiGet", number: 15126, status: "Open", href: "https://github.com/facebook/rocksdb/pull/15126" },
  { name: "Turso", description: "Restore SQLite numeric-affinity whitespace parity", number: 8465, status: "Merged", href: "https://github.com/tursodatabase/turso/pull/8465" },
  { name: "Knowhere", description: "Bound DiskANN AIO pool waits and fail fast", number: 1787, status: "Merged", href: "https://github.com/zilliztech/knowhere/pull/1787" },
];

// From the resume's technical skills, for the agent-readable version of the site.
export const skills = {
  languages: ["Rust", "C++", "Go", "TypeScript", "Python", "SQL"],
  systems: ["Distributed systems", "Storage systems", "Network protocols", "Concurrency", "Async runtimes", "IPC", "CRDTs", "TCP/UDP", "Kademlia DHT"],
  tools: ["Tokio", "Tauri v2", "React", "Next.js", "Bun", "PostgreSQL", "Vulkan", "GTK4", "Docker", "GitHub Actions", "Vitest", "testcontainers"],
};
