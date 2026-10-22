import { Link, type LinkProps } from "react-router-dom";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./buttonStyles";

export interface ButtonLinkProps extends Omit<LinkProps, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

/** Enlace con el aspecto de `Button` (evita anidar <button> dentro de <a>). */
export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  ...rest
}: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, fullWidth, className })} {...rest} />;
}
