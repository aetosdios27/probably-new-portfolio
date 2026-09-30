import { FaGithub, FaXTwitter, FaLinkedinIn } from "react-icons/fa6";
import { LuArrowUpRight, LuCalendarDays, LuFileText, LuGitPullRequest } from "react-icons/lu";

const icons = { github: FaGithub, x: FaXTwitter, linkedin: FaLinkedinIn, resume: LuFileText, calendar: LuCalendarDays };
export function BrandIcon({ name }: { name: keyof typeof icons }) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" className="brand-icon" />;
}
export function ExternalArrow() {
  return <LuArrowUpRight aria-hidden="true" className="external-arrow" />;
}
export function PullRequestIcon() {
  return <LuGitPullRequest aria-hidden="true" className="pull-request-icon" />;
}
