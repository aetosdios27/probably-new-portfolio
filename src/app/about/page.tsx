import type { Metadata } from "next";
import Image from "next/image";
import { identity } from "@/content/portfolio";
import { ExternalArrow } from "@/components/icons";

export const metadata: Metadata = { title: "About" };
export default function AboutPage() {
  return <main id="main" className="reading-page">
    <Image src={identity.avatar} alt="Pushpendra's GitHub profile picture" width={52} height={52} className="profile-picture" />
    <h1>I’m Pushpendra.<br /><span className="muted">Online, I usually go by Aetos.</span></h1>
    <div className="prose"><p>I’m interested in systems engineering, design engineering, and learning through building.</p><p>The work here spans storage engines, network protocols, publishing tools, and smaller experiments. I like understanding what happens underneath an interface, and giving just as much care to how it feels to use.</p><p>Open source is another part of that exploration: working inside systems beyond my own, understanding the constraints, and making a useful contribution.</p></div>
    <a className="text-link" href="https://github.com/aetosdios27">Find me on GitHub <ExternalArrow /></a>
  </main>;
}
