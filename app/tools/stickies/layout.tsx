import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isLocal } from "@/lib/is-local";
import { auth } from "@/auth";

export default async function StickiesLayout({ children }: { children: React.ReactNode }) {
    const headersList = await headers();
    const host = headersList.get("host") || "";
    if (!isLocal(new Request("http://localhost", { headers: { host } }))) {
        const session = await auth();
        const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
        if (!session?.user?.email || session.user.email.toLowerCase() !== ownerEmail) {
            redirect("/sign-in");
        }
    }
    return <>{children}</>;
}
