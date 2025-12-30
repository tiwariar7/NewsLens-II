// components/shared/Footer.tsx
export function Footer() {
  return (
    <footer className="border-t border-border/40">
      <div className="container flex h-16 max-w-full px-6 items-center justify-between text-sm text-foreground/60">
        <p>© {new Date().getFullYear()} NewsLens. All rights reserved.</p>
        <div className="flex gap-4">
          <a href="#" className="hover:text-foreground">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-foreground">
            Terms of Service
          </a>
        </div>
      </div>
    </footer>
  );
}