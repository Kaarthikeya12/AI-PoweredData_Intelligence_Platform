"use client";

import { useState } from "react";

type PasswordInputProps = {
  id: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  describedBy?: string;
  disabled?: boolean;
};

export default function PasswordInput({ id, name, autoComplete, minLength, describedBy, disabled }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-wrap">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        placeholder="••••••••••••"
        autoComplete={autoComplete}
        minLength={minLength}
        aria-describedby={describedBy}
        disabled={disabled}
        required
      />
      <button
        type="button"
        className="show-button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? "HIDE" : "SHOW"}
      </button>
    </div>
  );
}
