import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { isUserInGoogleGroup, isAdminSdkConfigured } from "../googleAdmin";

export const googleRouter = router({
  isConfigured: publicProcedure.query(() => ({
    configured: isAdminSdkConfigured(),
  })),

  verifyMembership: protectedProcedure
    .input(
      z.object({
        userEmail: z.string().email().optional(),
        groupEmail: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const emailToCheck = input.userEmail ?? ctx.user.email;
      if (!emailToCheck) {
        return { isMember: false, error: "No email available for current user" };
      }
      try {
        const isMember = await isUserInGoogleGroup(emailToCheck, input.groupEmail);
        return { isMember };
      } catch (err: any) {
        return { isMember: false, error: err?.message ?? "Verification failed" };
      }
    }),
});
