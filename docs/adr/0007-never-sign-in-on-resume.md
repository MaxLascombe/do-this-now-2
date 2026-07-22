# Never show sign-in on resume

The iOS app kept landing on the Clerk sign-in screen on resume and cold start despite a live session — the third round of this bug (a grace delay, then #408's setActive re-activation with a 5s hang fallback, still leaking). Each prior fix kept a timeout that could flip to the login screen, and any timeout is a false-positive generator on slow networks.

Decision: the sign-in screen has exactly two triggers — a client with **no session at all** (first launch, post-sign-out), or a **definitive revocation signal** (API requests returning unauthenticated while Clerk holds no recoverable session). Everything else — token refresh in flight, transient signed-out flickers, setActive retries — keeps the app rendered on cached data, indefinitely, like offline. There is no timeout that shows the login screen.

Trade-off accepted: with a genuinely dead session and no network, the user sees stale data instead of a login prompt until the 401s arrive; Settings' explicit Sign out remains the manual escape hatch.
