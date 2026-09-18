"use client";

import type { ButtonHTMLAttributes } from "react";
import { buttonVariants, type ButtonSize, type ButtonVariant } from "@/components/ui/button-variants";

interface ConfirmSubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  confirmMessage: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function ConfirmSubmitButton({
  confirmMessage,
  variant,
  size,
  className,
  onClick,
  ...props
}: ConfirmSubmitButtonProps) {
  return (
    <button
      type="submit"
      className={buttonVariants({ variant, size, className })}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...props}
    />
  );
}
