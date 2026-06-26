"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import {
  filterModules,
  rememberModuleTab,
  resolveModule,
  type NavTab,
  type NavTabGroup,
} from "@/lib/navigation/modules";

const activeTabStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #123A5A, #1B4A6F)',
  boxShadow: '2px 2px 5px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
  color: '#ffffff',
};

const inactiveTabClass = "text-gas-700 font-medium hover:text-gas-500";
const activeGroupStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #123A5A, #1B4A6F)',
  boxShadow: '2px 2px 5px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
  color: '#ffffff',
};

function TabRow({
  tabs,
  pathname,
  moduleId,
  variant = "secondary",
}: {
  tabs: NavTab[];
  pathname: string;
  moduleId: string;
  variant?: "primary" | "secondary";
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const active = container.querySelector('[data-active="true"]');
    if (active instanceof HTMLElement) {
      active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [pathname]);

  if (tabs.length === 0) return null;

  const base =
    variant === "primary"
      ? "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-bold transition-all"
      : "whitespace-nowrap rounded-md px-3 py-1 text-[13px] transition-all";

  return (
    <div ref={scrollRef} className="flex gap-1 overflow-x-auto scroll-smooth pb-0.5 [scrollbar-width:thin]">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-active={isActive ? "true" : "false"}
            aria-current={isActive ? "page" : undefined}
            onClick={() => rememberModuleTab(moduleId, tab.href)}
            style={isActive ? activeTabStyle : undefined}
            className={`${base} ${isActive ? "text-white" : inactiveTabClass}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

function GroupTabs({
  groups,
  activeGroupId,
  pathname,
  moduleId,
}: {
  groups: NavTabGroup[];
  activeGroupId?: string;
  pathname: string;
  moduleId: string;
}) {
  const activeGroup =
    groups.find((group) => group.tabs.some((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`))) ??
    groups.find((group) => group.id === activeGroupId) ??
    groups[0];

  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto scroll-smooth pb-0.5 [scrollbar-width:thin]">
        {groups.map((group) => {
          const isActive = group.id === activeGroup?.id;
          const href = group.tabs[0]?.href ?? "#";
          return (
            <Link
              key={group.id}
              href={href}
              onClick={() => rememberModuleTab(moduleId, href)}
              style={isActive ? activeGroupStyle : undefined}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                isActive ? "text-white" : "text-steel-600 hover:bg-white/60 hover:text-gas-700"
              }`}
            >
              {group.label}
            </Link>
          );
        })}
      </div>
      {activeGroup ? (
        <TabRow tabs={activeGroup.tabs} pathname={pathname} moduleId={moduleId} variant="secondary" />
      ) : null}
    </div>
  );
}

export function ModuleTabBar({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const modules = useMemo(() => filterModules(permissions), [permissions]);
  const resolved = useMemo(() => resolveModule(pathname, modules), [pathname, modules]);

  useEffect(() => {
    if (resolved?.activeTab && !resolved.module.hideTabBar) {
      rememberModuleTab(resolved.module.id, resolved.activeTab.href);
    }
  }, [resolved?.module.id, resolved?.activeTab?.href, resolved?.module.hideTabBar]);

  if (!resolved || resolved.module.hideTabBar) return null;

  const { module, activeGroup } = resolved;

  return (
    <div
      data-print-hidden
      className="sticky top-12 z-10 px-4 py-2 md:top-12 md:px-7"
      style={{ background: 'linear-gradient(180deg, #f4f6f9, #e8ecf1)', borderBottom: '1px solid rgba(0,0,0,0.06)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)' }}
    >
      {module.tabGroups ? (
        <GroupTabs
          groups={module.tabGroups}
          activeGroupId={activeGroup?.id}
          pathname={pathname}
          moduleId={module.id}
        />
      ) : module.tabs ? (
        <TabRow tabs={module.tabs} pathname={pathname} moduleId={module.id} variant="secondary" />
      ) : null}
    </div>
  );
}
