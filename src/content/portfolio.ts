export type Project = {
  name: string;
  description: string;
  href: string;
  category: string;
  year: string;
};

export const identity = {
  name: "Pushpendra Singh",
  intro: "Hi, I'm Pushpendra.",
  descriptor: "I build systems, tools, and the interfaces around them.",
  avatar: "/images/pushpendra.jpg",
};

// Verified against the public repository profile. Add supplied URLs here.
export const socialLinks = [
  { label: "GitHub", icon: "github", href: "https://github.com/aetosdios27" },
  { label: "X / Twitter", icon: "x", href: "https://x.com/aetosdios_" },
  { label: "LinkedIn", icon: "linkedin", href: "https://linkedin.com/in/pushpendra-singh-2ba7b9312" },
  { label: "Résumé", icon: "resume", href: "/resume.pdf" },
  { label: "Book a call", icon: "calendar", href: null },
] as const;

// Keep the index brief. Source repositories and the supplied résumé hold the detail.
export const selectedWork: Project[] = [
  { name: "Kiban", description: "An embedded storage engine.", category: "Storage / Rust", year: "2026", href: "https://github.com/aetosdios27/kiban" },
  { name: "Styx", description: "BitTorrent, from the wire up.", category: "P2P / Rust", year: "2026", href: "https://github.com/aetosdios27/Styx" },
  { name: "Scribe", description: "Infrastructure for technical writing.", category: "Publishing / TypeScript", year: "2026", href: "https://github.com/aetosdios27/scribe" },
  { name: "Raijin", description: "Deterministic distributed-system testing.", category: "Distributed systems", year: "2026", href: "https://github.com/aetosdios27/Raijin" },
  { name: "Konto", description: "A double-entry ledger.", category: "Financial infrastructure", year: "2026", href: "https://github.com/aetosdios27/Konto" },
  { name: "Iris", description: "A Vulkan-powered image viewer.", category: "Graphics / Rust", year: "2026", href: "https://github.com/aetosdios27/iris" },
  { name: "WebNotes", description: "Your notes. Local first.", category: "Local-first software", year: "2025–26", href: "https://github.com/aetosdios27/WebNotes" },
];

// Editorial order, not a release timeline. Year metadata deliberately avoids
// implying exact completion dates. Keep this shortlist at four max.
export const highlightProjects = [
  { name: "Kiban", href: "https://github.com/aetosdios27/kiban", year: "2026", context: "An embedded LSM-tree storage engine written from first principles in Rust." },
  { name: "Kurogane", href: "https://github.com/aetosdios27/kurogane", year: "2026", context: "A from-scratch Raft implementation with deterministic simulation, persistence, snapshots, joint consensus, and a real networked runtime." },
  { name: "Styx", href: "https://github.com/aetosdios27/Styx", year: "2026", context: "A from-scratch BitTorrent client implementing the protocol stack in Rust." },
  { name: "Scribe", href: "https://github.com/aetosdios27/scribe", year: "2026", context: "Publishing infrastructure and an authoring SDK for technical writing." },
] as const;

export const openSource = [
  { name: "Zed", description: "Honor window preferences when opening remote projects", number: 61048, status: "Merged", href: "https://github.com/zed-industries/zed/pull/61048" },
  { name: "NativeLink", description: "Handle zero digests in CompressionStore", number: 2548, status: "Merged", href: "https://github.com/TraceMachina/nativelink/pull/2548" },
  { name: "HelixDB", description: "Share one property decode across ORDER BY keys", number: 1071, status: "Merged", href: "https://github.com/HelixDB/helix-db/pull/1071" },
];

// PR states checked on 2026-10-01. Keep pending work distinct from merged work.
openSource.push(
  { name: "RocksDB", description: "Fix JNI local-reference leaks in ByteBuffer multiGet", number: 15126, status: "Open", href: "https://github.com/facebook/rocksdb/pull/15126" },
  { name: "Turso", description: "Restore SQLite numeric-affinity whitespace parity", number: 8465, status: "Merged", href: "https://github.com/tursodatabase/turso/pull/8465" },
  { name: "Knowhere", description: "Bound DiskANN AIO pool waits and fail fast", number: 1787, status: "Merged", href: "https://github.com/zilliztech/knowhere/pull/1787" },
);

export const playground = {
  title: "Playground",
  projects: [
    { name: "Folio", description: "Research papers, straight to your vault.", category: "Research tools", year: "2026", href: "https://github.com/aetosdios27/Folio" },
    { name: "Axiom", description: "One rulebook for every coding agent.", category: "Developer tools", year: "2026", href: "https://github.com/aetosdios27/axiom-core" },
  ] satisfies Project[],
};
