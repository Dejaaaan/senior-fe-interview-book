import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const buttonVariants = cva("btn", {
  variants: {
    variant: {
      primary: "",
      secondary: "",
      ghost: "",
    },
  },
  defaultVariants: { variant: "primary" },
});

type Props = VariantProps<typeof buttonVariants> &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
    children?: ReactNode;
  };

export function Button({ asChild, variant, className, children, ...props }: Props) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-variant={variant}
      className={buttonVariants({ variant, className })}
      {...props}
    >
      {children}
    </Comp>
  );
}
