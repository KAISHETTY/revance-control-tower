import * as TabsPrimitive from "@radix-ui/react-tabs";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cn } from "../../lib/cn";

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<ElementRef<typeof TabsPrimitive.List>, ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  function TabsList({ className, ...props }, ref) {
    return <TabsPrimitive.List ref={ref} className={cn("flex items-center gap-1 border-b border-line px-2", className)} {...props} />;
  },
);

export const TabsTrigger = forwardRef<ElementRef<typeof TabsPrimitive.Trigger>, ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  function TabsTrigger({ className, ...props }, ref) {
    return (
      <TabsPrimitive.Trigger
        ref={ref}
        className={cn(
          "relative -mb-px inline-flex h-10 items-center gap-1.5 border-b-2 border-transparent px-2.5 text-sm font-medium text-muted transition-colors hover:text-fg data-[state=active]:border-accent data-[state=active]:text-fg",
          className,
        )}
        {...props}
      />
    );
  },
);

export const TabsContent = forwardRef<ElementRef<typeof TabsPrimitive.Content>, ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(
  function TabsContent({ className, ...props }, ref) {
    return <TabsPrimitive.Content ref={ref} className={cn("min-h-0 flex-1 focus-visible:outline-none", className)} {...props} />;
  },
);
