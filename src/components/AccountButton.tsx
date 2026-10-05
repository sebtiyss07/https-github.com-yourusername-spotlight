import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { AccountSync } from "@/components/AccountSync";

/** "Sign in" in the header, or the person's avatar menu once signed in. */
export function AccountButton() {
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            className="shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-[14px] font-bold text-white transition-colors hover:bg-accent-2"
          >
            Sign in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <span className="grid h-8 w-8 place-items-center">
          <UserButton />
        </span>
        <AccountSync />
      </Show>
    </>
  );
}
