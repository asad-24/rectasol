import { NextResponse } from "next/server";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  email: z.string().trim().email("A valid email is required").max(120),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  service: z.string().trim().min(2).max(80),
  budget: z.string().trim().max(160).optional().or(z.literal("")),
  message: z.string().trim().min(20, "Please add at least 20 characters").max(2000),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          message: parsed.error.issues[0]?.message ?? "Invalid contact request.",
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "RectaSol inquiry accepted by API stub.",
      inquiry: {
        ...parsed.data,
        receivedAt: new Date().toISOString(),
        delivery: "stub",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Request body must be valid JSON." }, { status: 400 });
  }
}
