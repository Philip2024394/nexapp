"use server";

// Trivial server action for reproducer · mirrors how real peer-chat
// binds a server action via .bind() and passes to the Shell.

export async function tcServerAction(_formData: FormData): Promise<void> {
  // No-op · tests only need the prop to be serializable.
}
