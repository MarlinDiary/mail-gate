"use client";

import {
  AlertTriangle,
  KeyRoundIcon,
  InboxIcon,
  LogOutIcon,
  MailOpenIcon,
  RefreshCwIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { CSSProperties } from "react";

import { logoutAction } from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ClaudeIcon,
  CodexIcon,
  NetflixIcon,
} from "@/components/service-icons";
import type { GrantSession } from "@/lib/access";
import type { MailGateFeed, MailGateMessage } from "@/lib/gmail";
import { groupAdminMessages, type MailboxGroup } from "@/lib/mailbox-categories";
import { cn } from "@/lib/utils";

const AUTO_REFRESH_INTERVAL_MS = 60_000;
const MESSAGES_URL = "/api/messages";
const ACCOUNT_AVATAR_URL =
  "https://api.dicebear.com/9.x/notionists/svg?seed=mail-gate&backgroundColor=ffffff&backgroundType=solid";
const EMAIL_SHADOW_BASE_STYLES = `
  :host {
    color: #0a0a0a;
    display: block;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 16px;
    line-height: 1.5;
    width: 100%;
  }
  * {
    box-sizing: border-box;
  }
  img {
    height: auto;
    max-width: 100%;
    vertical-align: middle;
  }
  table {
    max-width: 100%;
  }
  a {
    color: inherit;
  }
  .mailgate-email-root {
    overflow-wrap: anywhere;
    width: 100%;
  }
`;

const listTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  hour12: true,
  minute: "2-digit",
});

const detailDateFormatter = new Intl.DateTimeFormat("en-NZ", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function MailboxShell({
  accountEmail,
  accessGrant,
  feed,
  feedError,
  inboxLabel,
  isAdmin,
  missingConfig,
}: {
  accountEmail: string;
  accessGrant: GrantSession | null;
  feed: MailGateFeed | null;
  feedError: string;
  inboxLabel: string;
  isAdmin: boolean;
  missingConfig: string[];
}) {
  const [liveFeed, setLiveFeed] = React.useState(feed);
  const [liveFeedError, setLiveFeedError] = React.useState(feedError);
  const messages = React.useMemo(() => liveFeed?.messages ?? [], [liveFeed]);
  const inboxes = React.useMemo<MailboxGroup[]>(
    () =>
      isAdmin
        ? groupAdminMessages(messages)
        : [
            {
              id: "other",
              label: inboxLabel,
              messages,
            },
          ],
    [inboxLabel, isAdmin, messages]
  );
  const [activeInboxId, setActiveInboxId] = React.useState(
    isAdmin ? "claude-code" : "other"
  );
  const activeInbox =
    inboxes.find((inbox) => inbox.id === activeInboxId) ?? inboxes[0];
  const activeInboxLabel = activeInbox?.label ?? inboxLabel;
  const inboxMessages = activeInbox?.messages ?? [];
  const [activeMessageId, setActiveMessageId] = React.useState(
    inboxMessages[0]?.id ?? ""
  );
  const [search, setSearch] = React.useState("");
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const refreshInFlightRef = React.useRef(false);

  const refreshFeed = React.useCallback(
    async ({ skipWhenHidden = true }: { skipWhenHidden?: boolean } = {}) => {
      if (missingConfig.length || refreshInFlightRef.current) {
        return;
      }

      if (skipWhenHidden && document.visibilityState !== "visible") {
        return;
      }

      refreshInFlightRef.current = true;
      setIsRefreshing(true);

      try {
        const response = await fetch(MESSAGES_URL, { cache: "no-store" });

        if (!response.ok) {
          throw new Error("Unable to read Gmail messages.");
        }

        const nextFeed = (await response.json()) as MailGateFeed;

        setLiveFeed(nextFeed);
        setLiveFeedError("");
      } catch {
        setLiveFeedError("Unable to read Gmail messages.");
      } finally {
        refreshInFlightRef.current = false;
        setIsRefreshing(false);
      }
    },
    [missingConfig.length]
  );

  React.useEffect(() => {
    if (missingConfig.length) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshFeed();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [missingConfig.length, refreshFeed]);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredMessages = normalizedSearch
    ? inboxMessages.filter((message) =>
        [message.sender, message.subject, message.snippet]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      )
    : inboxMessages;
  const activeMessage =
    filteredMessages.find((message) => message.id === activeMessageId) ??
    filteredMessages[0] ??
    null;

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "350px",
        } as CSSProperties
      }
    >
      <Sidebar
        collapsible="icon"
        className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      >
        <Sidebar
          collapsible="none"
          className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r"
        >
          <SidebarHeader className="items-center px-2 pt-3.5 pb-0">
            <SidebarMenu>
              {inboxes.map((inbox) => (
                <SidebarMenuItem key={inbox.id}>
                  <SidebarMenuButton
                    aria-label={inbox.label}
                    className="justify-center px-2.5 md:px-2"
                    data-mailbox-id={inbox.id}
                    isActive={activeInbox?.id === inbox.id}
                    onClick={() => setActiveInboxId(inbox.id)}
                    tooltip={{
                      children: inbox.label,
                      hidden: false,
                    }}
                  >
                    <MailboxIcon id={inbox.id} label={inbox.label} />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent />
          <SidebarFooter className="items-center px-2 pt-0 pb-3">
            <RailAccountMenu accountEmail={accountEmail} isAdmin={isAdmin} />
          </SidebarFooter>
        </Sidebar>

        <Sidebar collapsible="none" className="hidden min-w-0 flex-1 md:flex">
          <SidebarHeader className="gap-3.5 border-b p-4">
            <div className="flex w-full items-center justify-between gap-3">
              <div className="text-base font-medium text-foreground">
                {activeInboxLabel}
              </div>
              <Button
                aria-label={`Refresh ${activeInboxLabel}`}
                className="text-muted-foreground"
                disabled={isRefreshing || missingConfig.length > 0}
                onClick={() => void refreshFeed({ skipWhenHidden: false })}
                size="icon-sm"
                title={`Refresh ${activeInboxLabel}`}
                type="button"
                variant="ghost"
              >
                <RefreshCwIcon
                  aria-hidden="true"
                  className={cn("size-4", isRefreshing && "animate-spin")}
                />
              </Button>
            </div>
            <SidebarInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search messages..."
            />
          </SidebarHeader>
          <SidebarContent className="min-w-0">
            <SidebarGroup className="min-w-0 px-0 py-0">
              <SidebarGroupLabel className="sr-only">Messages</SidebarGroupLabel>
              <SidebarGroupContent className="min-w-0 overflow-hidden">
                {missingConfig.length ? (
                  <SidebarAlert
                    title="Missing environment variables"
                    description={missingConfig.join(", ")}
                  />
                ) : null}
                {liveFeedError ? (
                  <SidebarAlert
                    title="Gmail read failed"
                    description={liveFeedError}
                  />
                ) : null}
                {filteredMessages.length ? (
                  filteredMessages.map((message) => (
                    <MessageListItem
                      isActive={activeMessage?.id === message.id}
                      key={message.id}
                      message={message}
                      onSelect={() => setActiveMessageId(message.id)}
                    />
                  ))
                ) : (
                  <EmptyMessageList hasMessages={inboxMessages.length > 0} />
                )}
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="h-svh min-h-0 overflow-hidden bg-background">
        <header className="sticky top-0 flex shrink-0 items-center gap-2 border-b bg-background p-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">All Inboxes</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{activeInboxLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {accessGrant ? (
            <Badge className="ml-auto hidden max-w-[48vw] truncate sm:inline-flex" variant="secondary">
              {accessGrant.service} · {accessGrant.fromAddress} → {accessGrant.toAddress} · 15 min
            </Badge>
          ) : null}
        </header>

        <ScrollArea className="min-h-0 flex-1">
          {activeMessage ? (
            <article className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-6">
              <header className="space-y-2 pb-5">
                <h2 className="text-xl font-semibold tracking-normal">
                  {activeMessage.subject}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {activeMessage.sender} ·{" "}
                  {detailDateFormatter.format(new Date(activeMessage.receivedAt))}
                </p>
                <p
                  className="truncate text-sm text-muted-foreground"
                  data-message-recipient-line
                >
                  <span className="font-medium text-foreground">To:</span>{" "}
                  {activeMessage.recipientAddresses.join(", ") ||
                    "(unknown recipient)"}
                </p>
              </header>
              <Separator />
              <div className="pt-6">
                <MessageBody message={activeMessage} />
              </div>
            </article>
          ) : (
            <EmptyDetailState />
          )}
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  );
}

function RailAccountMenu({
  accountEmail,
  isAdmin,
}: {
  accountEmail: string;
  isAdmin: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account menu"
          className="flex size-8 items-center justify-center rounded-md outline-none transition-none hover:scale-100 focus:outline-none focus-visible:outline-none focus-visible:ring-0 active:scale-100 data-[state=open]:scale-100"
          type="button"
        >
          <span
            aria-hidden="true"
            className="size-7 shrink-0 rounded-md border border-border/80 bg-background bg-cover bg-center bg-no-repeat transition-none"
            style={{ backgroundImage: `url(${ACCOUNT_AVATAR_URL})` }}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-60"
        side="right"
        sideOffset={8}
      >
        <DropdownMenuLabel className="px-2 py-1.5">
          <span className="block text-sm font-medium text-foreground">
            Mail Gate
          </span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {accountEmail}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin ? (
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link className="w-full cursor-pointer" href="/admin">
              <KeyRoundIcon aria-hidden="true" />
              Temporary access
            </Link>
          </DropdownMenuItem>
        ) : null}
        <form action={logoutAction}>
          <DropdownMenuItem asChild className="cursor-pointer">
            <button className="w-full cursor-pointer" type="submit">
              <LogOutIcon aria-hidden="true" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MailboxIcon({ id, label }: { id: string; label: string }) {
  if (id === "claude-code" || /anthropic|claude/i.test(label)) {
    return <ClaudeIcon aria-hidden="true" className="text-[#d97757]" />;
  }

  if (id === "codex") {
    return <CodexIcon aria-hidden="true" />;
  }

  if (id === "netflix") {
    return <NetflixIcon aria-hidden="true" className="text-[#e50914]" />;
  }

  return <InboxIcon aria-hidden="true" />;
}

function MessageListItem({
  isActive,
  message,
  onSelect,
}: {
  isActive: boolean;
  message: MailGateMessage;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      className={cn(
        "flex w-full min-w-0 max-w-full flex-col items-start gap-2 overflow-hidden border-b p-4 text-left text-sm leading-tight whitespace-nowrap transition-colors last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        isActive &&
          "bg-[oklch(0.955_0_0)] text-sidebar-accent-foreground hover:bg-[oklch(0.955_0_0)]"
      )}
      onClick={onSelect}
    >
      <div className="flex w-full min-w-0 max-w-full items-center gap-2 overflow-hidden">
        <span className="min-w-0 flex-1 truncate">
          {message.sender}
        </span>
        <span className="ml-auto shrink-0 text-xs">
          {formatListDate(message.receivedAt)}
        </span>
      </div>
      <span className="block w-full max-w-full truncate font-medium">
        {message.subject}
      </span>
      <span className="line-clamp-2 w-[260px] max-w-full text-xs whitespace-break-spaces">
        {message.snippet || message.bodyText || "(empty message)"}
      </span>
    </button>
  );
}

function formatListDate(value: string): string {
  const date = new Date(value);
  const dayDiff = getLocalDayDiff(date, new Date());

  if (dayDiff <= 0) {
    return listTimeFormatter.format(date);
  }

  if (dayDiff === 1) {
    return "Yesterday";
  }

  if (dayDiff < 7) {
    return `${dayDiff} days ago`;
  }

  if (dayDiff < 30) {
    const weeks = Math.floor(dayDiff / 7);

    return formatRelativeUnit(weeks, "week");
  }

  if (dayDiff < 365) {
    const months = Math.floor(dayDiff / 30);

    return formatRelativeUnit(months, "month");
  }

  const years = Math.floor(dayDiff / 365);

  return formatRelativeUnit(years, "year");
}

function getLocalDayDiff(date: Date, now: Date): number {
  const dayInMs = 24 * 60 * 60 * 1000;
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.floor((nowDay.getTime() - dateDay.getTime()) / dayInMs);
}

function formatRelativeUnit(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

function MessageBody({ message }: { message: MailGateMessage }) {
  if (message.bodyType === "html" && message.bodyHtml) {
    return (
      <EmailHtmlView
        html={message.bodyHtml}
        title={`Message body for ${message.subject}`}
      />
    );
  }

  return (
    <pre className="min-h-40 whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 font-sans text-sm leading-6 text-foreground">
      {message.bodyText || message.snippet || "(empty message)"}
    </pre>
  );
}

function EmailHtmlView({ html, title }: { html: string; title: string }) {
  const hostRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    const parsedDocument = new DOMParser().parseFromString(html, "text/html");
    const headStyles = Array.from(
      parsedDocument.head.querySelectorAll("style")
    )
      .map((style) => style.outerHTML)
      .join("");
    const bodyHtml = parsedDocument.body.innerHTML || html;

    shadowRoot.innerHTML = `
      <style>${EMAIL_SHADOW_BASE_STYLES}</style>
      ${headStyles}
      <div class="mailgate-email-root">${bodyHtml}</div>
    `;
  }, [html]);

  return (
    <div
      aria-label={title}
      className="mail-message-html w-full"
      ref={hostRef}
      role="document"
    />
  );
}

function SidebarAlert({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="p-3">
      <Alert variant="destructive">
        <AlertTriangle className="size-4" aria-hidden="true" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="break-words text-xs">
          {description}
        </AlertDescription>
      </Alert>
    </div>
  );
}

function EmptyMessageList({ hasMessages }: { hasMessages: boolean }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {hasMessages ? (
          <InboxIcon className="size-5" aria-hidden="true" />
        ) : (
          <MailOpenIcon className="size-5" aria-hidden="true" />
        )}
      </div>
      <div className="space-y-1">
        <h3 className="font-medium">
          {hasMessages ? "No matching messages" : "Messages unavailable"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {hasMessages
            ? "Try a different search."
            : "Check the Gmail connection and try again."}
        </p>
      </div>
    </div>
  );
}

function EmptyDetailState() {
  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <MailOpenIcon className="size-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h2 className="font-medium">No message selected</h2>
        <p className="text-sm text-muted-foreground">
          Choose a message from the inbox.
        </p>
      </div>
    </div>
  );
}
