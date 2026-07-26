import { SignIn } from '@clerk/nextjs'

/**
 * Clerk sign-in. Returning users go through /onboarding too — it reads their
 * existing role and forwards them to the right surface, so a farmer never lands
 * on the consumer grid. Users with no role yet get sent back to the picker.
 */
export default function SignInPage() {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <SignIn forceRedirectUrl="/onboarding" signUpUrl="/sign-up" />
    </div>
  )
}
