// Motion Primitives' class-name helper. Its Dock only combines plain strings;
// no class-merge or utility dependency is needed for this single component.
export function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
