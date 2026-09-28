import { NextResponse } from "next/server";
import Stripe from "stripe";

/**
 * One place that turns a thrown Stripe error into a safe client response
 * (MOS-29). The full type/code/message goes to the server log, never the client.
 *
 * - Our config is wrong (bad price ID, bad key, wrong account): "billing_misconfigured".
 * - The customer's card or bank said no: "payment_problem".
 * - Anything else: "unknown".
 */
export function stripeErrorResponse(route: string, err: unknown): NextResponse {
  if (err instanceof Stripe.errors.StripeError) {
    console.error(`[stripe:${route}]`, {
      type: err.type,
      code: err.code,
      message: err.message,
      requestId: err.requestId,
    });
    if (err instanceof Stripe.errors.StripeCardError) {
      return NextResponse.json({ error: "payment_problem" }, { status: 402 });
    }
    if (
      err instanceof Stripe.errors.StripeInvalidRequestError ||
      err instanceof Stripe.errors.StripeAuthenticationError ||
      err instanceof Stripe.errors.StripePermissionError
    ) {
      return NextResponse.json({ error: "billing_misconfigured" }, { status: 500 });
    }
  } else {
    console.error(`[stripe:${route}]`, err);
  }
  return NextResponse.json({ error: "unknown" }, { status: 500 });
}
