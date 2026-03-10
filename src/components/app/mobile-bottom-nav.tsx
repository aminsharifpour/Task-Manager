import type { ComponentType } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type NavItem = {
  key: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
};

type Props = {
  visibleNavItems: NavItem[];
  activeView: string;
  unreadChatCount: number;
  unreadTaskNotificationCount: number;
  inboxUnreadCount: number;
  onSelect: (key: string) => void;
  toFaNum: (value: string) => string;
};

export default function MobileBottomNav({
  visibleNavItems,
  activeView,
  unreadChatCount,
  unreadTaskNotificationCount,
  inboxUnreadCount,
  onSelect,
  toFaNum,
}: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(env(safe-area-inset-bottom),0.45rem)] pt-1 lg:hidden">
      <div className="liquid-glass rounded-2xl border p-2 shadow-lg">
        <TooltipProvider delayDuration={120}>
          <div className="overflow-x-auto">
            <div className="flex w-max min-w-full items-center justify-start gap-2 px-0.5">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const itemUnreadCount =
                  item.key === "chat"
                    ? unreadChatCount
                    : item.key === "tasks"
                      ? unreadTaskNotificationCount
                      : item.key === "inbox"
                        ? inboxUnreadCount
                        : 0;
                return (
                  <Tooltip key={`mobile-nav-${item.key}`}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onSelect(item.key)}
                        aria-label={item.title}
                        aria-current={activeView === item.key ? "page" : undefined}
                        className={`menu-item-glass relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                          activeView === item.key ? "border border-primary/40 bg-primary/15 text-primary" : ""
                        }`}
                      >
                        <Icon className="menu-item-icon h-5 w-5" />
                        {itemUnreadCount > 0 && (
                          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] text-destructive-foreground">
                            {toFaNum(String(Math.min(99, itemUnreadCount)))}
                          </span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{item.title}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </TooltipProvider>
      </div>
    </nav>
  );
}
