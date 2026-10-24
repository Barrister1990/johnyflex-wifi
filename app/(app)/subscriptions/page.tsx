import { redirect } from "next/navigation";

/** Subscriptions live under Packages (Prepaid · Monthly · Subscribers). */
export default function SubscriptionsRedirectPage() {
  redirect("/packages");
}
