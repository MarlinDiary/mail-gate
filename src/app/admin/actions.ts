"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAccessGrant, revokeAccessGrant } from "@/lib/access";
import { hasAdminSession } from "@/lib/auth";
import { getMailService } from "@/lib/mail-services";

const createGrantSchema = z.object({
  expiresInHours: z.coerce.number().int().min(1).max(24 * 7),
  serviceId: z.enum(["claude-code", "codex", "netflix"]),
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
    serviceId: formData.get("serviceId"),
    toAddress: formData.get("toAddress"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid access code." };
  }

  try {
    const service = getMailService(parsed.data.serviceId);

    if (!service) {
      return { error: "Invalid service." };
    }

    const created = await createAccessGrant({
      expiresInHours: parsed.data.expiresInHours,
      fromAddress: service.senderQuery,
      service: service.label,
      toAddress: parsed.data.toAddress,
    });
    revalidatePath("/admin");

    return {
      code: created.code,
      message: `${created.grant.service} access code created. Copy it now; it is not stored in plaintext.`,
    };
  } catch (error) {
    console.error("Unable to create access grant.", error);
    return { error: "Unable to create access code." };
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
