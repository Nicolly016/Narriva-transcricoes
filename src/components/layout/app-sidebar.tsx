"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  BarChart3,
  Cloud,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  Upload,
  type LucideIcon,
} from "lucide-react"
import { NAV_ITEMS } from "@/domain/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

const NAV_ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/projetos": FolderOpen,
  "/importar": Upload,
  "/transcricoes": FileText,
  "/nuvem": Cloud,
  "/analises": BarChart3,
  "/relatorios": ScrollText,
  "/configuracoes": Settings,
}

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/"
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLinks({
  pathname,
  collapsed = false,
  onNavigate,
}: {
  pathname: string
  collapsed?: boolean
  onNavigate?: () => void
}) {
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const current = isCurrent(pathname, item.href)
        const Icon = NAV_ICONS[item.href]
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            aria-label={collapsed ? item.label : undefined}
            title={collapsed ? item.label : undefined}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg py-2.5 text-base ${
              collapsed ? "justify-center px-2" : "justify-between px-3"
            } ${item.href === "/configuracoes" ? "mt-4" : ""} ${
              current
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                : "font-medium text-sidebar-foreground hover:bg-sidebar-hover"
            }`}
          >
            <span className={`flex min-w-0 items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
              {Icon ? <Icon className="size-5 shrink-0" aria-hidden="true" /> : null}
              {collapsed ? null : <span className="truncate">{item.label}</span>}
            </span>
            {!collapsed && !item.available ? (
              <span className="shrink-0 rounded-md bg-warning px-1.5 py-0.5 text-xs font-semibold text-warning-foreground">
                pendente
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

function AccountFooter({
  email,
  collapsed = false,
  signOutAction,
}: {
  email: string | null
  collapsed?: boolean
  signOutAction: () => Promise<void>
}) {
  return (
    <div className={`border-t border-sidebar-border py-4 ${collapsed ? "px-2" : "px-4"}`}>
      {collapsed ? null : <p className="truncate text-sm text-sidebar-muted">{email ?? "Sessão ativa"}</p>}
      <form action={signOutAction} className={collapsed ? "" : "mt-3"}>
        <Button
          type="submit"
          variant="secondary"
          aria-label="Sair"
          className={collapsed ? "size-10 w-full px-0" : "w-full"}
        >
          {collapsed ? <LogOut aria-hidden="true" /> : "Sair"}
        </Button>
      </form>
    </div>
  )
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/logo.png"
        alt=""
        width={48}
        height={48}
        className="size-12 rounded-lg"
      />
      <div>
        <p className="text-lg font-semibold leading-tight">Narriva</p>
        <p className="mt-0.5 text-sm leading-5 text-sidebar-muted">Transcrição e organização de áudios</p>
      </div>
    </div>
  )
}

const SIDEBAR_KEY = "narriva-sidebar-collapsed"

export function AppSidebar({
  email,
  signOutAction,
}: {
  email: string | null
  signOutAction: () => Promise<void>
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "1")
  }, [])

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current
      window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0")
      return next
    })
  }

  return (
    <>
      <aside
        className={`hidden shrink-0 bg-sidebar text-sidebar-foreground md:flex md:flex-col ${
          collapsed ? "w-[4.75rem]" : "w-72"
        }`}
      >
        <div className={`flex gap-2 ${collapsed ? "flex-col items-center px-2 py-4" : "items-start justify-between px-4 py-5"}`}>
          {collapsed ? (
            <Image src="/logo.png" alt="" width={40} height={40} className="size-10 rounded-lg" />
          ) : (
            <BrandMark />
          )}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label={collapsed ? "Expandir menu" : "Recuar menu"}
            aria-expanded={!collapsed}
            onClick={toggleSidebar}
            className="size-10 shrink-0"
          >
            {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          </Button>
        </div>
        <div className={`flex-1 ${collapsed ? "px-2" : "px-3"}`}>
          <NavLinks pathname={pathname} collapsed={collapsed} />
        </div>
        <AccountFooter email={email} collapsed={collapsed} signOutAction={signOutAction} />
      </aside>
      <header className="flex items-center justify-between bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
        <BrandMark />
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="secondary"
                size="icon"
                aria-label="Abrir navegação"
                className="size-11"
              />
            }
          >
            <Menu />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-80 border-sidebar-border bg-sidebar p-0 text-base text-sidebar-foreground [&_[data-slot=sheet-close]]:text-sidebar-foreground"
          >
            <SheetHeader className="px-5 py-6 pr-14">
              <SheetTitle className="sr-only">Navegação</SheetTitle>
              <BrandMark />
            </SheetHeader>
            <div className="flex flex-1 flex-col px-3">
              <NavLinks pathname={pathname} />
            </div>
            <AccountFooter email={email} signOutAction={signOutAction} />
          </SheetContent>
        </Sheet>
      </header>
    </>
  )
}
