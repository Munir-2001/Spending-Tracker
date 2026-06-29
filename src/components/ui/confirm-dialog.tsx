"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { AlertTriangle, HelpCircle, Trash2 } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmTone = "danger" | "warning" | "default";

export type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
};

type Resolver = (value: boolean) => void;

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(
  () => Promise.resolve(false)
);

/** `const confirm = useConfirm(); if (await confirm({...})) { … }` */
export function useConfirm() {
  return useContext(ConfirmContext);
}

const toneStyles: Record<
  ConfirmTone,
  { wrap: string; icon: React.ReactNode; confirm: "default" | "destructive" }
> = {
  danger: {
    wrap: "bg-destructive/10 text-destructive",
    icon: <Trash2 className="size-5" />,
    confirm: "destructive",
  },
  warning: {
    wrap: "bg-warning/10 text-warning",
    icon: <AlertTriangle className="size-5" />,
    confirm: "default",
  },
  default: {
    wrap: "bg-primary/10 text-primary",
    icon: <HelpCircle className="size-5" />,
    confirm: "default",
  },
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<Resolver | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpen(false);
  }, []);

  const tone = toneStyles[opts?.tone ?? "default"];

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onOpenChange={(o) => !o && settle(false)}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          {opts && (
            <div className="flex flex-col items-center text-center">
              <span
                className={cn(
                  "mb-4 flex size-12 items-center justify-center rounded-full",
                  tone.wrap
                )}
              >
                {tone.icon}
              </span>
              <h2 className="display text-lg font-semibold tracking-tight">
                {opts.title}
              </h2>
              {opts.description && (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {opts.description}
                </p>
              )}
              <div className="mt-6 grid w-full grid-cols-2 gap-2.5">
                <Button variant="outline" onClick={() => settle(false)}>
                  {opts.cancelText ?? "Cancel"}
                </Button>
                <Button
                  variant={tone.confirm}
                  onClick={() => settle(true)}
                  autoFocus={opts.tone !== "danger"}
                >
                  {opts.confirmText ?? "Confirm"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
