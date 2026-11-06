// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Actions'ta site adresi ve alt yol repo adından türetilir (ErenHELVACI/DivanOku -> /DivanOku).
// Repo adı <sahip>.github.io ise site kökte yayınlanır. Yerelde (npm run dev/build) base '/' kalır.
const [sahip, repo] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
const kokSite = !!repo && repo.toLowerCase() === `${sahip.toLowerCase()}.github.io`;

// https://astro.build/config
export default defineConfig({
  site: sahip ? `https://${sahip.toLowerCase()}.github.io` : undefined,
  base: process.env.GITHUB_ACTIONS && repo && !kokSite ? `/${repo}` : '/',
});
