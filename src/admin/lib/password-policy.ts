export const MIN_PASSWORD_LENGTH = 10;

/** The password rules, shared by the forms and the server. Null when acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > 200) return "Use at most 200 characters";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return "Use upper- and lowercase letters and at least one digit";
  }
  return null;
}
