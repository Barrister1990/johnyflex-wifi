import { redirect } from "next/navigation";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Public root: send everyone to the JohnnyFlex hotspot portal. */
export default async function HomePage({ searchParams }: HomeProps) {
  const params = await searchParams;
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") q.set(key, value);
    else if (Array.isArray(value) && value[0]) q.set(key, value[0]);
  }
  const qs = q.toString();
  redirect(
    qs
      ? `/portal/johnny-flex-wifi?${qs}`
      : "/portal/johnny-flex-wifi",
  );
}
