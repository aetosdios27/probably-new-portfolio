export type Project = {
  name: string;
  description: string;
  context?: string;
  href: string;
  language?: string;
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

// Descriptions are grounded in public repository descriptions / READMEs.
// Order controls the editorial hierarchy; the first project is featured.
export const selectedWork: Project[] = [
  {
    name: "Kiban",
    description: "An embedded storage engine, built from first principles.",
    context: "A dependency-free LSM-tree engine in Rust. From write-ahead logging and sorted tables to compaction, snapshots, and crash recovery.",
    href: "https://github.com/aetosdios27/kiban",
    language: "Rust",
  },
  {
    name: "Styx",
    description: "A BitTorrent engine from the wire up.",
    context: "Peer wire, DHT, verified storage, and seeding. A Rust engine with supervised runtimes, hostile-input defenses, and a Tauri desktop shell.",
    href: "https://github.com/aetosdios27/Styx",
    language: "Rust",
  },
  {
    name: "Scribe",
    description: "A publishing SDK for technical writing.",
    context: "Four packages, a native Rust CLI, and a local authoring studio. Technical articles on your own site, without a hosted CMS.",
    href: "https://github.com/aetosdios27/scribe",
    language: "TypeScript",
  },
  {
    name: "Raijin",
    description: "Project notes to follow.",
    href: "https://github.com/aetosdios27/Raijin",
  },
];

export const furtherWork: Project[] = [
  { name: "Konto", description: "A double-entry ledger with zero-sum guarantees.", href: "https://github.com/aetosdios27/Konto" },
  { name: "Iris", description: "A Linux image viewer with a Vulkan renderer.", href: "https://github.com/aetosdios27/iris" },
  { name: "WebNotes", description: "Local-first notes, across desktop and web.", href: "https://github.com/aetosdios27/WebNotes" },
];

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
  description: "Smaller builds. Different rabbit holes.",
  projects: [
    { name: "Folio", description: "ArXiv papers to your Obsidian vault, from the terminal.", href: "https://github.com/aetosdios27/Folio" },
    { name: "Axiom", description: "One set of coding rules. Configs for every agent.", href: "https://github.com/aetosdios27/axiom-core" },
  ] satisfies Project[],
};
