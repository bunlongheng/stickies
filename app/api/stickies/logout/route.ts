/**
 * Logout: signs the user out of NextAuth and redirects to the sign-in page.
 * Kept as a thin wrapper so existing client code that POSTs here still works.
 */
import { signOut } from "@/auth";

export async function POST() {
    // signOut() returns a redirect Response.
    return await signOut({ redirect: false, redirectTo: "/sign-in" });
}
