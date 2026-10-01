import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Dispatches" };
export default function DispatchesPage() {
  return <main id="main" className="reading-page dispatches-page">
    <p className="page-eyebrow">Notes from the work</p>
    <h1>Dispatches</h1>
    <p className="page-description">Engineering notes, build logs, and things learned along the way.</p>
    <div className="empty-dispatches"><p>Nothing published yet.</p><Link className="text-link" href="/">Explore the work</Link></div>
  </main>;
}
