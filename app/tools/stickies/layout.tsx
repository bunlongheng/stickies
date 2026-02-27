import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function StickiesLayout({ children }: { children: React.ReactNode }) {
    // Gate is active whenever STICKIES_PASSWORD is configured (dev + prod)
    if (process.env.STICKIES_PASSWORD) {
        const cookieStore = await cookies();
        const auth = cookieStore.get("stickies_auth");
        if (auth?.value !== process.env.STICKIES_PASSWORD) {
            redirect("/stickies-unlock");
        }
    }

    return <>{children}</>;
}
