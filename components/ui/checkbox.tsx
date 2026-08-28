import type { InputHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className="relative inline-grid h-5 w-5 place-items-center">
      <input
        className={cn(
          "peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-line bg-paper transition checked:border-forest checked:bg-forest disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        type="checkbox"
        {...props}
      />
      <Check
        aria-hidden="true"
        className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100"
      />
    </span>
  );
}
