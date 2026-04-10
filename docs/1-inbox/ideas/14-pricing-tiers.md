# Pricing Tiers

## Three Tiers

Mo Speech Home has three tiers: Free, Pro, and Max.

| Feature | Free | Pro | Max |
|---|---|---|---|
| Symbol search (voice + text) | ✅ | ✅ | ✅ |
| Core vocabulary dropdown | ✅ | ✅ | ✅ |
| Full SymbolStix library (58k) | ✅ | ✅ | ✅ |
| Categories + all four modes | ❌ | ✅ | ✅ |
| Modelling mode | ❌ | ✅ | ✅ |
| Resource library packs | ❌ | ✅ | ✅ |
| Create/edit custom symbols | ❌ | ✅ | ✅ |
| AI image generation | ❌ | ✅ | ✅ |
| Natural voice sentences (Chirp 3 HD) | ❌ | ✅ | ✅ |
| Base colour themes | ✅ | ✅ | ✅ |
| Premium themes | ❌ | ❌ | ✅ |
| Family member invitations | ❌ | ❌ | ✅ |
| Mo Speech School connection | ❌ | ❌ | ✅ |
| Voice cloning (future) | ❌ | ❌ | ✅ |
| Multiple student profiles | 1 | 1 | Unlimited |

---

## Ethical Considerations

The Free tier retains full access to the SymbolStix library and the core vocabulary dropdown. Search is the primary communication tool for many users — removing symbol access from the free tier would create a barrier to basic communication. This aligns with the principle that AAC tools are rights, not privileges.

What is gated behind Pro is the structured, category-based navigation system and modelling — features that require significant setup investment from the instructor and represent the full platform experience.

Max gates the social and connective features — family collaboration and School linking — which are infrastructure features with ongoing costs, rather than core AAC features.

---

## Pricing

Suggested starting prices (to be validated with early users):

| Tier | Monthly | Yearly |
|---|---|---|
| Free | £0 | £0 |
| Pro | £9.99/month | £79/year (save ~£41) |
| Max | £14.99/month | £119/year (save ~£61) |

All paid plans:
- Cancel anytime via Stripe Customer Portal
- Access continues until end of billing period on cancellation
- No refunds — when you upgrade or downgrade, the new plan starts at the next billing date and is shown clearly at the top of the plan selection screen

---

## How Tiers Map to Stripe

The existing Stripe setup supports multiple price IDs. Add:
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_PRO_YEARLY_PRICE_ID`
- `STRIPE_MAX_MONTHLY_PRICE_ID`
- `STRIPE_MAX_YEARLY_PRICE_ID`

The `users` table subscription field already supports plan variants. Extend `plan` from `"monthly" | "yearly"` to `"pro_monthly" | "pro_yearly" | "max_monthly" | "max_yearly"`.

---

## Access Control

A `useSubscription()` hook reads the current user's plan and returns:

```typescript
{
  tier: "free" | "pro" | "max"
  hasCategories: boolean
  hasModelling: boolean
  hasFamilyMembers: boolean
  hasSchoolConnection: boolean
  hasPremiumThemes: boolean
  hasVoiceCloning: boolean
  maxStudentProfiles: number
}
```

Components read from this hook to show upgrade prompts rather than hard-blocking. The upgrade path is always visible and frictionless — tapping a gated feature shows a contextual upgrade modal explaining what the feature is and which tier unlocks it.

---

## Custom Access

The existing admin dashboard supports granting custom access (SLP/professional, hardship grant, goodwill gesture, etc.). Custom access overrides tier checks entirely. This carries over unchanged from the MVP.

---

## Plan Changes

When a user upgrades or downgrades their plan, the new plan takes effect at the start of the next billing period. No refunds are issued for unused time on the current plan.

The plan selection screen shows a clear notice at the top: **"Your new plan will start on [date]."** This is shown whenever the user has a pending plan change.
