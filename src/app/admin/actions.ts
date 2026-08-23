"use server";

import { randomUUID } from "node:crypto";
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
  feedbackId?: string;
  message?: string;
};

export type RevokeGrantState = {
  error?: string;
  message?: string;
};

export async function createGrantAction(
  _previousState: CreateGrantState,
  formData: FormData
): Promise<CreateGrantState> {
  if (!(await hasAdminSession())) {
    return {
      error: "Administrator session required.",
      feedbackId: randomUUID(),
    };
  }

  const parsed = createGrantSchema.safeParse({
    expiresInHours: formData.get("expiresInHours"),
    serviceId: formData.get("serviceId"),
    toAddress: formData.get("toAddress"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid access code.",
      feedbackId: randomUUID(),
    };
  }

  try {
    const service = getMailService(parsed.data.serviceId);

    if (!service) {
      return { error: "Invalid service.", feedbackId: randomUUID() };
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
      feedbackId: randomUUID(),
      message: `${created.grant.service} access code created. Copy it now; it is not stored in plaintext.`,
    };
  } catch (error) {
    console.error("Unable to create access grant.", error);
    return {
      error: "Unable to create access code.",
      feedbackId: randomUUID(),
    };
  }
}

export async function revokeGrantAction(id: string): Promise<RevokeGrantState> {
  if (!(await hasAdminSession())) {
    return { error: "Administrator session required." };
  }

  const parsedId = z.uuid().safeParse(id);

  if (!parsedId.success) {
    return { error: "Invalid access record." };
  }

  try {
    const revoked = await revokeAccessGrant(parsedId.data);

    if (!revoked) {
      return { error: "This access record was already revoked." };
    }

    revalidatePath("/admin");
    return { message: "Temporary access revoked." };
  } catch (error) {
    console.error("Unable to revoke access grant.", error);
    return { error: "Unable to revoke temporary access." };
  }
}
