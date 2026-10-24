import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(error: unknown, fallbackStatus = 400) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected error";
  const status =
    message === "Unauthorized"
      ? 401
      : message.includes("not found")
        ? 404
        : message.includes("already")
          ? 409
          : fallbackStatus;

  return NextResponse.json({ error: message }, { status });
}
