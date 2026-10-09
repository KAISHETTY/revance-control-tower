import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Right-side drawer on desktop, bottom sheet on small screens. */
export function Sheet({ open, onOpenChange, title, description, children, className }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex flex-col border-line bg-panel text-fg shadow-2xl focus:outline-none",
            "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl border-t",
            "sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[min(760px,92vw)] sm:rounded-none sm:border-t-0 sm:border-l",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-0.5 text-sm text-muted">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close className="rounded-md p-1.5 text-muted hover:bg-panel-2 hover:text-fg" aria-label="Close">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
