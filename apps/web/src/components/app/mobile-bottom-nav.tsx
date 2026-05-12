import { useMemo, useState, type ComponentType } from "react";
import { Grid2X2, X } from "lucide-react";

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const primaryItems = useMemo(() => visibleNavItems.slice(0, 4), [visibleNavItems]);
  const secondaryItems = useMemo(() => visibleNavItems.slice(4), [visibleNavItems]);

  const unreadCountFor = (key: string) =>
    key === "chat" ? unreadChatCount : key === "tasks" ? unreadTaskNotificationCount : key === "inbox" ? inboxUnreadCount : 0;

  const handleSelect = (key: string) => {
    setDrawerOpen(false);
    onSelect(key);
  };

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(env(safe-area-inset-bottom),0.45rem)] pt-1 lg:hidden">
        <div className="oneui-mobile-nav-shell rounded-[1.9rem] border p-2 shadow-lg">
          <div className="grid grid-cols-5 gap-2">
            {primaryItems.map((item) => {
              const Icon = item.icon;
              const itemUnreadCount = unreadCountFor(item.key);
              return (
                <button
                  key={`mobile-nav-${item.key}`}
                  type="button"
                  onClick={() => handleSelect(item.key)}
                  aria-label={item.title}
                  title={item.title}
                  aria-current={activeView === item.key ? "page" : undefined}
                  className={`oneui-mobile-nav-item relative flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 ${
                    activeView === item.key ? "oneui-mobile-nav-item-active text-primary shadow-sm" : ""
                  }`}
                >
                  <Icon className="menu-item-icon h-4.5 w-4.5" />
                  <span className="line-clamp-1 text-[10px] font-medium">{item.title}</span>
                  {itemUnreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] text-destructive-foreground">
                      {toFaNum(String(Math.min(99, itemUnreadCount)))}
                    </span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="سایر بخش‌ها"
              className={`oneui-mobile-nav-item relative flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 ${
                drawerOpen ? "oneui-mobile-nav-item-active text-primary shadow-sm" : ""
              }`}
            >
              <Grid2X2 className="menu-item-icon h-4.5 w-4.5" />
              <span className="line-clamp-1 text-[10px] font-medium">بیشتر</span>
              {secondaryItems.some((item) => unreadCountFor(item.key) > 0) ? (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
              ) : null}
            </button>
          </div>
        </div>
      </nav>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/48 backdrop-blur-[6px]" aria-label="بستن منو" onClick={() => setDrawerOpen(false)} />
          <div className="oneui-mobile-drawer absolute inset-x-0 bottom-0 rounded-t-[2rem] border border-border/70 p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">دسترسی سریع</p>
                <p className="text-[11px] text-muted-foreground">ماژول موردنظر را انتخاب کن</p>
              </div>
              <button
                type="button"
                className="oneui-mobile-drawer-close inline-flex h-10 w-10 items-center justify-center rounded-2xl border"
                onClick={() => setDrawerOpen(false)}
                aria-label="بستن"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const itemUnreadCount = unreadCountFor(item.key);
                return (
                  <button
                    key={`mobile-drawer-${item.key}`}
                    type="button"
                    onClick={() => handleSelect(item.key)}
                    className={`oneui-mobile-drawer-item relative rounded-2xl border px-3 py-4 text-right ${
                      activeView === item.key ? "oneui-mobile-drawer-item-active text-primary" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Icon className="menu-item-icon mt-0.5 h-5 w-5 shrink-0" />
                      {itemUnreadCount > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
                          {toFaNum(String(Math.min(99, itemUnreadCount)))}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm font-semibold">{item.title}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
