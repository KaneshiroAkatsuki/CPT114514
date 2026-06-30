import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium tracking-normal ring-offset-background transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100",
          {
            "bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(10,132,255,0.22)] hover:bg-[#0071e3] hover:shadow-[0_10px_24px_rgba(10,132,255,0.25)]": variant === "default",
            "bg-secondary text-secondary-foreground hover:bg-slate-200/80": variant === "secondary",
            "border border-slate-200/90 bg-white/80 text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:bg-white": variant === "outline",
            "text-slate-700 hover:bg-slate-200/70 hover:text-slate-950": variant === "ghost",
            "bg-destructive text-destructive-foreground shadow-[0_8px_18px_rgba(255,59,48,0.18)] hover:bg-red-600": variant === "destructive",
            "h-[38px] px-4 py-2": size === "default",
            "h-8 rounded-lg px-3 text-xs": size === "sm",
            "h-11 rounded-xl px-8": size === "lg",
            "h-9 w-9": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
