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
- 30-day free trial with full Max access — no credit card required
- Cancel anytime via Stripe Customer Portal
- Access continues until end of billing period on cancellation

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
  isTrialing: boolean
  trialDaysRemaining: number
}
```

Components read from this hook to show upgrade prompts rather than hard-blocking. The upgrade path is always visible and frictionless — tapping a gated feature shows a contextual upgrade modal explaining what the feature is and which tier unlocks it.

---

## Custom Access

The existing admin dashboard supports granting custom access (SLP/professional, hardship grant, goodwill gesture, etc.). Custom access overrides tier checks entirely. This carries over unchanged from the MVP.

---

## Trial

30-day free trial with full Max access. Automatically starts on account creation. No credit card required.

Trial expiry shows the same modal flow as the MVP:
- Day 29–30: warning modal (once per 24 hours, dismissible)
- Day 31+: expiry modal with upgrade options and "Continue with Free" option

"Continue with Free" drops the user to the Free tier — they keep their account, their student profile, and their search access. They do not lose any data, but categories and modelling become inaccessible until they upgrade.
