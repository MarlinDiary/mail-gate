import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth";
import { getConfigStatus } from "@/lib/config";
import { getMailGateFeed, MAILGATE_DEFAULT_PAGE_SIZE } from "@/lib/gmail";

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = getConfigStatus();

  if (!status.ready) {
    return NextResponse.json(
      { error: "Mail Gate is not configured.", missing: status.missing },
      { status: 503 }
    );
  }

  try {
    const feed = await getMailGateFeed({
      pageSize: MAILGATE_DEFAULT_PAGE_SIZE,
      scope:
        session.kind === "grant"
          ? {
              fromAddress: session.fromAddress,
              service: session.service,
              toAddress: session.toAddress,
            }
          : undefined,
    });

    return NextResponse.json(feed, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to read Gmail messages." },
      { status: 502 }
    );
  }
}
