import { getCurrentUser } from "@/server/auth/current-user"
import { signOut } from "@/server/auth/actions"
import { AppSidebar } from "@/components/layout/app-sidebar"

export async function AppFrame({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  return (
    <div className="flex min-h-dvh w-full min-w-0 flex-col bg-background md:flex-row">
      <AppSidebar email={user.email} signOutAction={signOut} />
      <main className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-10">{children}</main>
    </div>
  )
}
