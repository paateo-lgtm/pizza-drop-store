import { Toaster } from "@/components/ui/sonner";

export default function KitchenLayout({ children }: LayoutProps<"/kitchen">) {
  return (
    <div className="kitchen flex min-h-dvh flex-col bg-background text-foreground">
      {children}
      <Toaster position="top-center" />
    </div>
  );
}
