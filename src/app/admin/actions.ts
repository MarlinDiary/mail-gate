"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAccessGrant, revokeAccessGrant } from "@/lib/access";
import { hasAdminSession } from "@/lib/auth";

const createGrantSchema = z.object({
  expiresInHours: z.coerce.number().int().min(1).max(24 * 7),
  fromAddress: z.email().trim().toLowerCase(),
  service: z.string().trim().min(2).max(80),
  toAddress: z.email().trim().toLowerCase(),
});

export type CreateGrantState = {
  code?: string;
  error?: string;
  message?: string;
};

export async function createGrantAction(
  _previousState: CreateGrantState,
  formData: FormData
): Promise<CreateGrantState> {
  if (!(await hasAdminSession())) {
    return { error: "Administrator session required." };
  }

  const parsed = createGrantSchema.safeParse({
    expiresInHours: formData.get("expiresInHours"),
    fromAddress: formData.get("fromAddress"),
    service: formData.get("service"),
    toAddress: formData.get("toAddress"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid access pass." };
  }

  try {
    const created = await createAccessGrant(parsed.data);
    revalidatePath("/admin");

    return {
      code: created.code,
      message: `${created.grant.service} access pass created. Copy it now; it is not stored in plaintext.`,
    };
  } catch (error) {
    console.error("Unable to create access grant.", error);
    return { error: "Unable to create access pass." };
  }
}

export async function revokeGrantAction(formData: FormData): Promise<void> {
  if (!(await hasAdminSession())) {
    throw new Error("Administrator session required.");
  }

  const id = z.uuid().parse(formData.get("id"));
  await revokeAccessGrant(id);
  revalidatePath("/admin");
}
