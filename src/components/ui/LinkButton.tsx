import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonVariants, type ButtonSize, type ButtonVariant } from "./button-variants";

interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function LinkButton({ variant, size, className, ...props }: LinkButtonProps) {
  return <Link className={buttonVariants({ variant, size, className })} {...props} />;
}
