import Link from "next/link";
import { Glasses } from "lucide-react";

export function Logo() {
  return (
    <Link href="/dashboard" className="group flex items-center gap-2 text-xl font-bold text-primary">
      <div className="rounded-lg bg-primary p-2 text-primary-foreground transition-transform group-hover:scale-110">
        <Glasses size={20} />
      </div>
      <span className="text-foreground transition-colors group-hover:text-primary">NewsLens</span>
    </Link>
  );
}
