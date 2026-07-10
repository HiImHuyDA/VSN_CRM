import * as React from "react";
import { cn } from "../../lib/utils";

const FieldGroup = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-3", className)} {...props} />
));
FieldGroup.displayName = "FieldGroup";

const Field = React.forwardRef(({ className, orientation = "vertical", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex",
      orientation === "horizontal" ? "flex-row items-center space-x-2 space-y-0" : "flex-col space-y-1.5",
      className
    )}
    {...props}
  />
));
Field.displayName = "Field";

const FieldLabel = React.forwardRef(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
    {...props}
  />
));
FieldLabel.displayName = "FieldLabel";

export { FieldGroup, Field, FieldLabel };

