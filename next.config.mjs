/** @type {import('next').NextConfig} */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : undefined;

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // Only relevant if you switch <img> to next/image later.
  images: { remotePatterns: supabaseHost ? [{ protocol: 'https', hostname: supabaseHost }] : [] },
};
export default nextConfig;
