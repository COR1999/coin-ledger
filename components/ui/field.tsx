import { cn } from "@/lib/utils";

/**
 * Shared text-input style + labeled-field wrapper for this app's plain HTML
 * forms (onboarding, waitlist). Not shadcn's own form primitives — those
 * pull in react-hook-form, which this project doesn't otherwise use; these
 * forms are plain `<form action={serverAction}>` with useActionState, so a
 * small local pattern matches what's actually here instead of a dependency
 * that would only be used for its className conventions.
 */
export const inputClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive";

export function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/** A `Field` whose child is a plain text/email `<input>` — the common case. */
export function TextField({
  id,
  name,
  label,
  type = "text",
  required,
  maxLength,
  placeholder,
  error,
  className,
}: {
  id: string;
  name: string;
  label: string;
  type?: "text" | "email";
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  error?: string;
  className?: string;
}) {
  return (
    <Field id={id} label={label} error={error} className={className}>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={inputClass}
      />
    </Field>
  );
}
