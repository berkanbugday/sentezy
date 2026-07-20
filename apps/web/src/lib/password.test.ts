import assert from "node:assert";
import { MIN_PASSWORD, passwordErrorMessage, validateNewPassword } from "./password";

// A valid pair passes.
assert.strictEqual(validateNewPassword("hunter2!", "hunter2!"), null);
assert.strictEqual(validateNewPassword("x".repeat(MIN_PASSWORD), "x".repeat(MIN_PASSWORD)), null);

// Too short is caught at exactly one below the minimum.
assert.strictEqual(validateNewPassword("x".repeat(MIN_PASSWORD - 1), "x".repeat(MIN_PASSWORD - 1)), "too_short");
assert.strictEqual(validateNewPassword("", ""), "too_short");

// Length is checked BEFORE match, so a short password reports its real problem rather
// than "mismatch" while the confirm field is still empty.
assert.strictEqual(validateNewPassword("abc", ""), "too_short");

// A long-enough but non-matching pair is a mismatch.
assert.strictEqual(validateNewPassword("longenough", "longenouGH"), "mismatch");

// Every error has a message; the two differ.
assert.notStrictEqual(passwordErrorMessage("too_short"), passwordErrorMessage("mismatch"));
assert.ok(passwordErrorMessage("too_short").includes(String(MIN_PASSWORD)));

console.log("apps/web/src/lib/password.test.ts ok");
