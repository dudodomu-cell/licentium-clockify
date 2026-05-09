"use client";

// Standalone submit button that runs window.confirm() before submitting its
// parent form. Lets a server-component page keep the form/action server-side
// while still showing a confirm dialog before destructive actions.
export function ClientConfirmDelete({
  label,
  promptText,
}: {
  label: string;
  promptText: string;
}) {
  return (
    <button
      type="submit"
      className="btn danger"
      onClick={(e) => {
        if (!confirm(promptText)) e.preventDefault();
      }}
    >
      {label}
    </button>
  );
}
